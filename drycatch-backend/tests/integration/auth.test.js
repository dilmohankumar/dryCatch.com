import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import User from "../../src/models/User.js";
import { startTestDb, stopTestDb, clearTestDb } from "../helpers/testDb.js";
import { createUser } from "../helpers/factories.js";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe("POST /api/v1/auth/login", () => {
  it("should reject a NoSQL-operator-shaped phone field instead of matching an arbitrary user (Phase 18 regression)", async () => {
    await createUser({ phone: "9000000001", password: "ReasonablePassphrase1" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ phone: { $ne: null }, password: "whatever" });
    expect(res.status).toBe(400);
  });

  it("should reject a non-string email the same way (Phase 18 regression)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: { $gt: "" }, password: "whatever" });
    expect(res.status).toBe(400);
  });

  it("should reject invalid credentials with a generic message (account enumeration protection)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nonexistent@example.com", password: "whatever12345" });
    expect(res.status).toBe(401);
    expect(res.body.message).not.toMatch(/exist|found/i);
  });

  it("should log in successfully with correct credentials and set auth cookies", async () => {
    const user = await createUser({ email: "logintest@example.com", password: "ReasonablePassphrase1" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "logintest@example.com", password: "ReasonablePassphrase1" });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user.password).toBeUndefined();
    const setCookie = res.headers["set-cookie"].join(";");
    expect(setCookie).toContain("access_token");
    expect(setCookie).toContain("HttpOnly");
  });

  it("should reject login for an unverified account", async () => {
    await createUser({ email: "unverified@example.com", password: "ReasonablePassphrase1", isVerified: false });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "unverified@example.com", password: "ReasonablePassphrase1" });
    expect(res.status).toBe(403);
  });
});

describe("Session revocation (Phase 18 HIGH-severity regression)", () => {
  it("should reject a previously-issued access token immediately after logout, not just at its own expiry", async () => {
    await createUser({ email: "revoketest@example.com", password: "ReasonablePassphrase1" });
    const agent = request.agent(app);

    const loginRes = await agent.post("/api/v1/auth/login").send({ email: "revoketest@example.com", password: "ReasonablePassphrase1" });
    expect(loginRes.status).toBe(200);

    const oldCookies = loginRes.headers["set-cookie"];

    const meBefore = await agent.get("/api/v1/auth/me");
    expect(meBefore.status).toBe(200);

    const logoutRes = await agent.post("/api/v1/auth/logout");
    expect(logoutRes.status).toBe(200);

    // Replay the PRE-LOGOUT cookie on a fresh request (not the agent, whose
    // cookie jar now has the cleared cookie) — this is the actual
    // vulnerability scenario: a stolen/leaked token used after logout.
    const replay = await request(app).get("/api/v1/auth/me").set("Cookie", oldCookies);
    expect(replay.status).toBe(401);
  });

  it("should reject an access token issued before 'logout other devices' was triggered", async () => {
    const user = await createUser({ email: "revokeall@example.com", password: "ReasonablePassphrase1" });
    const loginRes = await request(app).post("/api/v1/auth/login").send({ email: "revokeall@example.com", password: "ReasonablePassphrase1" });
    const staleCookies = loginRes.headers["set-cookie"];

    const reloaded = await User.findById(user._id).select("+tokenVersion");
    reloaded.tokenVersion = (reloaded.tokenVersion || 0) + 1;
    await reloaded.save();

    const res = await request(app).get("/api/v1/auth/me").set("Cookie", staleCookies);
    expect(res.status).toBe(401);
  });
});

describe("Password policy enforcement on signup (Phase 18 regression)", () => {
  it("should reject signup with a too-short password", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      firstName: "Test", email: "shortpw@example.com", password: "short1",
    });
    expect(res.status).toBe(400);
  });

  it("should reject signup with a common password", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      firstName: "Test", email: "commonpw@example.com", password: "password123",
    });
    expect(res.status).toBe(400);
  });
});
