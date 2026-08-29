export default function Privacy({ onNavigate }) {
  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-1">Marketing Preferences</h2>
        <p className="text-sm text-gray-500 mb-4">
          Control which promotional messages you receive.
        </p>
        <button onClick={() => onNavigate("notifications")} className="text-[#1A3A5C] hover:underline text-sm">
          Manage notification preferences →
        </button>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-1">Your Data</h2>
        <p className="text-sm text-gray-500">
          A self-service data export isn't available yet — reach out to support if you'd like a
          copy of your account data, and we'll get it to you.
        </p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-1">Account Deactivation</h2>
        <p className="text-sm text-gray-500 mb-4">
          Deactivating your account is reversible and keeps your order history intact.
        </p>
        <button onClick={() => onNavigate("security")} className="text-[#1A3A5C] hover:underline text-sm">
          Go to Security →
        </button>
      </div>
    </div>
  );
}
