/**
 * Authentication and Authorization
 * 
 * This module handles:
 * - User authentication
 * - Role enforcement (server-side only)
 * - Alias generation for anonymity
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { PILOT_SHARED_PASSWORD } from "./constants";
import { getUgandaTime } from "./utils";

const BIOFARM_COMMUNITY_ID = "ms72de3njrrc9k43cf9h3yq70181ncp0";

async function ensureBioFarmMembershipForFarmer(
  ctx: any,
  userId: Id<"users">,
  role: string
) {
  if (role !== "farmer") return;

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
 * Verify admin role - helper function for authorization checks
 * Returns authorization decision
 */
export async function verifyAdminRole(context: {
  userId: Id<"users">;
  db: any;
}): Promise<{ authorized: boolean; user?: any }> {
  const user = await context.db.get(context.userId);
  if (!user || user.role !== "admin") {
    return { authorized: false };
  }
  return { authorized: true, user };
}

/**
 * Generate a stable, non-identifying alias for a user
 * Format: role_prefix_randomstring (e.g., "farmer_a3k9x2", "trader_m7p4q1")
 */
function generateAlias(role: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  return `${role}_${random}`;
}

/**
 * Simple hash function for pilot password (NOT production-grade)
 * ⚠️ PILOT ONLY - Use proper password hashing in production
 */
function simpleHash(password: string): string {
  // Simple hash for pilot - NOT secure, just for testing
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Normalize phone number to a consistent format
 * Removes spaces, dashes, and ensures it starts with country code
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it doesn't start with country code, assume Uganda (+256)
  // Uganda format: +256 7XX XXX XXX (remove leading 0 from local format)
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
  // Uganda phone numbers: 256 + 9 digits = 12 digits total
  // Or allow 10 digits if starting with 0 (local format)
  return /^(256\d{9}|\d{10})$/.test(normalized) || /^256\d{9}$/.test(phone.replace(/\D/g, ''));
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  return email.includes("@") && email.includes(".");
}

