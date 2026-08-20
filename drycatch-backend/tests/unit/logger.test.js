import { describe, it, expect } from "vitest";
import { redact } from "../../src/utils/logger.js";

// Phase 22 regression coverage — the redaction function is the one thing
// standing between a careless `logger.info("user login", user)` call and
// a password hash ending up in production logs.
describe("logger redact()", () => {
  it("should redact a top-level password field", () => {
    expect(redact({ password: "hunter2" }).password).toBe("[REDACTED]");
  });

  it("should redact nested sensitive fields at any depth", () => {
    const result = redact({ user: { credentials: { refreshToken: "abc.def.ghi" } } });
    expect(result.user.credentials.refreshToken).toBe("[REDACTED]");
  });

  it("should redact fields regardless of casing or separator style", () => {
    expect(redact({ Authorization: "Bearer x" }).Authorization).toBe("[REDACTED]");
    expect(redact({ api_key: "sk_live_x" }).api_key).toBe("[REDACTED]");
    expect(redact({ cardNumber: "4111111111111111" }).cardNumber).toBe("[REDACTED]");
  });

  it("should NOT redact unrelated fields that merely contain a similar substring", () => {
    // Regression test for a real bug found and fixed during this phase —
    // a naive /card/i pattern would have redacted this.
    const result = redact({ discardedAt: "2026-01-01", discount: 10 });
    expect(result.discardedAt).toBe("2026-01-01");
    expect(result.discount).toBe(10);
  });

  it("should redact within arrays of objects", () => {
    const result = redact([{ token: "x" }, { safe: "y" }]);
    expect(result[0].token).toBe("[REDACTED]");
    expect(result[1].safe).toBe("y");
  });

  it("should handle circular references without throwing", () => {
    const obj = { name: "test" };
    obj.self = obj;
    expect(() => redact(obj)).not.toThrow();
  });

  it("should pass through primitives and null unchanged", () => {
    expect(redact("hello")).toBe("hello");
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });
});
