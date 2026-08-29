// ─────────────────────────────────────────────────────────────────────────────
// DEMO / MOCK DATA for the homepage.
// Everything here is placeholder content for the frontend-first build.
// Replace with real API responses once the backend catalog is ready — the
// shape of each object is intentionally kept simple & stable so swapping the
// data source later requires no component changes.
// ─────────────────────────────────────────────────────────────────────────────

import dryPrawnsImg from "../assets/Dry-Prawns.jpg";
import bombayDuckImg from "../assets/bombay-duck.jpg";

export const NAV_CATEGORIES = [
  { label: "Dry Prawns",     emoji: "🦐", bg: "#F5EDE0", filter: "Prawns",      slug: "dry-prawns",     image: dryPrawnsImg },
  { label: "Dry Fish",       emoji: "🐟", bg: "#F5EDE0", filter: "Bombay Duck", slug: "dry-fish",       image: bombayDuckImg },
  { label: "Pickles & Masala", emoji: "🌶️", bg: "#F5EDE0", filter: "Combo Packs", slug: "pickles-masala" },
  { label: "Combo Packs",    emoji: "🎁", bg: "#F5EDE0", filter: "Combo Packs", slug: "combo-packs" },
  { label: "Dry Squid",      emoji: "🦑", bg: "#F5EDE0", filter: "Squid",       slug: "dry-squid" },
  { label: "Gift Hampers",   emoji: "🧺", bg: "#F5EDE0", filter: "Combo Packs", slug: "gift-hampers" },
];

export { PRIMARY_NAV } from "./megaMenu";

// Secondary beige utility strip under primary nav
export const SECONDARY_NAV = [
  { label: "New", slug: "featured-new", filter: "All", tag: "new" },
  { label: "Best Sellers", slug: "featured-new", filter: "All", tag: "bestseller" },
  { label: "Trial Sizes", slug: "featured-new", filter: "All" },
  { label: "Sale", slug: "featured-new", filter: "All", tag: "sale" },
  { label: "Sun-Dried", slug: "dry-fish", filter: "Bombay Duck" },
  { label: "Organic", slug: "featured-new", filter: "All" },
  { label: "Coastal Hits", slug: "featured-new", filter: "All" },
  { label: "Corporate Gifts", slug: "gift-hampers", filter: "Combo Packs" },
];

export const TRUST_POINTS = [
  { icon: "🚚", title: "Delivered Fast & Fresh", subtitle: "Vacuum-sealed, next-day dispatch" },
  { icon: "🌊", title: "Vast Selection", subtitle: "Prawns, fish, squid & more" },
  { icon: "✅", title: "Exceptional Quality", subtitle: "FSSAI certified every batch" },
  { icon: "☀️", title: "Sun-Dried Naturally", subtitle: "No chemicals or preservatives" },
];

export const CATCH_TYPES = [
  { label: "Prawns",      emoji: "🦐", bg: "#1A3A5C", filter: "Prawns",      slug: "dry-prawns", image: dryPrawnsImg },
  { label: "Bombay Duck", emoji: "🐟", bg: "#E07B39", filter: "Bombay Duck", slug: "dry-fish",   image: bombayDuckImg },
  { label: "Anchovies",   emoji: "🐠", bg: "#2C5F4A", filter: "Anchovies",   slug: "dry-fish",   labelNav: "Anchovies" },
  { label: "Sardines",    emoji: "🐡", bg: "#B23A48", filter: "Sardines",    slug: "dry-fish",   labelNav: "Sardines" },
  { label: "Mackerel",    emoji: "🐟", bg: "#3E6990", filter: "Mackerel",    slug: "dry-fish",   labelNav: "Mackerel" },
  { label: "Squid",       emoji: "🦑", bg: "#8A5A44", filter: "Squid",       slug: "dry-squid" },
];

export const TESTIMONIALS = [
  { name: "Anitha", location: "Kochi, KL", rating: 5, quote: "The dry prawns taste exactly like the ones my grandmother used to sun-dry at home. Incredible flavour.", product: "Dry Prawns [Karandi]", emoji: "🦐" },
  { name: "Rakesh", location: "Mumbai, MH", rating: 5, quote: "Bombil arrived vacuum-sealed and crispy-fried perfectly. Best Bombay Duck I've had outside a Mumbai market.", product: "Bombay Duck [Bombil]", emoji: "🐟" },
  { name: "Divya", location: "Mangalore, KA", rating: 4, quote: "Ordered the combo pack for my parents — they said it tastes fresher than what's sold locally.", product: "Coastal Combo Pack", emoji: "🎁" },
  { name: "Farhan", location: "Bengaluru, KA", rating: 5, quote: "Been ordering the mackerel every month now. Consistent quality and quick delivery every time.", product: "Dry Mackerel [Bangda]", emoji: "🐟" },
];

// Placeholder press mentions — generic invented names, not real outlets.
export const FEATURED_IN = [
  { outlet: "The Coastal Times", quote: "Dry Catch fills the seafood-shaped hole in our pantry." },
  { outlet: "Foodie Weekly", quote: "The quality and reliability you get when you send loved ones a coastal gift box." },
  { outlet: "Daily Harbor", quote: "Clever, chemical-free snacking straight from the coast." },
];

export const STATS = [
  { value: "25,000+", label: "Happy Households" },
  { value: "4.8 / 5", label: "Average Rating" },
  { value: "48 hrs", label: "Coast to Doorstep" },
  { value: "100%", label: "Chemical Free" },
];