/**
 * Create a new user with a role
 * - Exactly one role per user (enforced by schema)
 * - Auto-generates alias for anonymity
 * - Sets shared pilot password hash
 * - For admin accounts: requires super admin creator and supports adminLevel and location assignment
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("admin"),
      v.literal("vendor"),
      v.literal("transporter"),
      v.literal("store")
    ),
    adminLevel: v.optional(v.union(v.literal("super"), v.literal("junior"))),
    adminCategory: v.optional(v.union(v.literal("store"), v.literal("message"), v.literal("community"), v.literal("finance"))),
    allowedStorageLocationIds: v.optional(v.array(v.id("storageLocations"))),
    assignedCommunityIds: v.optional(v.array(v.id("communities"))),
    creatorAdminId: v.optional(v.id("users")), // Admin creating this user (for permission check)
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      throw new Error("User with this email already exists");
    }

    // If creating an admin account, verify creator is a super admin
    if (args.role === "admin") {
      if (!args.creatorAdminId) {
        throw new Error("creatorAdminId is required when creating admin accounts");
      }
      
      const creatorUser = await ctx.db.get(args.creatorAdminId);
      if (!creatorUser || creatorUser.role !== "admin") {
        throw new Error("Creator must be an admin");
      }
      
      // Check if creator is super admin (adminLevel === "super" or undefined for backward compatibility)
      const isCreatorSuperAdmin = creatorUser.adminLevel === "super" || creatorUser.adminLevel === undefined;
      if (!isCreatorSuperAdmin) {
        throw new Error("Only super admins can create admin accounts");
      }
      
      // Validate adminLevel
      if (args.adminLevel !== undefined && args.adminLevel !== "super" && args.adminLevel !== "junior") {
        throw new Error("Invalid adminLevel. Must be 'super' or 'junior'");
      }
      
      // If creating junior admin, adminCategory is required. Storage locations required for store admins only.
      if (args.adminLevel === "junior") {
        if (!args.adminCategory) {
          throw new Error("Junior admins must have an adminCategory");
        }
        
        // Validate based on category
        if (args.adminCategory === "store") {
          // Store admins REQUIRE at least one storage location
          if (!args.allowedStorageLocationIds || args.allowedStorageLocationIds.length === 0) {
            throw new Error("Store admins must have at least one assigned storage location");
          }
          // Validate that all location IDs exist and are active
          for (const locationId of args.allowedStorageLocationIds) {
            const location = await ctx.db.get(locationId);
            if (!location) {
              throw new Error(`Storage location ${locationId} not found`);
            }
            if (!location.active) {
              throw new Error(`Storage location ${locationId} is not active`);
            }
          }
        } else if (args.adminCategory === "community") {
          // ✅ IMPORTANT: Community admins do NOT require assigned communities at creation
          // They can be assigned later via edit functionality
          // assignedCommunityIds is OPTIONAL
          
          // But if communities ARE provided, validate them
          if (args.assignedCommunityIds && args.assignedCommunityIds.length > 0) {
            for (const communityId of args.assignedCommunityIds) {
              const community = await ctx.db.get(communityId);
              if (!community) {
                throw new Error(`Community ${communityId} not found`);
              }
            }
          }
        } else if (args.adminCategory === "finance" || args.adminCategory === "message") {
          // Finance and Message admins don't require any assignments
          // (No special validation needed)
        }
        
        // Additional validation for any provided storage locations
        if (args.allowedStorageLocationIds && args.allowedStorageLocationIds.length > 0) {
          for (const locationId of args.allowedStorageLocationIds) {
            const location = await ctx.db.get(locationId);
            if (!location) {
              throw new Error(`Storage location ${locationId} not found`);
            }
            if (!location.active) {
              throw new Error(`Storage location ${locationId} is not active`);
            }
          }
        }
      }
    } else {
      // For non-admin roles, adminLevel and allowedStorageLocationIds should not be set
      if (args.adminLevel !== undefined) {
        throw new Error("adminLevel can only be set for admin role");
      }
      if (args.adminCategory !== undefined) {
        throw new Error("adminCategory can only be set for admin role");
      }
      if (args.allowedStorageLocationIds !== undefined && args.allowedStorageLocationIds.length > 0) {
        throw new Error("allowedStorageLocationIds can only be set for junior admin role");
      }
    }

    // Generate alias
    const alias = generateAlias(args.role);

    // Hash the shared pilot password
    const passwordHash = simpleHash(PILOT_SHARED_PASSWORD);

    // Prepare user data
    const userData: any = {
      email: args.email,
      role: args.role,
      alias,
      state: "active", // Initial state for new users
      createdAt: getUgandaTime(),
      lastActiveAt: getUgandaTime(),
      passwordHash,
    };
    
    // Add adminLevel and allowedStorageLocationIds for admin accounts
    if (args.role === "admin") {
      if (args.adminLevel !== undefined) {
        userData.adminLevel = args.adminLevel;
      }
      if (args.adminCategory !== undefined) {
        userData.adminCategory = args.adminCategory;
      }
      if (args.adminLevel === "junior" && args.allowedStorageLocationIds) {
        userData.allowedStorageLocationIds = args.allowedStorageLocationIds;
      }
      if (args.adminLevel === "junior" && args.assignedCommunityIds) {
        userData.assignedCommunityIds = args.assignedCommunityIds;
      }
    }

    // Create user
    const userId = await ctx.db.insert("users", userData);

    await ensureBioFarmMembershipForFarmer(ctx, userId, args.role);

    return { userId, alias };
  },
});

/**
 * Infer role from email (pilot mode helper)
 * Determines user role based on email prefix
 */
function inferRoleFromEmail(email: string): "farmer" | "trader" | "buyer" | "admin" {
  const lowerEmail = email.toLowerCase();
  if (lowerEmail.includes("admin") || lowerEmail.startsWith("admin")) return "admin";
  if (lowerEmail.includes("farmer") || lowerEmail.startsWith("farmer")) return "farmer";
  if (lowerEmail.includes("trader") || lowerEmail.startsWith("trader")) return "trader";
  return "buyer";
}

/**
 * Signup - Create a new user account
 * 
 * Behavior:
 * - Validates email OR phone number (at least one required)
 * - Creates user with specified role
 * - Returns user info on success
 */
