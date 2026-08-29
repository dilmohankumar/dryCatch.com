import { useState, useEffect } from "react";
import { growthAPI } from "../../utils/api.js";

const STATUS_LABEL = {
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-700" },
  qualified: { label: "Qualified", cls: "bg-blue-50 text-blue-700" },
  reward_issued: { label: "Reward issued", cls: "bg-green-50 text-green-700" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700" },
};

export default function Referrals() {
  const [code, setCode] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([growthAPI.getReferralCode(), growthAPI.getReferrals()])
      .then(([c, r]) => {
        setCode(c.code);
        setReferrals(r.referrals || []);
      })
      .catch((err) => setError(err.message || "Unable to load your referral details."))
      .finally(() => setLoading(false));
  }, []);

  const shareLink = code ? `${window.location.origin}/signup?ref=${code}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can be unavailable (older browsers, insecure context)
      // — the link is still visible and selectable, so this isn't fatal.
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading your referral details...</div>;

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-1">Refer a Friend</h2>
      <p className="text-sm text-gray-500 mb-6">Share your link — when a friend signs up and completes their first order, you earn loyalty points.</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="max-w-lg mb-8 border rounded-2xl p-4 flex items-center gap-3">
        <input
          readOnly
          value={shareLink}
          className="flex-1 min-w-0 text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border"
        />
        <button
          onClick={copyLink}
          className="shrink-0 px-4 py-2 rounded-lg font-semibold text-sm bg-[#1A3A5C] text-white hover:bg-[#132a44] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      <h3 className="text-lg font-semibold mb-2">Your Referrals</h3>
      <div className="border rounded-lg divide-y max-w-2xl">
        {referrals?.length === 0 && (
          <div className="p-4 text-sm text-gray-400 text-center">No referrals yet — share your link to get started</div>
        )}
        {referrals?.map((r) => (
          <div key={r._id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {r.referredUser?.firstName ? `${r.referredUser.firstName} ${r.referredUser.lastName || ""}` : "A new customer"}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">{new Date(r.createdAt).toLocaleString()}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_LABEL[r.status]?.cls || "bg-gray-50 text-gray-600"}`}>
              {STATUS_LABEL[r.status]?.label || r.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
