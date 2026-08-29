import { resolveImageUrl } from "../cmsUtils.js";

export default function HeroBlock({ data = {} }) {
  const { title, subtitle, cta, ctaUrl } = data;
  const imageUrl = resolveImageUrl(data.image);
  const mobileImageUrl = resolveImageUrl(data.mobileImage);

  if (!title && !imageUrl) return null;

  return (
    <section className="relative w-full overflow-hidden bg-gray-100">
      {imageUrl && (
        <picture>
          {mobileImageUrl && <source media="(max-width: 640px)" srcSet={mobileImageUrl} />}
          <img src={imageUrl} alt={title || ""} className="w-full h-[280px] sm:h-[420px] object-cover" />
        </picture>
      )}
      <div className={`${imageUrl ? "absolute inset-0" : ""} flex flex-col items-center justify-center text-center px-4 ${imageUrl ? "bg-black/30 text-white" : "py-16 text-gray-900"}`}>
        {title && <h1 className="text-2xl sm:text-4xl font-extrabold mb-2">{title}</h1>}
        {subtitle && <p className="text-sm sm:text-lg mb-4 max-w-xl">{subtitle}</p>}
        {cta && ctaUrl && (
          <a
            href={ctaUrl}
            className="inline-block bg-[#1A3A5C] text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-[#142d47] transition"
          >
            {cta}
          </a>
        )}
      </div>
    </section>
  );
}