export const signup = mutation({
  args: {
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    password: v.string(),
    role: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("vendor"),
      v.literal("transporter"),
      v.literal("store")
    ),
  },
  handler: async (ctx, args) => {
    // At least one of email or phone must be provided
    if (!args.email && !args.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }

    // Validate email if provided
    if (args.email) {
      if (!isValidEmail(args.email)) {
        throw new Error("Invalid email format");
      }
    }

    // Validate phone number if provided
    if (args.phoneNumber) {
      if (!isValidPhoneNumber(args.phoneNumber)) {
        throw new Error("Invalid phone number format. Please use format: +256 7XX XXX XXX or 07XX XXX XXX");
      }
    }

    // Validate password length
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    // Normalize phone number if provided
    const normalizedPhone = args.phoneNumber ? normalizePhoneNumber(args.phoneNumber) : undefined;
    const normalizedEmail = args.email ? args.email.trim().toLowerCase() : undefined;

    // Check if user already exists by email
    if (normalizedEmail) {
      const existingByEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();

      if (existingByEmail) {
        throw new Error("User with this email already exists");
      }
    }

    // Check if user already exists by phone
    if (normalizedPhone) {
      const existingByPhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
        .first();

      if (existingByPhone) {
        throw new Error("User with this phone number already exists");
      }
    }

    // Generate alias
    const alias = generateAlias(args.role);
    
    // Hash the password
    const passwordHash = simpleHash(args.password.trim());

    // Create user
    const userId = await ctx.db.insert("users", {
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      role: args.role,
      alias,
      state: "active",
      createdAt: getUgandaTime(),
      lastActiveAt: getUgandaTime(),
      passwordHash,
    });

    await ensureBioFarmMembershipForFarmer(ctx, userId, args.role);

    // Fetch the created user
    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("Failed to create user");
    }

    // Return user info
    return {
      userId: user._id,
      alias: user.alias,
      role: user.role,
      adminLevel: user.adminLevel,
      adminCategory: user.adminCategory,
      assignedCommunityIds: user.assignedCommunityIds,
      isVerifiedTrader: user.isVerifiedTrader ?? false,
      verificationStatus: user.verificationStatus ?? "pending",
    };
  },
});

/**
 * Login with email/phone and password
 * 
 * Behavior:
 * - Accepts either email or phone number
 * - Validates password against stored hash
 * - Returns user info on success
 */
export const login = mutation({
  args: {
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // At least one of email or phone must be provided
    if (!args.email && !args.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }

    let user = null;

    // Try to find user by email
    if (args.email) {
      const normalizedEmail = args.email.trim().toLowerCase();
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
    }

    // If not found by email, try phone number
    if (!user && args.phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
        .first();
    }

    if (!user) {
      throw new Error("Invalid email/phone or password");
    }

    // Validate password
    const passwordHash = simpleHash(args.password.trim());
    if (user.passwordHash !== passwordHash) {
      throw new Error("Invalid email/phone or password");
    }

    // Check if user is active
    if (user.state !== "active") {
      throw new Error("Account is not active. Please contact support.");
    }

    // Update last active timestamp
    await ctx.db.patch(user._id, {
      lastActiveAt: getUgandaTime(),
    });

    // Return user info
    return {
      userId: user._id,
      alias: user.alias,
      role: user.role,
      adminLevel: user.adminLevel,
      adminCategory: user.adminCategory,
      assignedCommunityIds: user.assignedCommunityIds,
    };
  },
});

/**
 * Get user by ID
 * - Returns alias, not real identity
 */
export const getUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return null;
    }

    // Return only alias (anonymity enforced)
    return {
      userId: user._id,
      alias: user.alias,
      role: user.role,
      createdAt: user.createdAt,
      adminLevel: user.adminLevel,
      adminCategory: user.adminCategory,
      assignedCommunityIds: user.assignedCommunityIds,
      isVerifiedTrader: user.isVerifiedTrader ?? false,
      verificationStatus: user.verificationStatus ?? "pending",
    };
  },
});

/**
 * Verify user role (server-side enforcement)
 * - Never trust client claims
 */
