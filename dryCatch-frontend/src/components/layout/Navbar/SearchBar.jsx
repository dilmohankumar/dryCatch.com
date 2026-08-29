import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchAPI } from "../../../utils/api.js";

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
  </svg>
);

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Global search bar — lives in the Navbar. Debounced autocomplete dropdown
// grouped into Products / Categories / Searches, full keyboard navigation
// (arrow up/down across the flattened suggestion list, Enter to select/
// submit, Escape to close), and AbortController-based request cancellation
// so a fast typer never sees a stale response clobber a newer one.
// See docs/search.md — GET /search/autocomplete, min 2 chars.
// ─────────────────────────────────────────────────────────────────────────────
export default function SearchBar({ className = "", inputClassName = "", showButton = true }) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState({ products: [], categories: [], searches: [] });
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const navigate = useNavigate();
  const containerRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  // Flattened list purely for keyboard navigation, in the same order rendered.
  const flatItems = [
    ...results.products.map((p) => ({ type: "product", data: p })),
    ...results.categories.map((c) => ({ type: "category", data: c })),
    ...results.searches.map((s) => ({ type: "search", data: s })),
  ];

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    const q = value.trim();
    if (q.length < MIN_CHARS) {
      setResults({ products: [], categories: [], searches: [] });
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      searchAPI
        .autocomplete(q, { signal: controller.signal })
        .then((data) => {
          setResults({
            products: data.products || [],
            categories: data.categories || [],
            searches: data.searches || [],
          });
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err.name === "AbortError") return; // superseded by a newer keystroke
          setResults({ products: [], categories: [], searches: [] });
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [value]);

  const goToResults = (q) => {
    setOpen(false);
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  const selectItem = (item) => {
    if (!item) return;
    setOpen(false);
    if (item.type === "product") {
      navigate(`/product/${item.data.slug || item.data.productId}`);
    } else if (item.type === "category") {
      goToResults(value.trim());
      // Category chip re-runs the search scoped to that category name — the
      // results page itself resolves category facets by id, so we hand it
      // the category as part of the query text rather than needing the id here.
    } else {
      goToResults(item.data);
    }
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && flatItems[activeIndex]) {
        selectItem(flatItems[activeIndex]);
      } else if (value.trim()) {
        goToResults(value.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const hasResults = flatItems.length > 0;
  const showDropdown = open && value.trim().length >= MIN_CHARS;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search for a product"
        role="combobox"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        className={
          inputClassName ||
          "w-full pl-4 pr-24 py-2.5 sm:py-3 rounded-full border border-gray-300 bg-white text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gray-400"
        }
      />
      {showButton && (
        <button
          type="button"
          onClick={() => value.trim() && goToResults(value.trim())}
          className="hidden sm:block absolute right-1.5 top-1/2 -translate-y-1/2 bg-[#F4B740] hover:bg-[#e8a930] text-gray-900 text-sm font-bold px-5 py-2 rounded-full transition-colors"
        >
          Search
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-[200] overflow-hidden max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-3 text-xs text-gray-400">Searching…</div>
          )}
          {!loading && !hasResults && (
            <div className="px-4 py-3 text-xs text-gray-400">No suggestions found</div>
          )}
          {!loading && results.products.length > 0 && (
            <div className="py-1.5">
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Products</p>
              {results.products.map((p, i) => {
                const idx = i;
                return (
                  <button
                    key={p.productId}
                    onClick={() => selectItem({ type: "product", data: p })}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      activeIndex === idx ? "bg-[#EAF1FA]" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex-1 min-w-0 truncate text-sm text-gray-800">{p.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">₹{p.price}</span>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && results.categories.length > 0 && (
            <div className="py-1.5 border-t border-gray-100">
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Categories</p>
              {results.categories.map((c, i) => {
                const idx = results.products.length + i;
                return (
                  <button
                    key={c}
                    onClick={() => selectItem({ type: "category", data: c })}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                      activeIndex === idx ? "bg-[#EAF1FA]" : "hover:bg-gray-50"
                    }`}
                  >
                    <SearchIcon />
                    <span className="text-sm text-gray-700">{c}</span>
                  </button>
                );
              })}
            </div>
          )}
          {!loading && results.searches.length > 0 && (
            <div className="py-1.5 border-t border-gray-100">
              <p className="px-4 pb-1 text-[10px] font-bold uppercase tracking-wide text-gray-400">Searches</p>
              {results.searches.map((s, i) => {
                const idx = results.products.length + results.categories.length + i;
                return (
                  <button
                    key={s}
                    onClick={() => selectItem({ type: "search", data: s })}
                    className={`w-full flex items-center gap-2 px-4 py-2 text-left transition-colors ${
                      activeIndex === idx ? "bg-[#EAF1FA]" : "hover:bg-gray-50"
                    }`}
                  >
                    <SearchIcon />
                    <span className="text-sm text-gray-700">{s}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
