import { useState, useEffect, useRef, useCallback } from "react";
import { notificationsAPI } from "../../utils/api";

// Reasonable polling fallback (rule #118) — no WebSocket/SSE infrastructure
// exists in this project yet (documented gap, Phase 17 readiness), so the
// unread count is refreshed periodically rather than pushed in real time.
// 45s keeps this well away from "aggressive polling."
const POLL_MS = 45000;

const BellIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2a2 2 0 01-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell({ onNavigate = () => {} }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);

  const refreshCount = useCallback(() => {
    notificationsAPI.unreadCount().then(({ count }) => setUnread(count)).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const id = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(id);
  }, [refreshCount]);

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    notificationsAPI
      .list({ limit: 8 })
      .then((data) => setItems(data.items || []))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleItemClick(item) {
    if (!item.readAt) {
      await notificationsAPI.markRead(item._id).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
      setItems((prev) => prev.map((n) => (n._id === item._id ? { ...n, readAt: new Date().toISOString() } : n)));
    }
    if (item.data?.actionUrl) onNavigate(item.data.actionUrl.replace(/^\/+/, "")); // onNavigate prepends its own leading slash
  }

  async function handleMarkAllRead() {
    await notificationsAPI.markAllRead().catch(() => {});
    setUnread(0);
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center gap-1.5 text-gray-900 hover:opacity-70 transition-opacity"
        aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-4 h-4 flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-lg shadow-lg border z-50"
          role="menu"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-[#1A3A5C] font-medium hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && <div className="p-4 text-sm text-gray-400 text-center">Loading...</div>}
            {!loading && items.length === 0 && <div className="p-4 text-sm text-gray-400 text-center">No notifications yet</div>}
            {!loading &&
              items.map((item) => (
                <button
                  key={item._id}
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-gray-50 transition-colors ${!item.readAt ? "bg-blue-50/50" : ""}`}
                  role="menuitem"
                >
                  <div className="flex items-start gap-2">
                    {!item.readAt && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#F4B740] shrink-0" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2">{item.body}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(item.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
          <button
            onClick={() => {
              setOpen(false);
              onNavigate("account/notifications");
            }}
            className="w-full text-center py-2.5 text-sm font-medium text-[#1A3A5C] hover:bg-gray-50 border-t"
          >
            View all
          </button>
        </div>
      )}
    </div>
  );
}