export const verifyRole = query({
  args: {
    userId: v.id("users"),
    requiredRole: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("admin"),
      v.literal("vendor"),
      v.literal("transporter"),
      v.literal("store")
    ),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) {
      return { authorized: false, reason: "User not found" };
    }

    if (user.role !== args.requiredRole) {
      return {
        authorized: false,
        reason: `User role ${user.role} does not match required role ${args.requiredRole}`,
      };
    }

    return { authorized: true };
  },
});

/**
 * Change password for authenticated user
 */
export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Verify current password
    if (!user.passwordHash) throw new Error("User does not have a password set");

    const currentHash = simpleHash(args.currentPassword.trim());
    if (user.passwordHash !== currentHash) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password
    if (args.newPassword.length < 8) {
      throw new Error("New password must be at least 8 characters");
    }

    if (args.currentPassword === args.newPassword) {
      throw new Error("New password must be different from current password");
    }

    // Hash new password
    const newHash = simpleHash(args.newPassword.trim());

    // Update user
    await ctx.db.patch(args.userId, {
      passwordHash: newHash,
    });

    return { success: true };
  },
});

/**
 * Update user role and assignment (SuperAdmin only)
 */
export const updateUserRoleAndAssignment = mutation({
  args: {
    userId: v.id("users"),
    adminLevel: v.optional(v.union(v.literal("super"), v.literal("junior"))),
    adminCategory: v.optional(v.union(v.literal("store"), v.literal("message"), v.literal("community"), v.literal("finance"))),
    assignedCommunityIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.adminLevel !== undefined) updates.adminLevel = args.adminLevel;
    if (args.adminCategory !== undefined) updates.adminCategory = args.adminCategory;
    if (args.assignedCommunityIds !== undefined) updates.assignedCommunityIds = args.assignedCommunityIds;
    await ctx.db.patch(args.userId, updates);
  },
});

/**
 * Backward Integration: Fix existing community admins who are missing assignments
 * Run this once via the Convex Dashboard to fix deigaroadmin and agrofreshadmin
 */
export const backfillCommunityAdmins = mutation({
  args: {},
  handler: async (ctx) => {
    const targets = [
      { email: "deigaroadmin@community.farm2market", communityName: "Deigaro" },
      { email: "agrofreshadmin@community.farm2market", communityName: "AgroFresh" },
    ];

    const results = [];
    const allCommunities = await ctx.db.query("communities").collect();

    for (const target of targets) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", target.email))
        .first();

      if (!user) {
        results.push(`User not found: ${target.email}`);
        continue;
      }

      // Fuzzy match community name
      const community = allCommunities.find(c => 
        c.name.toLowerCase().includes(target.communityName.toLowerCase())
      );

      if (community) {
        await ctx.db.patch(user._id, { assignedCommunityIds: [community._id] });
        results.push(`Fixed ${target.email} -> Assigned to ${community.name}`);
      } else {
        results.push(`Community not found for ${target.communityName}`);
      }
    }
    return results;
  },
});

// ───────────────────────────────────────────────────────
// Password Recovery
// ───────────────────────────────────────────────────────

/**
 * Request a password reset.
 * Accepts phone number OR email. Looks up the user, creates a
 * passwordResetTokens row, and returns a pilot-mode reset URL.
 *
 * If the user signed up with phone only and has no email,
 * returns { needsEmail: true } so the frontend can collect one.
 */
