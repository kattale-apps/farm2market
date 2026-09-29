import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { SAFETY_NOTICE } from "../../../../convex/marketspaceShared";

/** Link previews (WhatsApp, Facebook) show the ad's title, price and first photo. */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const { id } = params;
  try {
    const ad = await fetchQuery(api.marketspace.getAd, { adId: id, now: Date.now() + 3 * 60 * 60 * 1000 });
    if (!ad) return { title: "Marketspace | Farm2Market Uganda" };
    const title = `${ad.kind === "wanted" ? "Wanted: " : ""}${ad.title} · ${ad.district}`;
    const price = ad.priceUGX !== null ? `UGX ${Math.round(ad.priceUGX).toLocaleString("en-UG")}${ad.priceUnit ? ` ${ad.priceUnit}` : ""}. ` : "";
    const description = `${price}${ad.categoryName} on Farm2Market Marketspace. ${SAFETY_NOTICE}`;
    return {
      title: `${title} | Marketspace`,
      description,
      openGraph: { title, description, images: ad.photoUrls[0] ? [{ url: ad.photoUrls[0] }] : undefined, type: "website" },
    };
  } catch {
    return { title: "Marketspace | Farm2Market Uganda" };
  }
}

export default function AdLayout({ children }: { children: React.ReactNode }) {
  return children;
}
