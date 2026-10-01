"use client";

import { useEffect, useState } from "react";
import { getStoredToken, getStoredUser, type StoredUser } from "../../utils/authStorage";
import { fromStoredUgandaTime, getUgandaTime, inUgandaTime } from "../../utils/timeUtils";
import { UG_DISTRICTS } from "../../../convex/ugandaLocationsData";
import { whatsappNumber, SAFETY_NOTICE } from "../../../convex/marketspaceShared";

export { SAFETY_NOTICE };

export const FONT = '"Montserrat", sans-serif';
export const DISTRICTS: string[] = [...new Set(UG_DISTRICTS.map((d) => d.name))].sort((a, b) => a.localeCompare(b));

/** The ad card shape returned by the MarketSpace queries. */
export type AdCardData = {
  _id: string;
  utid: string;
  kind: "offer" | "wanted";
  title: string;
  description: string;
  priceUGX: number | null;
  priceUnit: string | null;
  negotiable: boolean;
  quantity: string | null;
  neededBy: string | null;
  district: string;
  locationDetail: string | null;
  contactPhone: string;
  photoUrls: string[];
  photoCount: number;
  groupId: string;
  groupName: string;
  groupIcon: string;
  groupColor: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  posterRole: string | null;
  status: string;
  expiresAt: number;
  createdAt: number;
};

/** Logged-in user and session token, or a guest. */
export function useMarketspaceSession() {
  const [state, setState] = useState<{ status: "loading" | "guest" | "user"; user: StoredUser | null; token: string | null }>({
    status: "loading",
    user: null,
    token: null,
  });
  useEffect(() => {
    let active = true;
    Promise.all([getStoredUser(), getStoredToken()])
      .then(([user, token]) => {
        if (!active) return;
        const t = token || user?.sessionToken || null;
        if (user?.userId && t) setState({ status: "user", user, token: t });
        else setState({ status: "guest", user: null, token: null });
      })
      .catch(() => active && setState({ status: "guest", user: null, token: null }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

/** Uganda time now, rounded down to the minute and refreshed each minute, for query args. */
export function useUgandaNow(): number {
  const tick = () => Math.floor(getUgandaTime() / 60000) * 60000;
  const [now, setNow] = useState(tick);
  useEffect(() => {
    const id = setInterval(() => setNow(tick()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function formatUGX(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString("en-UG")}`;
}

export function priceLine(ad: Pick<AdCardData, "kind" | "priceUGX" | "priceUnit" | "negotiable">): string {
  if (ad.priceUGX === null) return ad.negotiable ? "Price negotiable" : ad.kind === "wanted" ? "Budget open" : "";
  const main = `${formatUGX(ad.priceUGX)}${ad.priceUnit ? ` ${ad.priceUnit}` : ""}`;
  const prefix = ad.kind === "wanted" ? "Budget: " : "";
  return `${prefix}${main}${ad.negotiable ? " · negotiable" : ""}`;
}

/** "3 days ago" from a stored Uganda-time value. */
export function postedAgo(createdAt: number, now: number): string {
  const mins = Math.max(0, Math.floor((now - createdAt) / 60000));
  if (mins < 60) return mins <= 1 ? "just now" : `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function formatDate(storedUgandaTime: number): string {
  return new Date(fromStoredUgandaTime(storedUgandaTime)).toLocaleDateString("en-GB", inUgandaTime({ day: "numeric", month: "short", year: "numeric" }));
}

export function formatIsoDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function adLink(adId: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/marketspace/ad/${adId}`;
}

export function whatsappLink(ad: Pick<AdCardData, "_id" | "title" | "contactPhone" | "kind">): string {
  const text = ad.kind === "wanted" ? `Hello, I can supply what you asked for on Farm2Market MarketSpace: "${ad.title}" ${adLink(ad._id)}` : `Hello, I saw your ad on Farm2Market MarketSpace: "${ad.title}" ${adLink(ad._id)}`;
  return `https://wa.me/${whatsappNumber(ad.contactPhone)}?text=${encodeURIComponent(text)}`;
}

/** Pale tint of a hex colour, for card backgrounds. */
export function tint(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return `rgba(46,125,50,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}
