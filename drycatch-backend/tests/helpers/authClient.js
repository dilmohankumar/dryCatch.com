import request from "supertest";
import app from "../../src/app.js";

// Returns a supertest agent already logged in as `user` — reused across
// every integration test that needs an authenticated request instead of
// each test re-deriving a token/cookie by hand (rule #66 — reusable helpers
// for "authenticated customer"/"authenticated admin").
export async function loginAs(user, password = "ReasonablePassphrase1") {
  const agent = request.agent(app);
  const res = await agent.post("/api/v1/auth/login").send({ email: user.email, password });
  if (res.status !== 200) {
    throw new Error(`loginAs(${user.email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
