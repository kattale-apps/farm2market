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
  const prefix = role.substring(0, 3); // "farmer" -> "far", "trader" -> "tra"
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${random}`;
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
      v.literal("admin")
    ),
    adminLevel: v.optional(v.union(v.literal("super"), v.literal("junior"))),
    allowedStorageLocationIds: v.optional(v.array(v.id("storageLocations"))),
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
      
      // If creating junior admin, allowedStorageLocationIds must be provided and non-empty
      if (args.adminLevel === "junior") {
        if (!args.allowedStorageLocationIds || args.allowedStorageLocationIds.length === 0) {
          throw new Error("Junior admins must have at least one assigned storage location");
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
      }
    } else {
      // For non-admin roles, adminLevel and allowedStorageLocationIds should not be set
      if (args.adminLevel !== undefined) {
        throw new Error("adminLevel can only be set for admin role");
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
      if (args.adminLevel === "junior" && args.allowedStorageLocationIds) {
        userData.allowedStorageLocationIds = args.allowedStorageLocationIds;
      }
    }

    // Create user
    const userId = await ctx.db.insert("users", userData);

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
      v.literal("buyer")
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
      v.literal("admin")
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