export const requestPasswordReset = mutation({
  args: {
    identifier: v.string(), // phone number or email
    recoveryEmail: v.optional(v.string()), // recovery email if user has none
  },
  handler: async (ctx, args) => {
    const trimmed = args.identifier.trim();
    if (!trimmed) {
      return { success: false, message: "Please enter your phone number or email" };
    }

    // Determine whether identifier is an email or phone number
    const isEmail = trimmed.includes("@");

    let user = null;
    if (isEmail) {
      const normalizedEmail = trimmed.toLowerCase();
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
    } else {
      // Treat as phone number
      const cleaned = trimmed.replace(/\D/g, "");
      let normalizedPhone = cleaned;
      if (cleaned.startsWith("0")) {
        normalizedPhone = "256" + cleaned.substring(1);
      } else if (!cleaned.startsWith("256")) {
        normalizedPhone = "256" + cleaned;
      }
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
        .first();
    }

    if (!user) {
      // Do NOT reveal whether user exists — always show generic success
      return {
        success: true,
        message: "If an account exists with that information, a reset link has been sent.",
      };
    }

    // If user has no email and no recovery email was provided, ask for one
    const userEmail = user.email;
    if (!userEmail && !args.recoveryEmail) {
      return {
        success: false,
        needsEmail: true,
        message: "This account has no email on file. Please provide a recovery email.",
      };
    }

    // If a recovery email was provided, save it on the user for future use
    if (args.recoveryEmail && !userEmail) {
      await ctx.db.patch(user._id, { email: args.recoveryEmail.trim().toLowerCase() });
    }

    // Generate a random token (simple pilot-grade — NOT crypto-secure)
    const rawToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const tokenHash = simpleHash(rawToken);

    // Expire in 1 hour
    const expiresAt = Date.now() + 60 * 60 * 1000;

    await ctx.db.insert("passwordResetTokens", {
      userId: user._id,
      tokenHash,
      expiresAt,
      createdAt: Date.now(),
    });

    // Pilot mode: return the reset URL directly
    const resetUrl = `/reset-password?token=${rawToken}`;

    return {
      success: true,
      message: "If an account exists with that information, a reset link has been sent.",
      resetUrl, // Pilot mode only — remove in production
    };
  },
});

/**
 * Verify a password reset token.
 * Returns the userId if the token is valid and unexpired.
 */
export const verifyResetToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const tokenHash = simpleHash(args.token);

    const tokenRecord = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!tokenRecord) {
      return { valid: false, message: "Invalid or expired reset link" };
    }

    if (tokenRecord.usedAt) {
      return { valid: false, message: "This reset link has already been used" };
    }

    if (tokenRecord.expiresAt < Date.now()) {
      return { valid: false, message: "This reset link has expired" };
    }

    return { valid: true, userId: tokenRecord.userId };
  },
});

/**
 * Reset password using a valid token.
 */
export const resetPassword = mutation({
  args: {
    token: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 6) {
      return { success: false, message: "Password must be at least 6 characters" };
    }

    const tokenHash = simpleHash(args.token);

    const tokenRecord = await ctx.db
      .query("passwordResetTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!tokenRecord) {
      return { success: false, message: "Invalid or expired reset link" };
    }

    if (tokenRecord.usedAt) {
      return { success: false, message: "This reset link has already been used" };
    }

    if (tokenRecord.expiresAt < Date.now()) {
      return { success: false, message: "This reset link has expired" };
    }

    // Update password
    const newHash = simpleHash(args.newPassword.trim());
    await ctx.db.patch(tokenRecord.userId, { passwordHash: newHash });

    // Mark token as used
    await ctx.db.patch(tokenRecord._id, { usedAt: Date.now() });

    return { success: true, message: "Password has been reset successfully" };
  },
});

// ───────────────────────────────────────────────────────
// Session-based auth (durable login persistence)
// ───────────────────────────────────────────────────────

/**
 * Generate a pilot-grade session token (~60 random chars).
 * Not cryptographically perfect, but sufficient for this app.
 */
function generateSessionToken(): string {
  const t = getUgandaTime().toString(36);
  const r1 = Math.random().toString(36).substring(2);
  const r2 = Math.random().toString(36).substring(2);
  const r3 = Math.random().toString(36).substring(2);
  return `${t}-${r1}${r2}${r3}`;
}

/** 90-day session lifetime in milliseconds */
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Lightweight account existence check for adaptive auth UX.
 * Used after failed login attempts to decide whether to prompt signup confirmation.
 */
export const checkAccountExists = mutation({
  args: {
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!args.email && !args.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }

    let user = null;

    if (args.email) {
      const normalizedEmail = args.email.trim().toLowerCase();
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
    }

    if (!user && args.phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
        .first();
    }

    return { exists: !!user };
  },
});

/**
 * Login and create a durable server-side session.
 * Returns sessionToken so the client can persist it across WebView clears.
 */
