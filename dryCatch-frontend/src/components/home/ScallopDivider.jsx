import { useId } from "react";

// Decorative scalloped-edge divider — the repeating semicircle "wave" border
// nuts.com uses between colour blocks.
//   baseColor — fills the strip everywhere except the bumps; should match
//               the colour block this divider is physically touching/blending into.
//   bumpColor — colour of the semicircle bumps; should match the OTHER
//               (adjacent) colour block, so the wave looks like it's cut from it.
//   bumpsAt   — "top" (use above a colour block) or "bottom" (use below it).
export default function ScallopDivider({ baseColor = "#ffffff", bumpColor = "#E8A33D", bumpsAt = "top", size = 20 }) {
  const uid = useId().replace(/[:]/g, "");
  const patternId = `scallop-${uid}`;
  // No viewBox: the SVG works in real pixels so the pattern tiles every
  // `bump` px across the full page width (many small scallops, not one
  // stretched wave).
  const bump = size * 2; // each scallop is twice as wide as the strip is tall
  const cy = bumpsAt === "top" ? 0 : size;

  return (
    <svg
      className="block w-full"
      style={{ height: size, background: baseColor }}
      aria-hidden="true"
    >
      <defs>
        <pattern id={patternId} width={bump} height={size} patternUnits="userSpaceOnUse">
          <circle cx={bump / 2} cy={cy} r={size * 1.02} fill={bumpColor} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
