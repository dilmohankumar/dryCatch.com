import { useState, useEffect } from "react";
import { growthAPI } from "../../utils/api.js";

const TYPE_LABEL = {
  EARN: "Earned",
  REDEEM: "Redeemed",
  EXPIRE: "Expired",
  ADJUST: "Adjustment",
  REFUND_REVERSAL: "Refund reversal",
};

export default function Loyalty() {
  const [balance, setBalance] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([growthAPI.getLoyaltyBalance(), growthAPI.getLoyaltyLedger({ limit: 30 })])
      .then(([b, l]) => {
        setBalance(b.balance);
        setLedger(l);
      })
      .catch((err) => setError(err.message || "Unable to load your loyalty points."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-400">Loading loyalty points...</div>;

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-1">Loyalty Points</h2>
      <p className="text-sm text-gray-500 mb-6">Earn points on delivered orders and redeem them for a discount at checkout.</p>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="max-w-sm mb-8 rounded-2xl bg-[#1A3A5C] text-white p-6">
        <p className="text-sm text-white/70">Your balance</p>
        <p className="text-3xl font-extrabold mt-1">{balance ?? 0} pts</p>
      </div>

      <h3 className="text-lg font-semibold mb-2">History</h3>
      <div className="border rounded-lg divide-y max-w-2xl">
        {ledger?.entries?.length === 0 && (
          <div className="p-4 text-sm text-gray-400 text-center">No loyalty activity yet</div>
        )}
        {ledger?.entries?.map((entry) => (
          <div key={entry._id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{TYPE_LABEL[entry.type] || entry.type}</p>
              {entry.note && <p className="text-xs text-gray-500">{entry.note}</p>}
              <p className="text-[11px] text-gray-400 mt-0.5">{new Date(entry.createdAt).toLocaleString()}</p>
            </div>
            <span className={`text-sm font-bold tabular-nums ${entry.points >= 0 ? "text-green-600" : "text-red-500"}`}>
              {entry.points >= 0 ? "+" : ""}{entry.points}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
