/**
 * PDF Generation Utilities
 * 
 * Note: Actual PDF generation happens client-side using jsPDF
 * This file provides backend utilities for storing PDF references
 */

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { verifyAdminRole } from "./auth";

/**
 * Store PDF reference for a delivery verification
 * PDF is generated client-side and uploaded/stored separately
 * This function links the PDF to the UTID
 */
export const storeDeliveryPDF = mutation({
  args: {
    adminId: v.id("users"),
    lockUtid: v.string(),
    pdfUrl: v.string(), // URL or storage ID of the generated PDF
  },
  handler: async (ctx, args) => {
    // Verify admin role
    const adminCheck = await verifyAdminRole({
      userId: args.adminId,
      db: ctx.db,
    });
    if (!adminCheck.authorized) {
      throw new Error("Only admins can store PDFs");
    }

    // Find all units with this lockUtid
    const allUnits = await ctx.db.query("listingUnits").collect();
    const units = allUnits.filter((u) => u.lockUtid === args.lockUtid);

    if (units.length === 0) {
      throw new Error("No units found with this UTID");
    }

    // Update all units with PDF reference
    for (const unit of units) {
      await ctx.db.patch(unit._id, {
        deliveryPdfId: args.pdfUrl,
      });
    }

    return { success: true, unitCount: units.length };
  },
});
