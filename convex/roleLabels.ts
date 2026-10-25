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

export const STORAGE_OFFICER_LABEL = "Storage and Transport Officer";

export function roleLabel(role?: string | null): string {
  if (!role) return "";
  return (ROLE_LABELS as Record<string, string>)[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export function roleLabelPlural(role?: string | null): string {
  if (!role) return "";
  return (ROLE_LABELS_PLURAL as Record<string, string>)[role] ?? `${roleLabel(role)}s`;
}
