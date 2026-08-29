export default function CTABlock({ data = {} }) {
  const { heading, label, url, style } = data;
  if (!label || !url) return null;

  const isOutline = style === "outline";

  return (
    <section className="max-w-4xl mx-auto px-4 py-10 text-center">
      {heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{heading}</h2>}
      <a
        href={url}
        className={`inline-block text-sm font-bold px-6 py-3 rounded-full transition ${
          isOutline
            ? "border-2 border-[#1A3A5C] text-[#1A3A5C] hover:bg-[#EAF1FA]"
            : "bg-[#1A3A5C] text-white hover:bg-[#142d47]"
        }`}
      >
        {label}
      </a>
    </section>
  );
}
