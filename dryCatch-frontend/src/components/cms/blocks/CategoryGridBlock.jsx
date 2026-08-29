import { Link } from "react-router-dom";
import { resolveImageUrl } from "../cmsUtils.js";

export default function CategoryGridBlock({ data = {} }) {
  const categories = Array.isArray(data.categories) ? data.categories : [];
  if (categories.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">{data.heading}</h2>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {categories.map((cat) => {
          if (!cat || !cat._id) return null;
          const imageUrl = resolveImageUrl(cat.image);
          return (
            <Link
              key={cat._id}
              to={`/category/${cat.slug || cat._id}`}
              className="flex flex-col items-center gap-2 text-center group"
            >
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                {imageUrl && <img src={imageUrl} alt={cat.name || ""} className="w-full h-full object-cover" />}
              </div>
              <span className="text-xs sm:text-sm font-semibold text-gray-800 group-hover:text-[#1A3A5C]">
                {cat.name}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
