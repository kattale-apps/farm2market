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
import { getUgandaTime } from "./utils";
import { getCommunityDefaultRole, ensureMandatoryRoleCommunityMembershipsForUser, CommunityRole } from "./communities";

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
 * Create (or reuse) a real member account for an imported row, the same way
 * CRM's resolveOrCreateClientMember creates accounts for new clients: phone
 * number as the login id, phone number as the (pilot-grade) password, joined
 * to the community immediately. If a user with this phone number already
 * exists (e.g. from CRM, another community import, or a normal signup), they
 * are just joined to this community instead of creating a duplicate account.
 */
async function createOrJoinMemberAccount(
  ctx: any,
  args: {
    communityId: Id<"communities">;
    role: CommunityRole;
    phoneNumber: string;
    email?: string;
    communityRole?: string;
  }
) {
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_phone", (q: any) => q.eq("phoneNumber", args.phoneNumber))
    .first();

  const now = getUgandaTime();

  if (existingUser) {
    const alreadyMember = await ctx.db
      .query("communityMemberships")
      .withIndex("by_community_user", (q: any) =>
        q.eq("communityId", args.communityId).eq("userId", existingUser._id)
      )
      .first();

    if (!alreadyMember) {
      await ctx.db.insert("communityMemberships", {
        communityId: args.communityId,
        userId: existingUser._id,
        joinedAt: now,
        communityRole: args.communityRole,
      });
    }

    return { userId: existingUser._id as Id<"users">, wasNewUser: false };
  }

  const alias = generateAlias(args.role);
  const passwordHash = simpleHash(args.phoneNumber);

  const userId = await ctx.db.insert("users", {
    phoneNumber: args.phoneNumber,
    email: args.email,
    role: args.role,
    alias,
    state: "active",
    createdAt: now,
    lastActiveAt: now,
    passwordHash,
    accountScope: "community_only",
    onboardedViaCommunityId: args.communityId,
  });

  await ctx.db.insert("communityMemberships", {
    communityId: args.communityId,
    userId,
    joinedAt: now,
    communityRole: args.communityRole,
  });

  await ensureMandatoryRoleCommunityMembershipsForUser(ctx, userId, args.role);
  if (args.role === "farmer") {
    await ensureBioFarmMembershipForFarmer(ctx, userId);
  }

  return { userId: userId as Id<"users">, wasNewUser: true };
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
 * Generate a random, non-identifying alias (consistent with the CRM new-client
 * flow) so a member's phone number isn't leaked into their display name.
 */
function generateAlias(role: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  return `${role}_${random}`;
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

        // Create the real member account immediately (phone login, like CRM's
        // new-client intake) instead of leaving this as a placeholder an admin
        // has to manually activate later.
        const { userId } = await createOrJoinMemberAccount(ctx, {
          communityId,
          role: communityDefaultRole,
          phoneNumber: normalizedPhone,
          email: finalEmail,
          communityRole: row.communityRole?.trim() || undefined,
        });
        const account = await ctx.db.get(userId);
        const hasLoggedIn = !!account && account.lastActiveAt > account.createdAt;

        // Insert imported member record for admin-facing tracking/display
        const importedId = await ctx.db.insert("communityImportedMembers", {
          communityId,
          fullName: row.fullName.trim(),
          phoneNumber: normalizedPhone,
          email: finalEmail,
          communityRole: row.communityRole?.trim() || null,
          status: hasLoggedIn ? "ACTIVATED" : "PENDING_ACTIVATION",
          createdAt: now,
          updatedAt: now,
          accountUserId: userId,
          notes: row.notes?.trim() || null,
          additionalData: Object.keys(additionalData).length > 0 ? additionalData : null,
        });

        results.push({ row: rowIndex, id: importedId, userId, status: "success" });
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
    status: v.optional(
      v.union(v.literal("IMPORTED"), v.literal("PENDING_ACTIVATION"), v.literal("ACTIVATED"))
    ),
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
      // No status filter by default: admins need to see the whole imported
      // roster (legacy IMPORTED placeholders, PENDING_ACTIVATION accounts
      // waiting on the member's first login, and already-ACTIVATED members)
      // in one list, not just one status at a time.
      const members = status
        ? await ctx.db
            .query("communityImportedMembers")
            .withIndex("by_community_status", (q) => q.eq("communityId", communityId).eq("status", status))
            .collect()
        : await ctx.db
            .query("communityImportedMembers")
            .withIndex("by_community", (q) => q.eq("communityId", communityId))
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

    // Only legacy pre-account rows go through this path; anything already
    // processed (PENDING_ACTIVATION or ACTIVATED) already has an account.
    if (importedMember.status !== "IMPORTED") {
      throw new Error("This member has already been processed");
    }

    const community = await ctx.db.get(importedMember.communityId);
    const role = getCommunityDefaultRole((community as any)?.communityType);

    // Same one-step, phone-login account creation as a fresh Excel import,
    // so legacy IMPORTED rows end up with the same login as everyone else.
    const { userId } = await createOrJoinMemberAccount(ctx, {
      communityId: importedMember.communityId,
      role,
      phoneNumber: importedMember.phoneNumber,
      email: importedMember.email,
      communityRole: importedMember.communityRole || undefined,
    });

    const account = await ctx.db.get(userId);
    const hasLoggedIn = !!account && account.lastActiveAt > account.createdAt;

    await ctx.db.patch(importedMemberId, {
      status: hasLoggedIn ? "ACTIVATED" : "PENDING_ACTIVATION",
      accountUserId: userId,
      updatedAt: getUgandaTime(),
    });

    return {
      success: true,
      userId,
      message: `Account created for ${importedMember.fullName}. They can now log in with their phone number.`,
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

    // Only allow deleting the tracking record itself, not one with a real
    // account already attached (covers both PENDING_ACTIVATION and ACTIVATED).
    if (importedMember.accountUserId) {
      throw new Error("Cannot delete a member who already has an account");
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

/**
 * Called from auth.login/loginWithSession on every successful login. If the
 * logging-in user was created via an Excel import and is still awaiting
 * their first login (status PENDING_ACTIVATION), flip their tracking row to
 * ACTIVATED so admins can see they've come online. No-op for every other
 * user (most logins won't have a matching row at all).
 */
export async function markImportedMemberActivatedByUserId(ctx: any, userId: Id<"users">) {
  const importedMember = await ctx.db
    .query("communityImportedMembers")
    .withIndex("by_account_user", (q: any) => q.eq("accountUserId", userId))
    .first();

  if (importedMember && importedMember.status === "PENDING_ACTIVATION") {
    await ctx.db.patch(importedMember._id, {
      status: "ACTIVATED",
      updatedAt: getUgandaTime(),
    });
  }
}
