// Reusable section title row used across the homepage — a heading with an
// optional subtitle on the left and an optional "View All" action on the right.
export default function SectionHeading({ title, subtitle, actionLabel, onAction, dark = false }) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4 sm:mb-6">
      <div>
        <h2 className={`font-display text-lg sm:text-2xl font-black ${dark ? "text-white" : "text-[#3E2205]"}`}>{title}</h2>
        {subtitle && (
          <p className={`text-xs sm:text-sm mt-1 ${dark ? "text-white/70" : "text-gray-500"}`}>{subtitle}</p>
        )}
      </div>
      {actionLabel && (
        <button
          onClick={onAction}
          className={`flex-shrink-0 text-xs sm:text-sm font-semibold underline-offset-2 hover:underline transition-colors ${
            dark ? "text-white" : "text-[#1A3A5C]"
          }`}
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}
