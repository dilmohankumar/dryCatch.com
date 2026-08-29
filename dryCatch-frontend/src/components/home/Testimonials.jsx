import { useState } from "react";

const StarIcon = ({ filled }) => (
  <svg className={`w-4 h-4 ${filled ? "text-amber-400" : "text-gray-200"}`} fill={filled ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

// "Happy Snackers" equivalent — a small quote carousel with dot pagination.
export default function Testimonials({ testimonials = [] }) {
  const [page, setPage] = useState(0);
  const perPage = 3;
  const pageCount = Math.max(1, Math.ceil(testimonials.length / perPage));
  const visible = testimonials.slice(page * perPage, page * perPage + perPage);

  return (
    <section className="bg-[#FFF8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-14">
        <h2 className="font-display text-2xl sm:text-4xl font-black text-[#3E2205] text-center mb-6 sm:mb-10">
          Happy snackers
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
          {visible.map((t) => (
            <div key={t.name + t.product} className="bg-white rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} filled={i < t.rating} />)}
              </div>
              <p className="text-base sm:text-lg text-gray-800 leading-relaxed flex-1 font-medium">
                {t.quote}
              </p>
              <p className="text-sm text-gray-500">{t.name} — {t.location}</p>
              <div className="flex items-end justify-between gap-2">
                <p className="text-xs sm:text-sm text-gray-800 font-semibold underline underline-offset-2 self-center">{t.product}</p>
                <span className="text-4xl sm:text-5xl select-none" role="img" aria-hidden="true">{t.emoji}</span>
              </div>
            </div>
          ))}
        </div>

        {pageCount > 1 && (
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                aria-label={`Go to testimonials page ${i + 1}`}
                className={`h-2 rounded-full transition-all ${i === page ? "w-6 bg-[#1A3A5C]" : "w-2 bg-gray-300 hover:bg-gray-400"}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
