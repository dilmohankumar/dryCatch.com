import { resolveImageUrl, resolveAltText } from "../cmsUtils.js";

export default function ImageTextBlock({ data = {} }) {
  const imageUrl = resolveImageUrl(data.image);
  const content = typeof data.content === "string" ? data.content : data.content?.text || "";
  if (!imageUrl && !content && !data.heading) return null;

  return (
    <section className="max-w-5xl mx-auto px-4 py-10">
      <div className={`flex flex-col ${data.reverse ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-6 md:gap-10`}>
        {imageUrl && (
          <div className="w-full md:w-1/2">
            <img src={imageUrl} alt={resolveAltText(data.image, data.heading || "")} className="w-full h-auto rounded-xl object-cover" />
          </div>
        )}
        <div className="w-full md:w-1/2">
          {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">{data.heading}</h2>}
          {content && <p className="text-sm sm:text-base text-gray-600 leading-relaxed whitespace-pre-wrap">{content}</p>}
          {data.ctaUrl && (
            <a href={data.ctaUrl} className="inline-block mt-4 text-sm font-bold text-[#1A3A5C] hover:underline">
              Learn more →
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
