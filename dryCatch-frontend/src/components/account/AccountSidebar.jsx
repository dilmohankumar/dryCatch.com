const SECTIONS = [
  { key: "overview", label: "Overview" },
  { key: "personal", label: "Personal Information" },
  { key: "addresses", label: "Addresses" },
  { key: "wishlist", label: "Wishlist" },
  { key: "reviews", label: "My Reviews" },
  { key: "loyalty", label: "Loyalty Points" },
  { key: "referrals", label: "Refer a Friend" },
  { key: "security", label: "Security" },
  { key: "notifications", label: "Notifications" },
  { key: "privacy", label: "Privacy" },
];

// Desktop: vertical sidebar. Mobile: horizontal scrollable pill nav — the
// spec explicitly calls out not forcing desktop sidebar behavior onto mobile.
export default function AccountSidebar({ active, onNavigate }) {
  return (
    <nav
      className="
        flex md:flex-col gap-1 overflow-x-auto md:overflow-visible
        md:w-56 md:flex-shrink-0 pb-2 md:pb-0 -mx-3 px-3 md:mx-0 md:px-0
      "
      aria-label="Account navigation"
    >
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          onClick={() => onNavigate(s.key)}
          aria-current={active === s.key ? "page" : undefined}
          className={`
            whitespace-nowrap text-left px-3 py-2 rounded-lg text-sm font-medium transition
            ${active === s.key
              ? "bg-[#1A3A5C] text-white"
              : "text-gray-600 hover:bg-gray-100"}
          `}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
