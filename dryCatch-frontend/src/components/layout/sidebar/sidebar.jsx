import { useState, useEffect } from "react";
import { categoriesAPI } from "../../../utils/api";

const ChevronDown = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);
const ChevronUp = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);
const XIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SORT_OPTIONS = [
  "Alphabetical",
  "Price (Low to High)",
  "Price (High to Low)",
  "Discount (High to Low)",
  "Popularity",
];

const ORIGINS = ["Locally Sourced", "Imported"];

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 py-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-[#1A3A5C] uppercase tracking-wider">{title}</span>
        {open ? <ChevronUp /> : <ChevronDown />}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function Sidebar({
  selectedSort = null,
  onSortChange = () => {},
  selectedCats = [],
  onCatChange = () => {},
  selectedOrigins = [],
  onOriginChange = () => {},
  onClearAll = () => {},
  open = false,           // controls mobile drawer; on desktop always visible
  onClose = () => {},
}) {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    categoriesAPI.getAll().then(({ categories }) => setCategories(categories || [])).catch(() => setCategories([]));
  }, []);

  // selectedCats holds category slugs (matches the backend's ?category= filter).
  const toggleCat = (slug) =>
    onCatChange(selectedCats.includes(slug)
      ? selectedCats.filter(c => c !== slug)
      : [...selectedCats, slug]);

  const toggleOrigin = (o) =>
    onOriginChange(selectedOrigins.includes(o)
      ? selectedOrigins.filter(x => x !== o)
      : [...selectedOrigins, o]);

  const activeCount =
    (selectedSort ? 1 : 0) + selectedCats.length + selectedOrigins.length;

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={[
          // ── Mobile: fixed drawer that slides in/out ──
          "fixed top-0 left-0 h-full z-40 bg-white shadow-xl w-64 flex flex-col",
          "transform transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          // ── Desktop (md+): static, in-flow, no shadow, natural width ──
          "md:static md:translate-x-0 md:shadow-none md:h-auto md:z-auto",
          "md:w-52 md:flex-shrink-0 md:flex md:flex-col",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-gray-900">Filters</h2>
            {activeCount > 0 && (
              <span className="bg-[#1A3A5C] text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeCount > 0 && (
              <button
                onClick={onClearAll}
                className="text-xs text-gray-400 hover:text-[#1A3A5C] transition-colors"
              >
                Clear all
              </button>
            )}
            {/* Close only on mobile */}
            <button onClick={onClose} className="md:hidden text-gray-400 hover:text-gray-700">
              <XIcon />
            </button>
          </div>
        </div>

        {/* Scrollable filters */}
        <div className="flex-1 overflow-y-auto px-5 md:overflow-visible">
          <Section title="Sort By">
            <ul className="space-y-2.5">
              {SORT_OPTIONS.map(opt => (
                <li
                  key={opt}
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => onSortChange(opt === selectedSort ? null : opt)}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${selectedSort === opt ? "border-[#1A3A5C] bg-[#1A3A5C]" : "border-gray-300 hover:border-[#1A3A5C]"}`}>
                    {selectedSort === opt && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="text-sm text-gray-600">{opt}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Category">
            <ul className="space-y-2.5">
              {categories.map(cat => (
                <li
                  key={cat._id}
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => toggleCat(cat.slug)}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${selectedCats.includes(cat.slug) ? "border-[#1A3A5C] bg-[#1A3A5C]" : "border-gray-300 hover:border-[#1A3A5C]"}`}>
                    {selectedCats.includes(cat.slug) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">{cat.name}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Origin">
            <ul className="space-y-2.5">
              {ORIGINS.map(o => (
                <li
                  key={o}
                  className="flex items-center gap-2.5 cursor-pointer"
                  onClick={() => toggleOrigin(o)}
                >
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all
                    ${selectedOrigins.includes(o) ? "border-[#E07B39] bg-[#E07B39]" : "border-gray-300 hover:border-[#E07B39]"}`}>
                    {selectedOrigins.includes(o) && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">{o}</span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        {/* Apply button — mobile only */}
        <div className="md:hidden px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="w-full bg-[#1A3A5C] text-white font-semibold py-2.5 rounded-full text-sm hover:bg-[#142d47] transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </aside>
    </>
  );
}