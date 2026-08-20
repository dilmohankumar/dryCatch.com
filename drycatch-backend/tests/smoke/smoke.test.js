import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../../src/app.js";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createUser, createCategory, createProduct } from "../helpers/factories.js";

// Fast smoke suite (rule #55) — "does the app even work." Meant to run on
// every change: app starts, DB connects, core read paths and auth respond.
// Not a substitute for the deeper integration suites above, just a quick
// "is anything on fire" check.
beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe("smoke", () => {
  it("database connects", () => {
    expect(mongoose.connection.readyState).toBe(1);
  });

  it("health endpoint responds", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("readiness endpoint reports DB connectivity", async () => {
    const res = await request(app).get("/ready");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("product listing endpoint works and returns paginated shape", async () => {
    const category = await createCategory();
    await createProduct({ category: category._id });
    const res = await request(app).get("/api/v1/products");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.pagination).toBeDefined();
  });

  it("category listing endpoint works", async () => {
    await createCategory();
    const res = await request(app).get("/api/v1/categories");
    expect(res.status).toBe(200);
  });

  it("authentication rejects an unauthenticated request to a protected route", async () => {
    const res = await request(app).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
  });

  it("signup + login flow works end-to-end", async () => {
    const email = `smoke_${Date.now()}@example.com`;
    await createUser({ email, isVerified: true });
    const res = await request(app).post("/api/v1/auth/login").send({ email, password: "ReasonablePassphrase1" });
    expect(res.status).toBe(200);
  });

  it("checkout entry point (cart) responds without erroring for a guest", async () => {
    const res = await request(app).get("/api/v1/cart");
    expect([200, 401]).toContain(res.status); // guest cart is allowed; just must not 500
  });

  it("unknown route returns 404, not a crash", async () => {
    const res = await request(app).get("/api/v1/this-route-does-not-exist");
    expect(res.status).toBe(404);
  });
});
