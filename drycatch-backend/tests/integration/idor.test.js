import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createUser, createOrder } from "../helpers/factories.js";
import { loginAs } from "../helpers/authClient.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

// IDOR test matrix (rule #19/#26/#127) — the exact scenario the spec asks
// for: attacker manipulates an orderId in the URL and must be denied.
describe("IDOR protection — orders", () => {
  it("should deny customer A access to customer B's order by guessing/changing the order id", async () => {
    const userA = await createUser({ email: "usera@example.com" });
    const userB = await createUser({ email: "userb@example.com" });
    const orderB = await createOrder(userB);

    const agentA = await loginAs(userA);
    const res = await agentA.get(`/api/v1/orders/${orderB._id}`);

    expect(res.status).toBe(403);
  });

  it("should allow the owning customer to access their own order", async () => {
    const userA = await createUser({ email: "usera2@example.com" });
    const orderA = await createOrder(userA);

    const agentA = await loginAs(userA);
    const res = await agentA.get(`/api/v1/orders/${orderA._id}`);

    expect(res.status).toBe(200);
    expect(res.body.order.id || res.body.order._id).toBeDefined();
  });

  it("should deny an unauthenticated request entirely", async () => {
    const userB = await createUser({ email: "userb2@example.com" });
    const orderB = await createOrder(userB);
    const res = await request(app).get(`/api/v1/orders/${orderB._id}`);
    expect(res.status).toBe(401);
  });

  it("should deny cross-customer access to another customer's order timeline", async () => {
    const userA = await createUser({ email: "usera3@example.com" });
    const userB = await createUser({ email: "userb3@example.com" });
    const orderB = await createOrder(userB);

    const agentA = await loginAs(userA);
    const res = await agentA.get(`/api/v1/orders/${orderB._id}/timeline`);
    expect(res.status).toBe(403);
  });

  it("should return 404 for a well-formed but nonexistent order id rather than leaking existence via a different status", async () => {
    const userA = await createUser({ email: "usera4@example.com" });
    const agentA = await loginAs(userA);
    const res = await agentA.get(`/api/v1/orders/507f1f77bcf86cd799439011`);
    expect(res.status).toBe(404);
  });
});

describe("Authorization — admin-only endpoints", () => {
  it("should deny a regular customer access to the admin order list", async () => {
    const userA = await createUser({ email: "notadmin@example.com" });
    const agentA = await loginAs(userA);
    const res = await agentA.get("/api/v1/orders");
    expect(res.status).toBe(403);
  });

  it("should deny a regular customer from changing another customer's order status", async () => {
    const userA = await createUser({ email: "notadmin2@example.com" });
    const userB = await createUser({ email: "targetuser@example.com" });
    const orderB = await createOrder(userB, { status: "confirmed" });

    const agentA = await loginAs(userA);
    const res = await agentA.put(`/api/v1/orders/${orderB._id}/status`).send({ status: "processing" });
    expect(res.status).toBe(403);
  });
});
