import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { contentAPI } from "../../../utils/api.js";
import { resolveImageUrl } from "../cmsUtils.js";

// blogGrid is the one block type NOT pre-resolved by the backend
// (docs/cms.md's resolveBlocks only handles productGrid/categoryGrid/
// collectionGrid/banner/faq/reviewSummary) — it only carries
// { heading, category, limit }, so this block fetches its own posts.
export default function BlogGridBlock({ data = {} }) {
  const [posts, setPosts] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    contentAPI
      .getBlogPosts({ category: data.category, limit: data.limit || 6 })
      .then((res) => {
        if (!cancelled) setPosts(res.posts || []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [data.category, data.limit]);

  if (!loaded || posts.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-4 py-8">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">{data.heading}</h2>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {posts.map((post) => {
          const imageUrl = resolveImageUrl(post.featuredImage);
          return (
            <Link key={post._id || post.slug} to={`/blog/${post.slug}`} className="block group">
              {imageUrl && (
                <div className="h-40 rounded-xl overflow-hidden bg-gray-100 mb-2">
                  <img src={imageUrl} alt={post.title || ""} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
              )}
              <h3 className="text-sm font-bold text-gray-900 group-hover:text-[#1A3A5C]">{post.title}</h3>
              {post.excerpt && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
