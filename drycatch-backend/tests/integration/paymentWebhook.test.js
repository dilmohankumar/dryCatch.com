import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import crypto from "crypto";
import request from "supertest";
import app from "../../src/app.js";
import Payment from "../../src/models/Payment.js";
import Order from "../../src/models/Order.js";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createUser, createOrder, createPayment } from "../helpers/factories.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

function signBody(bodyString) {
  return crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(bodyString).digest("hex");
}

function capturedPayload(providerOrderId, providerPaymentId, amount) {
  return {
    id: `evt_${providerPaymentId}`,
    event: "payment.captured",
    created_at: Math.floor(Date.now() / 1000),
    payload: { payment: { entity: { id: providerPaymentId, order_id: providerOrderId, amount, currency: "INR", method: "upi" } } },
  };
}

describe("POST /api/v1/payments/webhook/:provider (Phase 8/18/20 regression)", () => {
  it("should reject a webhook with an invalid HMAC signature", async () => {
    const user = await createUser();
    const order = await createOrder(user, { status: "pending_payment", paymentStatus: "pending" });
    const payment = await createPayment(order, user);

    const bodyString = JSON.stringify(capturedPayload(payment.providerOrderId, "pay_fake123", payment.amount));
    const res = await request(app)
      .post("/api/v1/payments/webhook/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", "not-the-real-signature")
      .send(bodyString);

    expect(res.status).toBe(400);
    const reloaded = await Payment.findById(payment._id);
    expect(reloaded.status).toBe("created"); // untouched — an invalid signature must never mutate state
  });

  it("should accept a correctly-signed webhook and mark the payment succeeded", async () => {
    const user = await createUser();
    const order = await createOrder(user, { status: "pending_payment", paymentStatus: "pending" });
    const payment = await createPayment(order, user);

    const bodyString = JSON.stringify(capturedPayload(payment.providerOrderId, "pay_real123", payment.amount));
    const res = await request(app)
      .post("/api/v1/payments/webhook/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signBody(bodyString))
      .send(bodyString);

    expect(res.status).toBe(200);
    const reloadedPayment = await Payment.findById(payment._id);
    expect(reloadedPayment.status).toBe("succeeded");
    const reloadedOrder = await Order.findById(order._id);
    expect(reloadedOrder.status).toBe("confirmed");
  });

  it("should be idempotent under a duplicate/replayed webhook event (same event id twice)", async () => {
    const user = await createUser();
    const order = await createOrder(user, { status: "pending_payment", paymentStatus: "pending" });
    const payment = await createPayment(order, user);

    const payloadObj = capturedPayload(payment.providerOrderId, "pay_replay123", payment.amount);
    const bodyString = JSON.stringify(payloadObj);
    const signature = signBody(bodyString);

    const first = await request(app).post("/api/v1/payments/webhook/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", signature).send(bodyString);
    const second = await request(app).post("/api/v1/payments/webhook/razorpay").set("Content-Type", "application/json").set("x-razorpay-signature", signature).send(bodyString);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);

    // Confirm no double-processing side effect: order confirmed exactly once,
    // not "re-confirmed" or corrupted by a second pass.
    const reloadedOrder = await Order.findById(order._id);
    expect(reloadedOrder.status).toBe("confirmed");
  });

  it("should ignore a webhook for a providerOrderId that doesn't match any known payment, without erroring", async () => {
    const bodyString = JSON.stringify(capturedPayload("rzp_order_unknown_xyz", "pay_unknown", 50000));
    const res = await request(app)
      .post("/api/v1/payments/webhook/razorpay")
      .set("Content-Type", "application/json")
      .set("x-razorpay-signature", signBody(bodyString))
      .send(bodyString);
    expect(res.status).toBe(200);
    expect(res.body.ignored).toBe(true);
  });
});
