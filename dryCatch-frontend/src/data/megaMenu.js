import dryPrawnsImg from "../assets/Dry-Prawns.jpg";
import bombayDuckImg from "../assets/bombay-duck.jpg";

// Mega-menu content for each primary nav item.
// Clicking any link redirects to a category rough page with the right filter.
export const MEGA_MENUS = {
  "dry-prawns": {
    slug: "dry-prawns",
    label: "Dry Prawns",
    filter: "Prawns",
    description: "Sun-dried prawns from India's coastal fishing communities — intense umami, zero chemicals.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Best Sellers", filter: "Prawns", tag: "bestseller" },
          { label: "Organic", filter: "Prawns" },
          { label: "Karandi (Small)", filter: "Prawns" },
          { label: "Jumbo Prawns", filter: "Prawns" },
        ],
      },
      {
        title: "Shop by Size",
        links: [
          { label: "Shop All", filter: "Prawns" },
          { label: "200 g packs", filter: "Prawns" },
          { label: "500 g packs", filter: "Prawns" },
          { label: "1 kg family packs", filter: "Prawns" },
        ],
      },
      {
        title: "How it's Made",
        links: [
          { label: "Sun-Dried", filter: "Prawns" },
          { label: "Salt-Cured", filter: "Prawns" },
          { label: "No Preservatives", filter: "Prawns" },
        ],
      },
      {
        title: "Use For",
        links: [
          { label: "Curries", filter: "Prawns" },
          { label: "Chutneys", filter: "Prawns" },
          { label: "Rice dishes", filter: "Prawns" },
        ],
      },
    ],
    promos: [
      { title: "Best Selling Prawns", subtitle: "TOP CATCH", image: dryPrawnsImg, filter: "Prawns", tag: "bestseller" },
      { title: "Organic Dry Prawns", subtitle: "CHEMICAL FREE", image: dryPrawnsImg, filter: "Prawns" },
    ],
  },

  "dry-fish": {
    slug: "dry-fish",
    label: "Dry Fish",
    filter: "Bombay Duck",
    description: "Bombay Duck, mackerel, sardines and more — traditionally sun-dried and vacuum sealed.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Best Sellers", filter: "Bombay Duck", tag: "bestseller" },
          { label: "Bombay Duck", filter: "Bombay Duck" },
          { label: "Mackerel", filter: "Mackerel" },
          { label: "Sardines", filter: "Sardines" },
        ],
      },
      {
        title: "Fish Types",
        links: [
          { label: "Shop All Dry Fish", filter: "Bombay Duck" },
          { label: "Anchovies", filter: "Anchovies" },
          { label: "Bombil", filter: "Bombay Duck" },
          { label: "Bangda", filter: "Mackerel" },
        ],
      },
      {
        title: "Roast / Cure",
        links: [
          { label: "Sun-Dried", filter: "Bombay Duck" },
          { label: "Lightly Salted", filter: "Bombay Duck" },
          { label: "Unsalted", filter: "Bombay Duck" },
        ],
      },
      {
        title: "Pack Size",
        links: [
          { label: "Trial Size", filter: "Bombay Duck" },
          { label: "Family Pack", filter: "Bombay Duck" },
        ],
      },
    ],
    promos: [
      { title: "Best Selling Dry Fish", subtitle: "COASTAL CLASSIC", image: bombayDuckImg, filter: "Bombay Duck", tag: "bestseller" },
      { title: "Bombay Duck [Bombil]", subtitle: "MUMBAI FAVOURITE", image: bombayDuckImg, filter: "Bombay Duck" },
    ],
  },

  "gift-hampers": {
    slug: "gift-hampers",
    label: "Gift Hampers",
    filter: "Combo Packs",
    description: "Ready-to-gift coastal boxes — perfect for festivals, corporate gifting, and care packages.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Best Sellers", filter: "Combo Packs", tag: "bestseller" },
          { label: "Festival Boxes", filter: "Combo Packs" },
          { label: "Corporate Gifts", filter: "Combo Packs" },
        ],
      },
      {
        title: "By Occasion",
        links: [
          { label: "Housewarming", filter: "Combo Packs" },
          { label: "Diwali / Onam", filter: "Combo Packs" },
          { label: "Thank You Gifts", filter: "Combo Packs" },
        ],
      },
      {
        title: "Build Your Own",
        links: [
          { label: "Custom Hamper", filter: "Combo Packs" },
          { label: "Party Tray", filter: "Combo Packs" },
        ],
      },
    ],
    promos: [
      { title: "Coastal Gift Box", subtitle: "READY TO GIFT", image: dryPrawnsImg, filter: "Combo Packs" },
      { title: "Family Combo Pack", subtitle: "BEST VALUE", image: bombayDuckImg, filter: "Combo Packs" },
    ],
  },

  "dry-squid": {
    slug: "dry-squid",
    label: "Dry Squid",
    filter: "Squid",
    description: "Chewy, savoury sun-dried squid — a coastal snack classic.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Best Sellers", filter: "Squid", tag: "bestseller" },
          { label: "Whole Squid", filter: "Squid" },
          { label: "Squid Rings", filter: "Squid" },
        ],
      },
      {
        title: "Pack Size",
        links: [
          { label: "Shop All", filter: "Squid" },
          { label: "200 g", filter: "Squid" },
          { label: "500 g", filter: "Squid" },
        ],
      },
    ],
    promos: [
      { title: "Best Selling Squid", subtitle: "UMAMI HIT", image: dryPrawnsImg, filter: "Squid" },
    ],
  },

  "combo-packs": {
    slug: "combo-packs",
    label: "Combo Packs",
    filter: "Combo Packs",
    description: "Assorted coastal favourites bundled for better value.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Best Sellers", filter: "Combo Packs", tag: "bestseller" },
          { label: "Starter Combo", filter: "Combo Packs" },
          { label: "Family Combo", filter: "Combo Packs" },
        ],
      },
      {
        title: "Bundles",
        links: [
          { label: "Prawns + Fish", filter: "Combo Packs" },
          { label: "Full Coastal Box", filter: "Combo Packs" },
        ],
      },
    ],
    promos: [
      { title: "Coastal Combo Pack", subtitle: "SAVE MORE", image: bombayDuckImg, filter: "Combo Packs" },
    ],
  },

  "pickles-masala": {
    slug: "pickles-masala",
    label: "Pickles & Masala",
    filter: "Combo Packs",
    description: "Coastal pickles and spice mixes that pair perfectly with Dry Catch.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Fish Pickle", filter: "Combo Packs" },
          { label: "Prawn Pickle", filter: "Combo Packs" },
          { label: "Coastal Masala", filter: "Combo Packs" },
        ],
      },
      {
        title: "Pairings",
        links: [
          { label: "With Dry Prawns", filter: "Prawns" },
          { label: "With Dry Fish", filter: "Bombay Duck" },
        ],
      },
    ],
    promos: [
      { title: "Coastal Masala Kit", subtitle: "SPICE IT UP", image: dryPrawnsImg, filter: "Combo Packs" },
    ],
  },

  "featured-new": {
    slug: "featured-new",
    label: "Featured & New",
    filter: "All",
    description: "What's new on the coast — bestsellers, seasonal drops, and fresh arrivals.",
    columns: [
      {
        title: "Featured",
        links: [
          { label: "Best Sellers", filter: "All", tag: "bestseller" },
          { label: "New Arrivals", filter: "All", tag: "new" },
          { label: "On Sale", filter: "All", tag: "sale" },
        ],
      },
      {
        title: "Collections",
        links: [
          { label: "Coastal Hits", filter: "All" },
          { label: "Trial Sizes", filter: "All" },
          { label: "Organic", filter: "All" },
        ],
      },
    ],
    promos: [
      { title: "This Week's Hits", subtitle: "JUST IN", image: dryPrawnsImg, filter: "All", tag: "new" },
      { title: "Customer Favourites", subtitle: "BEST SELLERS", image: bombayDuckImg, filter: "All", tag: "bestseller" },
    ],
  },
};

export const PRIMARY_NAV = Object.values(MEGA_MENUS).map((m) => ({
  slug: m.slug,
  label: m.label,
  filter: m.filter,
}));

export function getMegaMenu(slug) {
  return MEGA_MENUS[slug] || null;
}
