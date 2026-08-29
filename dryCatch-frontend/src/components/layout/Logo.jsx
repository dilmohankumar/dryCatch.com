// dryCatch wordmark — script-style logo + playful coastal characters,
// mirroring the nuts.com logo treatment (hand lettering + mascots).
export default function Logo({ className = "", showCharacters = true }) {
  return (
    <span className={`inline-flex items-end gap-1.5 sm:gap-2 select-none ${className}`}>
      <span className="font-logo text-[1.65rem] sm:text-[2.05rem] leading-none tracking-tight text-gray-900">
        dryCatch
      </span>
      {showCharacters && (
        <span className="hidden sm:inline-flex items-end gap-0.5 pb-0.5" aria-hidden="true">
          <span className="text-lg leading-none drop-shadow-sm">🦐</span>
          <span className="text-base leading-none -ml-0.5 drop-shadow-sm">🐟</span>
          <span className="text-lg leading-none -ml-0.5 drop-shadow-sm">🦑</span>
          <span className="text-base leading-none -ml-0.5 drop-shadow-sm">🌶️</span>
        </span>
      )}
    </span>
  );
}
