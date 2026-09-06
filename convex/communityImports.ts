/**
 * Community Member Imports
 * 
 * Handles bulk import of community members from Excel files and account activation.
 * Features:
 * - Parse and validate Excel rows
 * - Store imported members as placeholders
 * - Create accounts with generated emails and preset password
 * - Authorization checks for junior community admins
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { BCU_PRESET_PASSWORD } from "./constants";
import { getUgandaTime } from "./utils";
import { getCommunityDefaultRole, ensureMandatoryRoleCommunityMembershipsForUser } from "./communities";

const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

async function ensureBioFarmMembershipForFarmer(ctx: any, userId: Id<"users">) {
  const existing = await ctx.db
    .query("communityMemberships")
    .withIndex("by_community_user", (q: any) =>
      q.eq("communityId", BIOFARM_COMMUNITY_ID as Id<"communities">).eq("userId", userId)
    )
    .first();

  if (!existing) {
    await ctx.db.insert("communityMemberships", {
      communityId: BIOFARM_COMMUNITY_ID as Id<"communities">,
      userId,
      joinedAt: getUgandaTime(),
    });
  }
}

/**
 * Simple hash function for preset password (consistent with pilot password handling)
 */
function simpleHash(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

/**
 * Normalize phone number to consistent format
 */
function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('0')) {
    cleaned = '256' + cleaned.substring(1);
  } else if (!cleaned.startsWith('256')) {
    cleaned = '256' + cleaned;
  }
  
  return cleaned;
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^256\d{9}$/.test(normalized);
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

/**
 * Generate email from phone number in format: [role]_[phone]@bcu.com
 */
function generateEmailFromPhone(phone: string, role = "farmer"): string {
  const normalized = normalizePhoneNumber(phone);
  return `${role}_${normalized}@bcu.com`;
}

/**
 * Import community members from Excel data
 * Accepts flexible row format with any columns; fullName and phoneNumber are required.
 * Additional fields are stored in additionalData for display on member card.
 */
export const importCommunityMembersFromExcel = mutation({
  args: {
    adminId: v.id("users"),
    communityId: v.id("communities"),
    rows: v.array(v.any()),
  },
  handler: async (ctx, { adminId, communityId, rows }) => {
    // Verify admin is authorized
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    // Check if admin is a junior community admin assigned to this community
    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
    if (!isSuperAdmin) {
      if (admin.adminCategory !== "community") {
        throw new Error("Only community admins can import members");
      }

      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isAssigned = assignedSet.has(String(communityId));

      if (!isAssigned) {
        throw new Error("Not assigned to this community");
      }
    }

    // Verify community exists
    const community = await ctx.db.get(communityId);
    if (!community) {
      throw new Error("Community not found");
    }
    const communityDefaultRole = getCommunityDefaultRole((community as any).communityType);

    // Validate and import rows
    const results: any[] = [];
    const errors: any[] = [];
    const now = getUgandaTime();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2; // Excel row number (header + 1)

      try {
        // Validate required fields
        if (!row.fullName || !row.fullName.trim()) {
          errors.push({ row: rowIndex, error: "Full name is required" });
          continue;
        }

        if (!row.phoneNumber || !row.phoneNumber.trim()) {
          errors.push({ row: rowIndex, error: "Phone number is required" });
          continue;
        }

        // Validate phone format
        if (!isValidPhoneNumber(row.phoneNumber)) {
          errors.push({ row: rowIndex, error: "Invalid phone number format" });
          continue;
        }

        const normalizedPhone = normalizePhoneNumber(row.phoneNumber);

        // Check for duplicates in the same community
        const existing = await ctx.db
          .query("communityImportedMembers")
          .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
          .first();

        if (existing && existing.communityId === communityId) {
          errors.push({ row: rowIndex, error: "Phone number already imported in this community" });
          continue;
        }

        // Validate email if provided
        let finalEmail = row.email;
        if (finalEmail && !isValidEmail(finalEmail)) {
          errors.push({ row: rowIndex, error: "Invalid email format" });
          continue;
        }

        // Use provided email or generate from phone
        if (!finalEmail) {
          finalEmail = generateEmailFromPhone(row.phoneNumber, communityDefaultRole);
        }

        // Extract standard fields and store remaining as additional data
        const standardFields = ["fullName", "phoneNumber", "email", "communityRole", "notes"];
        const additionalData: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
          if (!standardFields.includes(key) && value !== null && value !== undefined && value !== "") {
            additionalData[key] = value;
          }
        }

        // Insert imported member
        const importedId = await ctx.db.insert("communityImportedMembers", {
          communityId,
          fullName: row.fullName.trim(),
          phoneNumber: normalizedPhone,
          email: finalEmail,
          communityRole: row.communityRole?.trim() || null,
          status: "IMPORTED",
          createdAt: now,
          updatedAt: now,
          notes: row.notes?.trim() || null,
          additionalData: Object.keys(additionalData).length > 0 ? additionalData : null,
        });

        results.push({ row: rowIndex, id: importedId, status: "success" });
      } catch (err: any) {
        errors.push({ row: rowIndex, error: err.message || "Unknown error" });
      }
    }

    return {
      imported: results.length,
      failed: errors.length,
      results,
      errors,
    };
  },
});

