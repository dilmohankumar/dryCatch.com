import { useState } from "react";

export default function NewsletterBlock({ data = {} }) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // No newsletter-signup endpoint exists in docs/cms.md — this is a
    // presentation-only block; capture intent locally, don't fake an API call.
    setSubmitted(true);
  };

  return (
    <section className="bg-[#1A3A5C] text-white py-10 px-4 text-center">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold mb-2">{data.heading}</h2>}
      {data.subtext && <p className="text-sm text-white/80 mb-5 max-w-md mx-auto">{data.subtext}</p>}
      {submitted ? (
        <p className="text-sm font-semibold">Thanks — you're on the list!</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="flex-1 rounded-full px-4 py-2 text-sm text-gray-900 outline-none"
          />
          <button type="submit" className="bg-white text-[#1A3A5C] font-bold text-sm px-5 py-2 rounded-full hover:bg-gray-100 transition">
            Subscribe
          </button>
        </form>
      )}
    </section>
  );
}
