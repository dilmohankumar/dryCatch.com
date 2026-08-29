import { useState, useEffect } from "react";
import { preferencesAPI, notificationsAPI } from "../../utils/api";

const TOGGLES = [
  { key: "marketingEmail", label: "Promotional emails", hint: "New products, offers, and seasonal sales" },
  { key: "marketingSms", label: "Promotional SMS", hint: "Text messages about offers and sales" },
  { key: "productRecommendations", label: "Product recommendations", hint: "Personalized picks based on what you browse/buy" },
  { key: "backInStockAlerts", label: "Back-in-stock alerts", hint: "Notify me when a wishlisted item is available again" },
];

// Phase 16 channel-level groups — separate from the legacy toggles above,
// which predate the notification engine. Security/transactional groups are
// shown read-only-ish (still togglable per rule #30) since criticalBypassesPreferences
// in the backend rules means some of these are sent regardless, documented inline.
const CHANNEL_GROUPS = [
  { key: "orderUpdates", label: "Order updates", hint: "Order placed, confirmed, cancelled" },
  { key: "shippingUpdates", label: "Shipping updates", hint: "Shipped, out for delivery, delivered" },
  { key: "marketing", label: "Promotions", hint: "Campaigns, sales, new collections" },
  { key: "reviews", label: "Reviews", hint: "Review approval/rejection updates" },
];
const CHANNELS = ["email", "sms", "push", "in_app"];

export default function Notifications() {
  const [prefs, setPrefs] = useState(null);
  const [channelPrefs, setChannelPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const loadFeed = () => {
    setFeedLoading(true);
    notificationsAPI.list({ limit: 30 }).then((data) => setFeed(data.items || [])).finally(() => setFeedLoading(false));
  };

  useEffect(() => {
    preferencesAPI.get()
      .then(({ preferences }) => setPrefs(preferences))
      .catch((err) => setError(err.message || "Unable to load your preferences."))
      .finally(() => setLoading(false));
    notificationsAPI.getPreferences().then(setChannelPrefs).catch(() => setChannelPrefs(null));
    loadFeed();
  }, []);

  async function handleMarkAllRead() {
    await notificationsAPI.markAllRead().catch(() => {});
    setFeed((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  async function handleItemClick(item) {
    if (!item.readAt) {
      await notificationsAPI.markRead(item._id).catch(() => {});
      setFeed((prev) => prev.map((n) => (n._id === item._id ? { ...n, readAt: new Date().toISOString() } : n)));
    }
  }

  const toggleChannel = async (group, channel) => {
    const next = { ...channelPrefs, [group]: { ...channelPrefs[group], [channel]: !channelPrefs[group]?.[channel] } };
    setChannelPrefs(next);
    try {
      const updated = await notificationsAPI.updatePreferences({ [group]: next[group] });
      setChannelPrefs(updated);
    } catch (err) {
      setChannelPrefs(channelPrefs);
      setError(err.message || "Unable to save your preference.");
    }
  };

  const toggle = async (key) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaved(false);
    try {
      const { preferences } = await preferencesAPI.update({ [key]: next[key] });
      setPrefs(preferences);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setPrefs(prefs); // revert on failure
      setError(err.message || "Unable to save your preference.");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading preferences...</div>;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-semibold">Notifications</h2>
        {feed.some((n) => !n.readAt) && (
          <button onClick={handleMarkAllRead} className="text-sm text-[#1A3A5C] font-medium hover:underline">
            Mark all read
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-4">Your recent order, security, and account notifications.</p>
      <div className="border rounded-lg divide-y max-w-2xl mb-8">
        {feedLoading && <div className="p-4 text-sm text-gray-400 text-center">Loading...</div>}
        {!feedLoading && feed.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">No notifications yet</div>}
        {!feedLoading &&
          feed.map((item) => (
            <button
              key={item._id}
              onClick={() => handleItemClick(item)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!item.readAt ? "bg-blue-50/50" : ""}`}
            >
              <div className="flex items-start gap-2">
                {!item.readAt && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F4B740] shrink-0" aria-hidden="true" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.body}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{new Date(item.createdAt).toLocaleString()}</p>
                </div>
              </div>
            </button>
          ))}
      </div>

      <h2 className="text-xl font-semibold mb-1">Notification Preferences</h2>
      <p className="text-sm text-gray-500 mb-6">
        Order updates and security notices (like sign-in alerts) are always sent — they aren't
        marketing and can't be turned off here.
      </p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {saved && <p className="text-green-600 text-sm mb-4">Preferences saved</p>}

      <div className="space-y-4 max-w-md">
        {TOGGLES.map((t) => (
          <label key={t.key} className="flex items-start justify-between gap-4 p-3 border rounded-lg cursor-pointer">
            <span>
              <span className="block font-medium">{t.label}</span>
              <span className="block text-sm text-gray-500">{t.hint}</span>
            </span>
            <input
              type="checkbox"
              checked={!!prefs?.[t.key]}
              onChange={() => toggle(t.key)}
              className="mt-1 w-5 h-5 accent-[#1A3A5C]"
              aria-label={t.label}
            />
          </label>
        ))}
      </div>

      {channelPrefs && (
        <div className="mt-8 max-w-2xl">
          <h3 className="text-lg font-semibold mb-1">Channel Preferences</h3>
          <p className="text-sm text-gray-500 mb-4">
            Choose how you'd like to be notified for each category. Security and order-confirmation
            notices may still be sent regardless of these settings where required for your account's safety.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium">Category</th>
                  {CHANNELS.map((c) => (
                    <th key={c} className="p-3 font-medium capitalize">{c.replace("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CHANNEL_GROUPS.map((g) => (
                  <tr key={g.key} className="border-t">
                    <td className="p-3">
                      <span className="block font-medium">{g.label}</span>
                      <span className="block text-xs text-gray-500">{g.hint}</span>
                    </td>
                    {CHANNELS.map((c) => (
                      <td key={c} className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!channelPrefs[g.key]?.[c]}
                          onChange={() => toggleChannel(g.key, c)}
                          className="w-4 h-4 accent-[#1A3A5C]"
                          aria-label={`${g.label} via ${c}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
