import { Link } from "react-router-dom";
import { resolveImageUrl } from "../cmsUtils.js";

export default function CollectionGridBlock({ data = {} }) {
  const collections = Array.isArray(data.collections) ? data.collections : [];
  if (collections.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">{data.heading}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {collections.map((col) => {
          if (!col || !col._id) return null;
          const imageUrl = resolveImageUrl(col.image);
          return (
            <Link
              key={col._id}
              to={`/shop?collection=${col.slug || col._id}`}
              className="relative rounded-xl overflow-hidden bg-gray-100 h-32 sm:h-40 flex items-end group"
            >
              {imageUrl && (
                <img src={imageUrl} alt={col.name || ""} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform" />
              )}
              <span className="relative z-10 w-full bg-black/40 text-white text-sm font-bold px-3 py-2">
                {col.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
