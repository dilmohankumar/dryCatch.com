import { useState } from "react";

export default function FAQBlock({ data = {} }) {
  const faqs = Array.isArray(data.faqs) ? data.faqs.filter((f) => f && f.question) : [];
  const [openId, setOpenId] = useState(null);
  if (faqs.length === 0) return null;

  return (
    <section className="max-w-3xl mx-auto px-4 py-10">
      {data.heading && <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-5">{data.heading}</h2>}
      <div className="divide-y divide-gray-100 border-t border-b border-gray-100">
        {faqs.map((faq) => {
          const isOpen = openId === faq._id;
          return (
            <div key={faq._id}>
              <button
                className="w-full flex items-center justify-between py-4 text-left"
                onClick={() => setOpenId(isOpen ? null : faq._id)}
              >
                <span className="font-semibold text-sm sm:text-base text-gray-900">{faq.question}</span>
                <span className="text-gray-400 text-lg">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && faq.answer && (
                <p className="pb-4 text-sm text-gray-600 whitespace-pre-wrap">{faq.answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
