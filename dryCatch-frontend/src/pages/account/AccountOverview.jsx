const CARDS = [
  { key: "personal", title: "Personal Information", desc: "Manage your account details" },
  { key: "addresses", title: "Addresses", desc: "Manage shipping and billing addresses" },
  { key: "wishlist", title: "Wishlist", desc: "Your saved products" },
  { key: "security", title: "Security", desc: "Password & sessions" },
  { key: "notifications", title: "Notifications", desc: "Order, marketing, and alert preferences" },
  { key: "privacy", title: "Privacy", desc: "Data and account controls" },
];

export default function AccountOverview({ user, onNavigate }) {
  return (
    <div>
      <p className="text-gray-600 mb-6">Hello, {user.firstName}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((c) => (
          <button
            key={c.key}
            onClick={() => onNavigate(c.key)}
            className="text-left p-5 border rounded-lg bg-white hover:border-[#1A3A5C] hover:shadow-sm transition"
          >
            <p className="font-semibold text-lg">{c.title}</p>
            <p className="text-sm text-gray-500 mt-1">{c.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
