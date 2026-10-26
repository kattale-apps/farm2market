import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";
import { ugandaDateFromInstant } from "../../../../convex/exportMarketsShared";

/**
 * Link previews (WhatsApp, Facebook) for a shared or scanned post. They use
 * the visitor's view, so a preview never shows more than a visitor sees.
 */
export async function generateMetadata({ params }: { params: { cardId: string } }): Promise<Metadata> {
  const fallback = { title: "MarketSpace | Farm2Market Uganda" };
  try {
    const card = await fetchQuery(api.marketspace.cardDetail, {
      cardId: params.cardId,
      now: Date.now() + 3 * 60 * 60 * 1000,
      today: ugandaDateFromInstant(Date.now()),
    });
    if (!card) return fallback;
    const title = `${card.kind === "wanted" ? "Wanted: " : ""}${card.title} · ${card.district || "Uganda"}`;
    const bands = [card.priceBand, card.quantityBand].filter(Boolean).join(" · ");
    const seller = card.sellerCategory.toLowerCase();
    const description = `${bands ? `${bands}. ` : ""}From ${/^[aeiou]/.test(seller) ? "an" : "a"} ${seller} on Farm2Market MarketSpace. Pay safely through the app.`;
    return {
      title: `${title} | MarketSpace`,
      description,
      openGraph: { title, description, images: card.photoUrls[0] ? [{ url: card.photoUrls[0] }] : undefined, type: "website" },
    };
  } catch {
    return fallback;
  }
}

export default function CardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