/**
 * Get imported members by community IDs
 */
export const getImportedCommunityMembersByCommunityIds = query({
  args: {
    adminId: v.id("users"),
    communityIds: v.array(v.id("communities")),
    status: v.optional(v.union(v.literal("IMPORTED"), v.literal("ACTIVATED"))),
  },
  handler: async (ctx, { adminId, communityIds, status }) => {
    // Verify admin authorization
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;

    let allowedCommunityIds = communityIds;
    if (!isSuperAdmin && admin.adminCategory === "community") {
      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      allowedCommunityIds = communityIds.filter((id) => assignedSet.has(String(id)));
    }

    const results: any[] = [];

    for (const communityId of allowedCommunityIds) {
      const members = await ctx.db
        .query("communityImportedMembers")
        .withIndex("by_community_status", (q) =>
          q.eq("communityId", communityId).eq("status", status || "IMPORTED")
        )
        .collect();

      results.push(...members.map((m) => ({ ...m, communityId })));
    }

    return results;
  },
});

/**
 * Activate an imported member by creating a user account
 */
export const activateImportedCommunityMember = mutation({
  args: {
    adminId: v.id("users"),
    importedMemberId: v.id("communityImportedMembers"),
  },
  handler: async (ctx, { adminId, importedMemberId }) => {
    // Verify admin authorization
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    // Get imported member
    const importedMember = await ctx.db.get(importedMemberId);
    if (!importedMember) {
      throw new Error("Imported member not found");
    }

    // Verify admin is assigned to the community
    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
    if (!isSuperAdmin) {
      if (admin.adminCategory !== "community") {
        throw new Error("Only community admins can activate members");
      }

      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isAssigned = assignedSet.has(String(importedMember.communityId));

      if (!isAssigned) {
        throw new Error("Not assigned to this community");
      }
    }

    // Check if account already exists with this email
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", importedMember.email))
      .first();

    if (existingUser) {
      throw new Error("User account with this email already exists");
    }

    // Create user account
    const passwordHash = simpleHash(BCU_PRESET_PASSWORD);
    const community = await ctx.db.get(importedMember.communityId);
    const role = getCommunityDefaultRole((community as any)?.communityType);
    const userId = await ctx.db.insert("users", {
      email: importedMember.email,
      role,
      alias: `${role}_${importedMember.phoneNumber}`,
      state: "active",
      createdAt: getUgandaTime(),
      lastActiveAt: getUgandaTime(),
      passwordHash,
    });

    // Update imported member record
    await ctx.db.patch(importedMemberId, {
      status: "ACTIVATED",
      accountUserId: userId,
      presetPasswordHash: passwordHash,
      updatedAt: getUgandaTime(),
    });

    // Add to community membership
    await ctx.db.insert("communityMemberships", {
      communityId: importedMember.communityId,
      userId,
      joinedAt: getUgandaTime(),
      communityRole: importedMember.communityRole || undefined,
    });

    if (role === "farmer") {
      await ensureBioFarmMembershipForFarmer(ctx, userId);
    }
    await ensureMandatoryRoleCommunityMembershipsForUser(ctx, userId, role);

    return {
      success: true,
      userId,
      email: importedMember.email,
      message: `Account created for ${importedMember.fullName}`,
    };
  },
});

/**
 * Get a single imported member by ID
 */
export const getImportedMember = query({
  args: {
    importedMemberId: v.id("communityImportedMembers"),
  },
  handler: async (ctx, { importedMemberId }) => {
    return await ctx.db.get(importedMemberId);
  },
});

/**
 * Delete an imported member (only if not activated)
 */
export const deleteImportedMember = mutation({
  args: {
    adminId: v.id("users"),
    importedMemberId: v.id("communityImportedMembers"),
  },
  handler: async (ctx, { adminId, importedMemberId }) => {
    // Verify admin authorization
    const admin = await ctx.db.get(adminId);
    if (!admin || admin.role !== "admin") {
      throw new Error("Not authorized");
    }

    // Get imported member
    const importedMember = await ctx.db.get(importedMemberId);
    if (!importedMember) {
      throw new Error("Imported member not found");
    }

    // Only allow deletion of non-activated members
    if (importedMember.status === "ACTIVATED") {
      throw new Error("Cannot delete activated members");
    }

    // Verify admin is assigned to the community
    const isSuperAdmin = admin.adminLevel === "super" || admin.adminLevel === undefined;
    if (!isSuperAdmin) {
      const assigned = (admin as any).assignedCommunityIds || [];
      const normalizeAssignedId = (value: any) => {
        if (!value) return "";
        if (typeof value === "string") return value;
        if (typeof value === "object") {
          return String((value as any)._id ?? (value as any).id ?? value);
        }
        return String(value);
      };
      const assignedSet = new Set(assigned.map(normalizeAssignedId).filter(Boolean));
      const isAssigned = assignedSet.has(String(importedMember.communityId));

      if (!isAssigned) {
        throw new Error("Not assigned to this community");
      }
    }

    // Delete the imported member
    await ctx.db.delete(importedMemberId);

    return { success: true, message: "Imported member deleted" };
  },
});
