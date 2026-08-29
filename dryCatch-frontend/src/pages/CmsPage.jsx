import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import BlockRenderer from "../components/cms/BlockRenderer.jsx";
import { contentAPI } from "../utils/api.js";
import { useSEO } from "../hooks/useSEO.js";

// Generic CMS-driven static page — mounted at /pages/:slug (see AppRoutes.jsx
// for why this route is namespaced rather than a bare /:slug). Fetches
// GET /content/pages/:slug, which 404s (PAGE_NOT_FOUND) for anything not
// currently published — that's treated as a normal, expected outcome here,
// not a crash.
export default function CmsPage() {
  const { slug } = useParams();
  const [page, setPage] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | notfound | error

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setPage(null);
    contentAPI
      .getPage(slug)
      .then((data) => {
        if (cancelled) return;
        setPage(data);
        setStatus("ok");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus(err?.code === "PAGE_NOT_FOUND" || err?.status === 404 ? "notfound" : "error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Phase 23 — centralized metadata (replaces the previous title-only effect).
  useSEO({
    title: page?.seo?.title || page?.title,
    description: page?.seo?.description,
    canonical: slug ? `/pages/${slug}` : undefined,
    robots: status === "ok" ? "index,follow" : "noindex,follow",
  });

  if (status === "loading") {
    return (
      <div className="flex-1 flex items-center justify-center py-24 text-gray-400 text-sm">
        Loading…
      </div>
    );
  }

  if (status === "notfound" || status === "error") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3 text-center px-4">
        <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
        <p className="text-sm text-gray-500">
          {status === "error"
            ? "Something went wrong loading this page. Please try again later."
            : "The page you're looking for doesn't exist or isn't published."}
        </p>
        <Link to="/" className="text-sm font-bold text-[#1A3A5C] hover:underline mt-2">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 w-full bg-white">
      <BlockRenderer blocks={page?.blocks || []} />
    </div>
  );
}
