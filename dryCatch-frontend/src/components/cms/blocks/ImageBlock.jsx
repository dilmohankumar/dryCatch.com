import { resolveImageUrl, resolveAltText } from "../cmsUtils.js";

export default function ImageBlock({ data = {} }) {
  const imageUrl = resolveImageUrl(data.image);
  if (!imageUrl) return null;
  const alt = resolveAltText(data.image, data.altText || "");

  const img = <img src={imageUrl} alt={alt} className="w-full h-auto object-cover" />;

  return (
    <section className="max-w-5xl mx-auto px-4 py-6">
      {data.link ? <a href={data.link}>{img}</a> : img}
    </section>
  );
}
