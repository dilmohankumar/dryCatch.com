// Shared helpers for the admin CMS pages (Phase 15) — mirrors the
// friendlyError()/status-badge conventions used by RolesPage.jsx and
// AdminCustomersPage.jsx.
export function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

export const STATUS_STYLES = {
  draft: "bg-gray-100 text-gray-600",
  in_review: "bg-amber-50 text-amber-600",
  approved: "bg-blue-50 text-blue-600",
  scheduled: "bg-purple-50 text-purple-600",
  published: "bg-green-50 text-green-600",
  archived: "bg-red-50 text-red-600",
};

export const STATUS_LABELS = {
  draft: "Draft",
  in_review: "In Review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

// Which lifecycle actions are valid from a given current status — mirrors
// utils/contentStateMachine.js's graph (draft -> in_review -> approved ->
// scheduled -> published -> archived, with archived -> draft to restore).
export function actionsForStatus(status) {
  switch (status) {
    case "draft":
      return ["submitForReview", "publish"]; // a role with publish permission can skip review
    case "in_review":
      return ["approve", "sendBack"];
    case "approved":
      return ["publish", "schedule", "sendBack"];
    case "scheduled":
      return ["sendBack"];
    case "published":
      return ["archive"];
    case "archived":
      return ["restore"];
    default:
      return [];
  }
}

export const ACTION_LABELS = {
  submitForReview: "Submit for Review",
  approve: "Approve",
  publish: "Publish",
  schedule: "Schedule",
  archive: "Archive",
  restore: "Restore",
  sendBack: "Send Back to Draft",
};
