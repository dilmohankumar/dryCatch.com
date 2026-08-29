// Backend NOTE: contentApiService.js's resolveBlocks() does not resolve
// `testimonials.reviewIds` into real Review documents at all (no query for
// it exists in that file, unlike productGrid/categoryGrid/banner/faq) — it
// passes through as a bare array of ids. There is currently no way for the
// storefront to render actual review content from this block; we render
// nothing rather than showing raw ObjectId strings as fake testimonials.
export default function TestimonialsBlock({ data = {} }) {
  const reviewIds = Array.isArray(data.reviewIds) ? data.reviewIds : [];
  // Defensive: if a future backend change starts sending resolved objects
  // (with a `body`/`title`/`author` shape) instead of bare ids, render them.
  const resolvedReviews = reviewIds.filter((r) => r && typeof r === "object" && (r.body || r.title));
  if (resolvedReviews.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-10">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5 text-center">{data.heading}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {resolvedReviews.map((r, i) => (
          <div key={r._id || i} className="bg-gray-50 rounded-xl p-4">
            {r.title && <p className="font-semibold text-sm text-gray-900 mb-1">{r.title}</p>}
            {r.body && <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>}
            {r.author && <p className="text-xs text-gray-400 mt-2">— {r.author}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
