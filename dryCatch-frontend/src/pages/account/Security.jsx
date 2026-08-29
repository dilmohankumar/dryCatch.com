import { useState } from "react";
import { userAPI } from "../../utils/api";

export default function Security({ onDeactivated }) {
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordStatus, setPasswordStatus] = useState("idle");
  const [passwordError, setPasswordError] = useState("");

  const [revokeStatus, setRevokeStatus] = useState("idle");
  const [revokeMessage, setRevokeMessage] = useState("");

  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivatePassword, setDeactivatePassword] = useState("");
  const [deactivateError, setDeactivateError] = useState("");
  const [deactivateStatus, setDeactivateStatus] = useState("idle");

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }
    setPasswordStatus("saving");
    try {
      await userAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordStatus("success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPasswordStatus("idle"), 2000);
    } catch (err) {
      setPasswordStatus("idle");
      setPasswordError(err.message || "Unable to update your password. Please try again.");
    }
  };

  const handleRevokeOthers = async () => {
    setRevokeStatus("saving");
    setRevokeMessage("");
    try {
      await userAPI.revokeOtherSessions();
      setRevokeStatus("idle");
      setRevokeMessage("All other sessions have been logged out. This device stays signed in.");
    } catch (err) {
      setRevokeStatus("idle");
      setRevokeMessage(err.message || "Unable to log out other sessions.");
    }
  };

  const handleDeactivate = async (e) => {
    e.preventDefault();
    setDeactivateError("");
    setDeactivateStatus("saving");
    try {
      await userAPI.deactivate({ password: deactivatePassword });
      onDeactivated?.();
    } catch (err) {
      setDeactivateStatus("idle");
      setDeactivateError(err.message || "Unable to deactivate your account.");
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-1">Change Password</h2>
        <p className="text-sm text-gray-500 mb-6">Update the password used to sign in.</p>
        <form onSubmit={handleChangePassword} className="space-y-4 max-w-sm">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              id="currentPassword" type="password" required autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              id="newPassword" type="password" required minLength={8} autoComplete="new-password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input
              id="confirmPassword" type="password" required autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>
          {passwordError && <p className="text-red-600 text-sm">{passwordError}</p>}
          <button
            type="submit"
            disabled={passwordStatus === "saving"}
            className="w-full px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47] disabled:opacity-50"
          >
            {passwordStatus === "saving" ? "Updating..." : passwordStatus === "success" ? "Updated!" : "Update Password"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-xl font-semibold mb-1">Sessions</h2>
        <p className="text-sm text-gray-500 mb-4">
          This device is currently signed in. There's no per-device session list yet — this
          revokes every other refresh token issued for your account (any other browser/device),
          while keeping this one signed in.
        </p>
        {revokeMessage && <p className="text-sm text-gray-700 mb-3">{revokeMessage}</p>}
        <button
          onClick={handleRevokeOthers}
          disabled={revokeStatus === "saving"}
          className="px-4 py-2 border border-[#1A3A5C] text-[#1A3A5C] rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          {revokeStatus === "saving" ? "Working..." : "Log out all other devices"}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-red-200 p-6">
        <h2 className="text-xl font-semibold mb-1 text-red-700">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          Deactivating your account signs you out everywhere and blocks login. This does not
          delete your order history or reviews, and can be reversed by contacting support.
        </p>
        {!showDeactivate ? (
          <button
            onClick={() => setShowDeactivate(true)}
            className="px-4 py-2 border border-red-600 text-red-600 rounded-lg hover:bg-red-50"
          >
            Deactivate Account
          </button>
        ) : (
          <form onSubmit={handleDeactivate} className="space-y-3 max-w-sm">
            <label htmlFor="deactivatePassword" className="block text-sm font-medium text-gray-700">
              Confirm your password to deactivate
            </label>
            <input
              id="deactivatePassword" type="password" required autoComplete="current-password"
              value={deactivatePassword}
              onChange={(e) => setDeactivatePassword(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            />
            {deactivateError && <p className="text-red-600 text-sm">{deactivateError}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={deactivateStatus === "saving"}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deactivateStatus === "saving" ? "Deactivating..." : "Confirm Deactivation"}
              </button>
              <button type="button" onClick={() => setShowDeactivate(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
