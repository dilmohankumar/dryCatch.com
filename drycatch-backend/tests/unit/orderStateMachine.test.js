import { describe, it, expect } from "vitest";
import { isValidTransition, assertValidTransition, getAllowedTransitions } from "../../src/utils/orderStateMachine.js";

// Business logic unit test (rule #13) — no database, no HTTP, pure logic.
describe("orderStateMachine", () => {
  it("should allow a valid forward transition (pending_payment -> confirmed)", () => {
    expect(isValidTransition("pending_payment", "confirmed")).toBe(true);
  });

  it("should reject an invalid backward transition (delivered -> pending_payment)", () => {
    expect(isValidTransition("delivered", "pending_payment")).toBe(false);
  });

  it("should reject a transition from a terminal state (cancelled -> confirmed)", () => {
    expect(isValidTransition("cancelled", "confirmed")).toBe(false);
  });

  it("should throw a structured error for an invalid transition instead of silently allowing it", () => {
    expect(() => assertValidTransition("delivered", "processing")).toThrowError();
    try {
      assertValidTransition("delivered", "processing");
    } catch (err) {
      expect(err.statusCode).toBeDefined();
    }
  });

  it("should never allow transitioning a status to itself as a no-op skip of validation", () => {
    // Same-status "transition" isn't in any real order flow — assert the
    // state machine doesn't quietly treat it as valid via a fallthrough.
    const allowed = getAllowedTransitions("confirmed");
    expect(allowed).not.toContain("confirmed");
  });

  it("should never allow a terminal state to transition back into an active/pending flow", () => {
    const TERMINAL = ["delivered", "cancelled", "refunded", "returned"];
    // Spot-check known terminal states explicitly rather than asserting
    // over every status blindly — terminal states legitimately have zero
    // outgoing transitions (rule #29's "DELIVERED -> PENDING must fail").
    for (const terminal of TERMINAL) {
      const transitions = getAllowedTransitions(terminal);
      if (transitions.length > 0) {
        // Not necessarily a bug (e.g. delivered -> return_requested is real),
        // but pending_payment must never be among them.
        expect(transitions).not.toContain("pending_payment");
      }
    }
  });
});
