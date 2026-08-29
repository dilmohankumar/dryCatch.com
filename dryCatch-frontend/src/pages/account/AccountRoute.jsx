import { useNavigate, useLocation } from "react-router-dom";
import AccountLayout from "../../components/account/AccountLayout.jsx";
import AccountOverview from "./AccountOverview.jsx";
import PersonalInfo from "./PersonalInfo.jsx";
import Addresses from "./Addresses.jsx";
import Security from "./Security.jsx";
import Notifications from "./Notifications.jsx";
import Privacy from "./Privacy.jsx";
import MyReviews from "./MyReviews.jsx";
import Loyalty from "./Loyalty.jsx";
import Referrals from "./Referrals.jsx";
import { useSEO } from "../../hooks/useSEO.js";

const TITLES = {
  overview: "My Account",
  personal: "Personal Information",
  addresses: "Addresses",
  security: "Security",
  notifications: "Notifications",
  privacy: "Privacy",
  reviews: "My Reviews",
  loyalty: "Loyalty Points",
  referrals: "Refer a Friend",
};

export default function AccountRoute({ user, onUserUpdate, onAccountDeactivated }) {
  const navigate = useNavigate();
  const location = useLocation();
  const section = location.pathname.replace(/^\/account\/?/, "") || "overview";
  // Phase 23 — every /account/* page is private and user-specific; one
  // noindex here covers the whole section rather than repeating it per sub-page.
  useSEO({ title: `${TITLES[section] || "My Account"} | DryCatch`, robots: "noindex,nofollow" });

  const goTo = (key) => {
    if (key === "wishlist") return navigate("/wishlist");
    navigate(key === "overview" ? "/account" : `/account/${key}`);
  };

  let content;
  switch (section) {
    case "personal":
      content = <PersonalInfo user={user} onUserUpdate={onUserUpdate} />;
      break;
    case "addresses":
      content = <Addresses />;
      break;
    case "security":
      content = <Security onDeactivated={onAccountDeactivated} />;
      break;
    case "notifications":
      content = <Notifications />;
      break;
    case "privacy":
      content = <Privacy onNavigate={goTo} />;
      break;
    case "reviews":
      content = <MyReviews />;
      break;
    case "loyalty":
      content = <Loyalty />;
      break;
    case "referrals":
      content = <Referrals />;
      break;
    default:
      content = <AccountOverview user={user} onNavigate={goTo} />;
  }

  return (
    <AccountLayout active={section} onNavigate={goTo} title={TITLES[section] || "My Account"}>
      {content}
    </AccountLayout>
  );
}
