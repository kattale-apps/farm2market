import { v } from "convex/values";
import { query } from "./_generated/server";

export const getAllListingsLog = query({
  args: {
    adminId: v.id("users"),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    roleFilter: v.optional(v.string()),
    statusFilter: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await ctx.db.get(args.adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }
    const isSuperAdmin =
      (admin as any).adminLevel === "super" ||
      (admin as any).adminLevel === undefined;
    if (!isSuperAdmin) {
      throw new Error("Only super admins can view the listings log");
    }

    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, args.pageSize ?? 50));
    const roleFilter = args.roleFilter && args.roleFilter !== "all" ? args.roleFilter : null;
    const statusFilter = args.statusFilter && args.statusFilter !== "all" ? args.statusFilter : null;

    // Cap read volume: fetch a bounded window and paginate in-memory within that window.
    const roleWindowMultiplier = roleFilter ? 6 : 2;
    const windowSize = Math.min(2000, Math.max(page * pageSize * roleWindowMultiplier, pageSize));

    const listingsWindow = statusFilter
      ? await ctx.db
          .query("listings")
          .withIndex("by_status", (q) => q.eq("status", statusFilter as any))
          .order("desc")
          .take(windowSize)
      : await ctx.db
          .query("listings")
          .order("desc")
          .take(windowSize);

    const sellerIds = [...new Set(
      listingsWindow
        .map((l) => l.traderId || l.farmerId)
        .filter(Boolean)
        .map((id) => String(id))
    )] as string[];
    const sellerEntries = await Promise.all(
      sellerIds.map(async (id) => [id, await ctx.db.get(id as any)] as const)
    );
    const sellerMap = new Map<string, any>(sellerEntries);

    const filteredListings = roleFilter
      ? listingsWindow.filter((listing) => {
          const sellerId = String(listing.traderId || listing.farmerId || "");
          const seller = sellerMap.get(sellerId);
          const sellerRole = seller?.role || "unknown";
          return sellerRole === roleFilter;
        })
      : listingsWindow;

    const start = (page - 1) * pageSize;
    const pageListings = filteredListings.slice(start, start + pageSize);

    const items = [];
    for (const listing of pageListings) {
      const sellerId = String(listing.traderId || listing.farmerId || "");
      const seller = sellerMap.get(sellerId) || null;
      const sellerRole = seller?.role || "unknown";

      const purchases = await ctx.db
        .query("buyerListingPurchases")
        .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
        .collect();

      let availableUnits = listing.availableUnits;
      if (availableUnits === undefined || availableUnits === null) {
        const units = await ctx.db
          .query("listingUnits")
          .withIndex("by_listing", (q) => q.eq("listingId", listing._id))
          .collect();
        availableUnits = units.filter((u) => u.status === "available").length;
      }

      items.push({
        listingId: listing._id,
        utid: listing.utid,
        produceType: listing.produceType,
        productName: listing.productName,
        status: listing.status,
        listingMode: listing.listingMode || "unit",
        totalKilos: listing.totalKilos,
        totalUnits: listing.totalUnits,
        availableUnits,
        pricePerKilo: listing.pricePerKilo,
        pricePerUnit: listing.pricePerUnit,
        packagingTypeEnum: listing.packagingTypeEnum,
        collectionLocationText: listing.collectionLocationText,
        createdAt: listing.createdAt,
        sellerAlias: seller?.alias || seller?.phoneNumber || "Unknown",
        sellerRole,
        purchaseCount: purchases.length,
        totalRevenue: purchases.reduce((sum, p) => sum + (p.totalCost || 0), 0),
      });
    }

    const hasMore = filteredListings.length > start + items.length || listingsWindow.length === windowSize;
    const totalItems = filteredListings.length;
    const totalPages = hasMore ? page + 1 : Math.max(1, Math.ceil(totalItems / pageSize));

    return {
      items,
      totalItems,
      totalPages,
      currentPage: page,
      hasMore,
    };
  },
});