export const loginWithSession = mutation({
  args: {
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.email && !args.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }

    let user = null;
    if (args.email) {
      const normalizedEmail = args.email.trim().toLowerCase();
      user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
    }
    if (!user && args.phoneNumber) {
      const normalizedPhone = normalizePhoneNumber(args.phoneNumber);
      user = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
        .first();
    }

    if (!user) throw new Error("Invalid email/phone or password");

    const passwordHash = simpleHash(args.password.trim());
    if (user.passwordHash !== passwordHash) throw new Error("Invalid email/phone or password");
    if (user.state !== "active") throw new Error("Account is not active. Please contact support.");

    const now = getUgandaTime();
    await ctx.db.patch(user._id, { lastActiveAt: now });

    const sessionToken = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token: sessionToken,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
      lastActiveAt: now,
      invalidated: false,
    });

    return {
      sessionToken,
      userId: user._id,
      alias: user.alias,
      role: user.role,
      adminLevel: user.adminLevel,
      adminCategory: user.adminCategory,
      assignedCommunityIds: user.assignedCommunityIds,
    };
  },
});

/**
 * Signup and create a durable server-side session.
 * Mirrors signupWithSession — returns sessionToken alongside user fields.
 */
export const signupWithSession = mutation({
  args: {
    email: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    password: v.string(),
    role: v.union(
      v.literal("farmer"),
      v.literal("trader"),
      v.literal("buyer"),
      v.literal("vendor"),
      v.literal("transporter"),
      v.literal("store")
    ),
  },
  handler: async (ctx, args) => {
    if (!args.email && !args.phoneNumber) {
      throw new Error("Either email or phone number is required");
    }
    if (args.email && !isValidEmail(args.email)) {
      throw new Error("Invalid email format");
    }
    if (args.phoneNumber && !isValidPhoneNumber(args.phoneNumber)) {
      throw new Error("Invalid phone number format. Please use format: +256 7XX XXX XXX or 07XX XXX XXX");
    }
    if (args.password.length < 6) {
      throw new Error("Password must be at least 6 characters long");
    }

    const normalizedPhone = args.phoneNumber ? normalizePhoneNumber(args.phoneNumber) : undefined;
    const normalizedEmail = args.email ? args.email.trim().toLowerCase() : undefined;

    if (normalizedEmail) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
        .first();
      if (existing) throw new Error("User with this email already exists");
    }
    if (normalizedPhone) {
      const existing = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", normalizedPhone))
        .first();
      if (existing) throw new Error("User with this phone number already exists");
    }

    const alias = generateAlias(args.role);
    const passwordHash = simpleHash(args.password.trim());
    const now = getUgandaTime();

    const userId = await ctx.db.insert("users", {
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      alias,
      role: args.role,
      passwordHash,
      state: "active",
      createdAt: now,
      lastActiveAt: now,
    });

    await ensureBioFarmMembershipForFarmer(ctx, userId, args.role);

    const sessionToken = generateSessionToken();
    await ctx.db.insert("sessions", {
      userId,
      token: sessionToken,
      expiresAt: now + SESSION_TTL_MS,
      createdAt: now,
      lastActiveAt: now,
      invalidated: false,
    });

    return {
      sessionToken,
      userId,
      alias,
      role: args.role,
      adminLevel: undefined,
      adminCategory: undefined,
      assignedCommunityIds: [],
    };
  },
});

/**
 * Validate a session token and return user info (for app startup re-auth).
 * Returns null if token is invalid, expired, or user is inactive.
 */
export const getSessionUser = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token || args.token.length < 10) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.invalidated || session.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user || user.state !== "active") return null;

    return {
      userId: user._id,
      alias: user.alias,
      role: user.role,
      adminLevel: user.adminLevel ?? null,
      adminCategory: user.adminCategory ?? null,
      assignedCommunityIds: user.assignedCommunityIds ?? [],
    };
  },
});

/**
 * Invalidate a session (call on logout).
 */
export const invalidateSession = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return;
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session && !session.invalidated) {
      await ctx.db.patch(session._id, {
        invalidated: true,
        invalidatedAt: getUgandaTime(),
      });
    }
  },
});
