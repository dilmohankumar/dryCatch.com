import { useEffect } from "react";
import AccountSidebar from "./AccountSidebar.jsx";

// Account pages hold private customer data — keep them out of search
// results. There's no react-helmet in this project (no need to add one for
// a single meta tag); a plain effect that adds/removes the tag is enough.
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => document.head.removeChild(meta);
  }, []);
}

export default function AccountLayout({ active, onNavigate, title, children }) {
  useNoIndex();

  return (
    <div className="max-w-6xl mx-auto p-6 flex-1 w-full">
      <h1 className="text-3xl font-bold mb-6">{title || "My Account"}</h1>
      <div className="flex flex-col md:flex-row gap-6">
        <AccountSidebar active={active} onNavigate={onNavigate} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
