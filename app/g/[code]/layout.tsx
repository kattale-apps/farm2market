import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../convex/_generated/api";
import { ugandaDateFromInstant } from "../../../convex/exportMarketsShared";

/**
 * Link previews (WhatsApp, Facebook) for a shared goods QR. They use the
 * visitor's view, so a preview never shows more than a visitor sees.
 */
export async function generateMetadata({ params }: { params: { code: string } }): Promise<Metadata> {
  const fallback = { title: "Farm2Market Uganda" };
  try {
    const info = await fetchQuery(api.goodsCodes.resolve, {
      code: params.code,
      now: Date.now() + 3 * 60 * 60 * 1000,
      today: ugandaDateFromInstant(Date.now()),
    });
    if (!info) return fallback;
    const title = `${info.goodLabel} · ${info.district || "Uganda"}`;
    const traced = info.trace && info.trace.farms > 0 ? `${info.trace.tracedPercent}% traces to ${info.trace.farms} farm${info.trace.farms === 1 ? "" : "s"}. ` : "";
    const seller = info.sellerCategory.toLowerCase();
    const description = `${traced}From ${/^[aeiou]/.test(seller) ? "an" : "a"} ${seller} on Farm2Market. Scan to see where it comes from.`;
    return {
      title: `${title} | Farm2Market`,
      description,
      openGraph: { title, description, images: info.photoUrl ? [{ url: info.photoUrl }] : undefined, type: "website" },
    };
  } catch {
    return fallback;
  }
}

export default function GoodsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
