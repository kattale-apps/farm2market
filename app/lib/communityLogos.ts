/**
 * Shared community logo resolution.
 *
 * Communities may store a `logoPath` (or `qrLogoUrl`) in the DB.
 * As a fallback, we map well-known community names to their static
 * logos in /public.
 */

const KNOWN_LOGOS: Array<{ pattern: RegExp; logo: string }> = [
  { pattern: /agrofresh/i, logo: "/agrofreshlogo.png" },
  { pattern: /bio[\s-]?farm/i, logo: "/biofarmlogo.jpeg" },
  { pattern: /dei[\s_]?(agro|cassava)/i, logo: "/deilogo.png" },
];

/**
 * Resolve a community logo URL.
 *
 * Priority:
 *  1. `logoPath` persisted on the community document
 *  2. `qrLogoUrl` (set during QR community creation)
 *  3. Known-name mapping (static files in /public)
 *  4. `undefined` – caller should render a fallback initial
 */
export function resolveCommunityLogo(
  community: {
    name?: string;
    logoPath?: string;
    qrLogoUrl?: string;
  } | null | undefined,
): string | undefined {
  if (!community) return undefined;

  // DB-stored logo takes priority
  if (community.logoPath) return community.logoPath;
  if (community.qrLogoUrl) return community.qrLogoUrl;

  // Fallback: match against known community names
  const name = community.name || "";
  for (const entry of KNOWN_LOGOS) {
    if (entry.pattern.test(name)) return entry.logo;
  }

  return undefined;
}
