import { redirect } from "next/navigation";

/** Lots are bought on MarketSpace now: old links open its Farmers Produce view. */
export default function LotsPage() {
  redirect("/marketspace?view=produce");
}
