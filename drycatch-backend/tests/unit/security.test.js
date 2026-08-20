import { describe, it, expect } from "vitest";
import { validatePassword } from "../../src/utils/passwordPolicy.js";
import { sanitizeInput } from "../../src/middleware/sanitizeInput.js";
import { toCSV } from "../../src/utils/csvExport.js";

// Regression tests for the two Phase 18 HIGH-severity fixes and their
// supporting utilities (rule #57 — "integrate Phase 18 security tests").
describe("passwordPolicy", () => {
  it("should reject a password shorter than the minimum length", () => {
    expect(validatePassword("short1")).toEqual(expect.any(String));
  });

  it("should reject a common/breached password", () => {
    expect(validatePassword("password123")).toEqual(expect.any(String));
  });

  it("should reject a non-string password", () => {
    expect(validatePassword({ $ne: null })).toEqual(expect.any(String));
  });

  it("should accept a reasonably long passphrase", () => {
    expect(validatePassword("a-reasonably-long-passphrase")).toBeNull();
  });
});

describe("sanitizeInput (NoSQL operator injection guard)", () => {
  it("should strip Mongo operator keys from request bodies", () => {
    const req = { body: { phone: { $ne: null }, password: "x" }, query: {}, params: {} };
    sanitizeInput(req, {}, () => {});
    expect(Object.keys(req.body.phone)).toHaveLength(0);
  });

  it("should strip dotted keys while preserving safe sibling fields", () => {
    const req = { body: { nested: { "a.b": 1, safe: "ok" } }, query: {}, params: {} };
    sanitizeInput(req, {}, () => {});
    expect(req.body.nested["a.b"]).toBeUndefined();
    expect(req.body.nested.safe).toBe("ok");
  });

  it("should recurse into arrays of objects", () => {
    const req = { body: { items: [{ $where: "1==1" }, { safe: true }] }, query: {}, params: {} };
    sanitizeInput(req, {}, () => {});
    expect(req.body.items[0].$where).toBeUndefined();
    expect(req.body.items[1].safe).toBe(true);
  });
});

describe("csvExport (formula injection guard)", () => {
  it("should prefix a dangerous leading character with a single quote", () => {
    const csv = toCSV([{ name: "=cmd|' /C calc'!A1" }], [{ label: "Name", value: "name" }]);
    expect(csv).toContain("'=cmd");
  });

  it("should quote and escape values containing commas or quotes", () => {
    const csv = toCSV([{ name: 'Say "hi", please' }], [{ label: "Name", value: "name" }]);
    expect(csv).toContain('"Say ""hi"", please"');
  });

  it("should leave normal values untouched", () => {
    const csv = toCSV([{ name: "Regular Product" }], [{ label: "Name", value: "name" }]);
    expect(csv).toContain("Regular Product");
  });
});
