import { useState, useEffect } from "react";
import { addressAPI } from "../../utils/api";

const EMPTY = { fullName: "", phone: "", addressLine1: "", addressLine2: "", landmark: "", city: "", state: "", postalCode: "", country: "India" };

export default function Addresses() {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const { addresses } = await addressAPI.getAll();
      setAddresses(addresses);
    } catch (err) {
      setError(err.message || "Unable to load your addresses.");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (addr) => {
    setForm({
      fullName: addr.fullName || "",
      phone: addr.phone || "",
      addressLine1: addr.addressLine1 || "",
      addressLine2: addr.addressLine2 || "",
      landmark: addr.landmark || "",
      city: addr.city || "",
      state: addr.state || "",
      postalCode: addr.postalCode || "",
      country: addr.country || "India",
    });
    setEditingId(addr._id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      if (editingId) {
        const { address } = await addressAPI.update(editingId, form);
        setAddresses((prev) => prev.map((a) => (a._id === editingId ? address : a)));
      } else {
        const { address } = await addressAPI.create(form);
        setAddresses((prev) => [address, ...prev]);
      }
      cancelForm();
    } catch (err) {
      setError(err.message || "Unable to save this address. Please check your details and try again.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this address?")) return;
    try {
      await addressAPI.delete(id);
      await load();
    } catch (err) {
      setError(err.message || "Unable to remove this address.");
    }
  };

  const handleSetDefault = async (id, type) => {
    try {
      await addressAPI.setDefault(id, type);
      await load();
    } catch (err) {
      setError(err.message || "Unable to update the default address.");
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading addresses...</div>;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">Addresses</h2>
          <p className="text-sm text-gray-500">Manage your shipping and billing addresses</p>
        </div>
        <button
          onClick={() => (showForm ? cancelForm() : setShowForm(true))}
          className="px-4 py-2 bg-[#1A3A5C] text-white rounded-lg hover:bg-[#142d47]"
        >
          {showForm ? "Cancel" : "+ Add Address"}
        </button>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input id="fullName" required autoComplete="name" value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input id="phone" type="tel" autoComplete="tel" value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="addressLine1" className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
            <input id="addressLine1" required autoComplete="address-line1" value={form.addressLine1}
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="addressLine2" className="block text-sm font-medium text-gray-700 mb-1">Address Line 2 (optional)</label>
            <input id="addressLine2" autoComplete="address-line2" value={form.addressLine2}
              onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div>
            <label htmlFor="landmark" className="block text-sm font-medium text-gray-700 mb-1">Landmark (optional)</label>
            <input id="landmark" value={form.landmark}
              onChange={(e) => setForm({ ...form, landmark: e.target.value })}
              className="w-full border rounded-lg px-3 py-2" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <input id="city" required autoComplete="address-level2" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
              <input id="state" required autoComplete="address-level1" value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">Postal Code</label>
              <input id="postalCode" required autoComplete="postal-code" value={form.postalCode}
                onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input id="country" autoComplete="country-name" value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full border rounded-lg px-3 py-2" />
            </div>
          </div>
          <button type="submit" className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
            {editingId ? "Save Address" : "Add Address"}
          </button>
        </form>
      )}

      {addresses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((addr) => (
            <div key={addr._id} className="p-4 border rounded-lg bg-gray-50 relative">
              <div className="absolute top-2 right-2 flex gap-1">
                {addr.isDefaultShipping && (
                  <span className="text-xs bg-[#1A3A5C] text-white px-2 py-0.5 rounded">Default Shipping</span>
                )}
                {addr.isDefaultBilling && (
                  <span className="text-xs bg-gray-600 text-white px-2 py-0.5 rounded">Default Billing</span>
                )}
              </div>
              <p className="font-semibold">{addr.fullName}</p>
              <p className="text-gray-600 text-sm">
                {addr.addressLine1}{addr.addressLine2 ? `, ${addr.addressLine2}` : ""}
              </p>
              <p className="text-gray-600 text-sm">
                {addr.city}, {addr.state} {addr.postalCode}
              </p>
              <div className="flex flex-wrap gap-3 mt-3 text-sm">
                <button onClick={() => startEdit(addr)} className="text-[#1A3A5C] hover:underline">Edit</button>
                {!addr.isDefaultShipping && (
                  <button onClick={() => handleSetDefault(addr._id, "shipping")} className="text-[#1A3A5C] hover:underline">
                    Set default shipping
                  </button>
                )}
                {!addr.isDefaultBilling && (
                  <button onClick={() => handleSetDefault(addr._id, "billing")} className="text-[#1A3A5C] hover:underline">
                    Set default billing
                  </button>
                )}
                <button onClick={() => handleDelete(addr._id)} className="text-red-600 hover:underline">Remove</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500">No addresses added yet</p>
      )}
    </div>
  );
}
