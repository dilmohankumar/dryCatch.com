// In-app has no external provider — the Notification document itself IS
// the in-app record (rule #16/#46), read directly by the Notification
// Center API. "Sending" is just marking the delivery as delivered.
export async function send() {
  return { success: true, status: "delivered", provider: "in_app" };
}
