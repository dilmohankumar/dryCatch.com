export default function RichTextBlock({ data = {} }) {
  const content = data.content;
  if (!content) return null;

  // `content` is described in blockRegistry.js as "structured rich-text
  // JSON, sanitized separately" — we don't know its exact shape, so accept
  // either a plain string or an object with a `html`/`text` field, and
  // never dangerouslySetInnerHTML anything not already sanitized server-side.
  const text = typeof content === "string" ? content : content.text || content.html || "";
  if (!text) return null;

  return (
    <section className="max-w-3xl mx-auto px-4 py-8 prose prose-sm sm:prose-base">
      {typeof content === "object" && content.html ? (
        <div dangerouslySetInnerHTML={{ __html: content.html }} />
      ) : (
        <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{text}</p>
      )}
    </section>
  );
}
