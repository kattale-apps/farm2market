/**
 * What users see for each role. The stored role keys never change: "trader"
 * is shown as Exporter and "store" as Processor, and a junior admin in the
 * "store" category is a Storage and Transport Officer. Shared by the app and Convex so
 * notifications and screens use the same words.
 */

export const ROLE_LABELS = {
  farmer: "Farmer",
  store: "Processor",
  trader: "Exporter",
  buyer: "Buyer",
  transporter: "Transporter",
  vendor: "Vendor",
  admin: "Admin",
} as const;

export const ROLE_LABELS_PLURAL = {
  farmer: "Farmers",
  store: "Processors",
  trader: "Exporters",
  buyer: "Buyers",
  transporter: "Transporters",
  vendor: "Vendors",
  admin: "Admins",
} as const;

// Member roles in value-chain order: farm → processing → export → buyer.
export const VALUE_CHAIN_ROLES = ["farmer", "store", "trader", "buyer", "transporter", "vendor"] as const;

/**
 * The informer beside each category button at sign-up: who belongs in the
 * category and what it lets them do. Plain words, for first-time users.
 */
export const ROLE_INFO: Record<(typeof VALUE_CHAIN_ROLES)[number], { who: string; does: string }> = {
  farmer: {
    who: "You grow crops or keep animals, alone or in a farmer group.",
    does: "Sell your produce in the Farmers Produce Market, keep your farm records and take contract farming orders.",
  },
  store: {
    who: "Agro-processors: millers, hullers, dryers, stores and warehouses, roasters, packers and others who process or store produce.",
    does: "Buy from farmers, post your buying prices and sell processed produce to exporters.",
  },
  trader: {
    who: "Licensed exporters. Every exporter is a trader, but local traders who do not export join as a Vendor.",
    does: "Buy from farmers and processors, list export lots and sell to buyers abroad.",
  },
  buyer: {
    who: "Homes, shops, hotels, schools and companies that buy produce.",
    does: "Buy produce and fund farmers' crops in the Contract Farming Market.",
  },
  transporter: {
    who: "Trucks, pickups, motorbikes and other transport.",
    does: "Get delivery jobs moving produce for farmers, vendors and buyers.",
  },
  vendor: {
    who: "Market vendors, shops and local traders who buy and resell produce.",
    does: "Buy from farmers, post on MarketSpace and find transport.",
  },
};

export const STORAGE_OFFICER_LABEL = "Storage and Transport Officer";

export function roleLabel(role?: string | null): string {
  if (!role) return "";
  return (ROLE_LABELS as Record<string, string>)[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export function roleLabelPlural(role?: string | null): string {
  if (!role) return "";
  return (ROLE_LABELS_PLURAL as Record<string, string>)[role] ?? `${roleLabel(role)}s`;
}
