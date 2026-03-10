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

    const page = args.page ?? 1;
    const pageSize = args.pageSize ?? 50;

    // Fetch all listings sorted newest first
    const allListings = await ctx.db.query("listings").order("desc").collect();

    // Filter by status
    let filtered = allListings;
    if (args.statusFilter && args.statusFilter !== "all") {
      filtered = filtered.filter((l) => l.status === args.statusFilter);
    }

    // Join user data and filter by role
    const enriched = [];
    for (const listing of filtered) {
      const sellerId = listing.traderId || listing.farmerId;
      const seller = sellerId ? await ctx.db.get(sellerId) : null;
      const sellerRole = seller?.role || "unknown";

      if (args.roleFilter && args.roleFilter !== "all") {
        if (sellerRole !== args.roleFilter) continue;
      }

      // Get purchase count
      const purchases = await ctx.db
        .query("buyerListingPurchases")
        .filter((q) => q.eq(q.field("listingId"), listing._id))
        .collect();

      // Get available units count
      const units = await ctx.db
        .query("listingUnits")
        .filter((q) =>
          q.and(
            q.eq(q.field("listingId"), listing._id),
            q.eq(q.field("status"), "available")
          )
        )
        .collect();

      enriched.push({
        listingId: listing._id,
        utid: listing.utid,
        produceType: listing.produceType,
        productName: listing.productName,
        status: listing.status,
        listingMode: listing.listingMode || "unit",
        totalKilos: listing.totalKilos,
        totalUnits: listing.totalUnits,
        availableUnits: listing.availableUnits ?? units.length,
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

    const totalItems = enriched.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const start = (page - 1) * pageSize;
    const items = enriched.slice(start, start + pageSize);

    return {
      items,
      totalItems,
      totalPages,
      currentPage: page,
    };
  },
});
