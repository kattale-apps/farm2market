/**
 * Header icons drawn as SVG so their colour can be controlled.
 *
 * The messages button used the ✉️ emoji (U+2709 U+FE0F). The variation selector
 * forces emoji presentation, which the font renders in its own fixed colours —
 * CSS `color` has no effect on it at all. Anything in the banner that has to
 * take a brand colour therefore has to be a real glyph or an SVG.
 *
 * Both use `currentColor`, so the colour lives in one place: the
 * `.f2m-slot-*` rules on the banner in app/page.tsx.
 */

export function EnvelopeIcon({ size = 34 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="2.5"
        y="5"
        width="19"
        height="14"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <path
        d="M3.5 7.5 12 13.2l8.5-5.7"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {[6, 12, 18].map((y) => (
        <path
          key={y}
          d={`M4 ${y}h16`}
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
