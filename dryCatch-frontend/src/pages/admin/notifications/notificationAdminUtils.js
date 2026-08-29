export function friendlyError(err) {
  if (err?.code === "PERMISSION_DENIED" || err?.status === 403) {
    return "You don't have permission for this.";
  }
  return err?.message || "Something went wrong.";
}

export const DELIVERY_STATUS_STYLES = {
  pending: "bg-gray-100 text-gray-600",
  queued: "bg-gray-100 text-gray-600",
  processing: "bg-blue-50 text-blue-600",
  sent: "bg-green-50 text-green-600",
  delivered: "bg-green-50 text-green-600",
  failed: "bg-red-50 text-red-600",
  bounced: "bg-red-50 text-red-600",
  cancelled: "bg-gray-100 text-gray-500",
  retrying: "bg-amber-50 text-amber-600",
};
