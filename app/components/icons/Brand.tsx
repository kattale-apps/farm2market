/**
 * Farm2Market brand marks.
 *
 * The official logo (a seedling growing from a coin in the soil) lives at
 * /icons/farm2market-logo.png. It stands for FarmCoin everywhere FarmCoin is
 * mentioned, and it sits inside the star-edged "verified" seal shown next to
 * verified accounts, the way a verified badge works on social apps.
 */

import React from "react";

export const FARM2MARKET_LOGO = "/icons/farm2market-logo.png";

/** FarmCoin icon: the Farm2Market logo, sized to sit inline with text. */
export function FarmCoinIcon({ size = 20, title = "FarmCoin" }: { size?: number; title?: string }) {
  return (
    <img
      src={FARM2MARKET_LOGO}
      alt={title}
      title={title}
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "middle", objectFit: "contain", flexShrink: 0 }}
    />
  );
}

/** A 12-point scalloped seal path centred in a 24x24 box. */
function sealPath(points = 12, outer = 11.6, inner = 9.6): string {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    parts.push(`${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${parts.join(" L")} Z`;
}
const SEAL = sealPath();

/**
 * Verified badge: the Farm2Market logo inside a star-edged seal. Compact
 * enough for the dashboard header on small phones.
 */
export function VerifiedBadge({ size = 26, title = "Verified by Farm2Market" }: { size?: number; title?: string }) {
  const id = React.useId().replace(/:/g, "");
  return (
    <span role="img" aria-label={title} title={title} style={{ display: "inline-flex", width: size, height: size, flexShrink: 0, verticalAlign: "middle" }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id={`seal-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#43a047" />
            <stop offset="1" stopColor="#1b5e20" />
          </linearGradient>
          <clipPath id={`clip-${id}`}>
            <circle cx="12" cy="12" r="7.6" />
          </clipPath>
        </defs>
        <path d={SEAL} fill={`url(#seal-${id})`} stroke="#fdd835" strokeWidth="0.9" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="8" fill="#fff" />
        <image href={FARM2MARKET_LOGO} x="4.2" y="4.2" width="15.6" height="15.6" clipPath={`url(#clip-${id})`} preserveAspectRatio="xMidYMid meet" />
      </svg>
    </span>
  );
}
