// Explicit lifecycle graph (rule #9/#68/#166), shared by Page and BlogPost
// — same pattern as Phase 9's orderStateMachine.js. Nothing sets
// `status` directly outside pageService.js/blogService.js's transition
// functions, which all route through this.
const TRANSITIONS = {
  draft: ["in_review", "published", "archived"], // direct draft->published allowed for roles with publish permission who skip review (small teams, rule #10 flow is the default UX, not mandatory)
  in_review: ["approved", "draft"], // rejected back to draft, not a separate REJECTED state — the spec's own core lifecycle (rule #166) only lists these six
  approved: ["scheduled", "published", "draft"],
  scheduled: ["published", "draft"], // scheduler flips this; an editor can also cancel back to draft
  published: ["archived"],
  archived: ["draft"], // restoring an archived page returns it to draft, never straight back to published without re-review
};

export function isValidContentTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

export function assertValidContentTransition(from, to) {
  if (!isValidContentTransition(from, to)) {
    throw Object.assign(
      new Error(`Cannot move content from "${from}" to "${to}"`),
      { statusCode: 409, code: "INVALID_CONTENT_TRANSITION" }
    );
  }
}
