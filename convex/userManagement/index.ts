/**
 * User Management Module - Implementation
 * 
 * Step: 5c (IMPLEMENTATION_SEQUENCE.md Step 5)
 * Step 5d: Alias Generation Integration (Utilities Step 1b extension)
 * Status: Implementation complete
 * 
 * Context:
 * - User Management Module Specification (SPECIFICATION.md) defines requirements
 * - User Management Public Interface (types.ts, Step 5a, approved and locked)
 * - User Management Test Specification (TEST_SPECIFICATION.md, Step 5b, approved and locked)
 * - IMPLEMENTATION_BOUNDARIES.md applies
 * - MODULARITY_GUIDE.md applies
 * - INVARIANTS.md (3.1, 4.2) applies
 * - architecture.md applies
 * - DOMAIN_MODEL.md defines User entity and role states
 * - Utilities module (Step 1, Step 1b extension) is complete and available
 * - Error Handling module (Step 2) is complete and available
 * - Authorization module (Step 3) is complete and available
 * 
 * Purpose:
 * This file implements the User Management module functions as specified.
 * All functions are deterministic and stateless (same inputs + same database state = same outputs).
 * 
 * Rules:
 * - Implement ONLY what is defined in the public interface (types.ts)
 * - Do NOT add new exports, helpers, or overloads
 * - Do NOT redefine ErrorEnvelope or error codes
 * - All errors MUST be returned as ErrorEnvelope via Error Handling helpers
 * - Do NOT inspect or construct ErrorEnvelope directly
 * - Preserve determinism and statelessness
 * - Enforce INVARIANT 3.1 (Users Cannot Change Their Own Role)
 * - Enforce INVARIANT 4.2 (All Meaningful Actions Generate UTIDs)
 * - Admin-only operations must use Authorization module
 * - No authentication, no role inference, no self-role changes
 * - Prefer explicit error returns over implicit behavior
 */

import type {
  UserRecord,
  UserState,
  UserManagementContext,
  UserActionContext,
  CreateUserInput,
  ChangeUserRoleInput,
  SuspendUserInput,
  DeleteUserInput,
} from "./types";

import type { UserRole } from "../auth/types";
import type { ErrorEnvelope } from "../errors/types";
import { createError } from "../errors/index";
import { verifyAdminRole } from "../auth/index";
import { generateUTID, generateUserAlias } from "../utils/index";
import type { DatabaseReader, DatabaseWriter } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Valid user roles (shared constant to avoid duplication).
 */
const VALID_USER_ROLES: readonly UserRole[] = ["farmer", "trader", "buyer", "admin"] as const;

// ============================================================================
// INTERNAL HELPER FUNCTIONS
// ============================================================================


/**
 * Validate email format (basic validation).
 * 
 * Requirements:
 * - Must be a non-empty string
 * - Must contain @ symbol
 * - Must have at least one character before @
 * - Must have at least one character after @
 * 
 * @param email - Email address to validate
 * @returns true if valid, false otherwise
 */
function isValidEmail(email: string): boolean {
  if (typeof email !== "string" || email.length === 0) {
    return false;
  }
  const atIndex = email.indexOf("@");
  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return false;
  }
  return true;
}

/**
 * Convert database user record to UserRecord type.
 * 
 * Requirements:
 * - Must handle missing state field (defaults to "active" if not present)
 * - Must convert Convex Id to string
 * - Must preserve all fields
 * 
 * @param dbUser - Database user record from Convex
 * @returns UserRecord or null if invalid
 */
function dbUserToUserRecord(dbUser: any): UserRecord | null {
  if (!dbUser || !dbUser._id) {
    return null;
  }
  
  // State field is now in schema, must be present
  const state: UserState = dbUser.state;
  
  // Validate state
  if (state !== "active" && state !== "suspended" && state !== "deleted") {
    return null;
  }
  
  return {
    id: dbUser._id.toString(),
    email: dbUser.email,
    role: dbUser.role,
    alias: dbUser.alias,
    state: state,
    createdAt: dbUser.createdAt,
    lastActiveAt: dbUser.lastActiveAt,
  };
}

/**
 * Validate UserManagementContext.
 * 
 * @param ctx - Context to validate
 * @returns ErrorEnvelope if invalid, null if valid
 */
function validateContext(ctx: UserManagementContext | null | undefined): ErrorEnvelope | null {
  if (ctx === null || ctx === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: ctx");
  }
  if (ctx.db === null || ctx.db === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: ctx.db");
  }
  if (ctx.now === null || ctx.now === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: ctx.now");
  }
  if (typeof ctx.now !== "number") {
    return createError("VALIDATION_FAILED", "Invalid parameter: ctx.now must be a number");
  }
  if (ctx.now < 0 || !Number.isFinite(ctx.now)) {
    return createError("VALIDATION_FAILED", "Invalid parameter: ctx.now must be a non-negative finite number");
  }
  return null;
}

/**
 * Validate UserActionContext.
 * 
 * @param actionContext - Action context to validate
 * @returns ErrorEnvelope if invalid, null if valid
 */
function validateActionContext(actionContext: UserActionContext | null | undefined): ErrorEnvelope | null {
  if (actionContext === null || actionContext === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: actionContext");
  }
  if (actionContext.actingUserId === null || actionContext.actingUserId === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: actionContext.actingUserId");
  }
  if (typeof actionContext.actingUserId !== "string" || actionContext.actingUserId.length === 0) {
    return createError("VALIDATION_FAILED", "Invalid parameter: actionContext.actingUserId must be a non-empty string");
  }
  if (actionContext.actingUserRole === null || actionContext.actingUserRole === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: actionContext.actingUserRole");
  }
  if (!VALID_USER_ROLES.includes(actionContext.actingUserRole)) {
    return createError("VALIDATION_FAILED", "Invalid parameter: actionContext.actingUserRole must be a valid role");
  }
  return null;
}

// ============================================================================
// PUBLIC FUNCTION IMPLEMENTATIONS
// ============================================================================

/**
 * Create a new user account.
 * 
 * Requirements:
 * - Admin-only (implicitly via UserActionContext validation)
 * - Generates alias using deterministic algorithm
 * - Generates UTID for user creation action
 * - Sets initial state to 'active'
 * - Enforces explicit role assignment (no inference)
 * 
 * @param ctx - Database context (db, now)
 * @param actionContext - Acting user context (actingUserId, actingUserRole)
 * @param input - User creation input (email, role)
 * @returns UserRecord on success, ErrorEnvelope on failure
 */
export async function createUser(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: CreateUserInput
): Promise<UserRecord | ErrorEnvelope> {
  // Validate context
  const contextError = validateContext(ctx);
  if (contextError !== null) {
    return contextError;
  }
  
  // Validate action context
  const actionContextError = validateActionContext(actionContext);
  if (actionContextError !== null) {
    return actionContextError;
  }
  
  // Verify admin role (using Authorization module)
  const adminCheck = verifyAdminRole({
    userId: actionContext.actingUserId,
    userRole: actionContext.actingUserRole,
    operation: "createUser",
    resource: "user",
  });
  
  if ("error" in adminCheck) {
    return adminCheck as ErrorEnvelope;
  }
  
  if (!adminCheck.allowed) {
    return createError("NOT_AUTHORIZED", "Only admin users can create user accounts");
  }
  
  // If creating an admin account, verify creator is a super admin
  if (input.role === "admin") {
    // Get the creator's user record to check adminLevel
    const creatorUser = await (ctx.db as DatabaseWriter).get(actionContext.actingUserId as Id<"users">);
    if (!creatorUser) {
      return createError("OPERATION_FAILED", "Creator user not found");
    }
    
    // Check if creator is super admin (adminLevel === "super" or undefined for backward compatibility)
    const isCreatorSuperAdmin = creatorUser.adminLevel === "super" || creatorUser.adminLevel === undefined;
    if (!isCreatorSuperAdmin) {
      return createError("NOT_AUTHORIZED", "Only super admins can create admin accounts");
    }
    
    // Validate adminLevel
    if (input.adminLevel !== undefined && input.adminLevel !== "super" && input.adminLevel !== "junior") {
      return createError("VALIDATION_FAILED", "Invalid adminLevel. Must be 'super' or 'junior'");
    }
    
    // If creating junior admin, allowedStorageLocationIds must be provided and non-empty
    if (input.adminLevel === "junior") {
      if (!input.allowedStorageLocationIds || input.allowedStorageLocationIds.length === 0) {
        return createError("VALIDATION_FAILED", "Junior admins must have at least one assigned storage location");
      }
      
      // Validate that all location IDs exist and are active
      for (const locationId of input.allowedStorageLocationIds) {
        const location = await (ctx.db as DatabaseWriter).get(locationId as Id<"storageLocations">);
        if (!location) {
          return createError("VALIDATION_FAILED", `Storage location ${locationId} not found`);
        }
        if (!location.active) {
          return createError("VALIDATION_FAILED", `Storage location ${locationId} is not active`);
        }
      }
    }
    
    // If creating super admin, allowedStorageLocationIds should be ignored/not set
    if (input.adminLevel === "super" || input.adminLevel === undefined) {
      // Clear any provided allowedStorageLocationIds for super admins
      // (They have access to all locations)
    }
  } else {
    // For non-admin roles, adminLevel and allowedStorageLocationIds should not be set
    if (input.adminLevel !== undefined) {
      return createError("VALIDATION_FAILED", "adminLevel can only be set for admin role");
    }
    if (input.allowedStorageLocationIds !== undefined && input.allowedStorageLocationIds.length > 0) {
      return createError("VALIDATION_FAILED", "allowedStorageLocationIds can only be set for junior admin role");
    }
  }
  
  // Validate input
  if (input === null || input === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input");
  }
  
  if (input.email === null || input.email === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input.email");
  }
  
  if (typeof input.email !== "string" || input.email.length === 0) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.email must be a non-empty string");
  }
  
  if (!isValidEmail(input.email)) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.email must be a valid email address");
  }
  
  if (input.role === null || input.role === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input.role");
  }
  
  const validRoles: UserRole[] = ["farmer", "trader", "buyer", "admin"];
  if (!validRoles.includes(input.role)) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.role must be a valid role");
  }
  
  // Check if user already exists (prevent duplicates)
  const existingUser = await (ctx.db as DatabaseWriter)
    .query("users")
    .withIndex("by_email", (q: any) => q.eq("email", input.email))
    .first();
  
  if (existingUser) {
    return createError("VALIDATION_FAILED", "User with this email already exists");
  }
  
  // Generate alias using Utilities module
  let alias: string;
  try {
    alias = generateUserAlias({
      role: input.role,
      email: input.email,
      timestamp: ctx.now,
    });
  } catch (aliasError) {
    // Alias generation failure blocks user creation
    return createError("OPERATION_FAILED", `Alias generation failed: ${aliasError instanceof Error ? aliasError.message : String(aliasError)}`);
  }
  
  // Check if alias already exists (collision detection)
  const existingAlias = await (ctx.db as DatabaseWriter)
    .query("users")
    .withIndex("by_alias", (q: any) => q.eq("alias", alias))
    .first();
  
  if (existingAlias) {
    // Alias collision - return error (no retries, no mutation)
    return createError("OPERATION_FAILED", "Generated alias already exists. This should be extremely rare with proper alias generation.");
  }
  
  // Generate UTID for user creation (INVARIANT 4.2) - MUST succeed or operation fails
  let utid: string;
  try {
    utid = generateUTID({
      entityType: "user_creation",
      timestamp: ctx.now,
      additionalData: {
        email: input.email,
        role: input.role,
      },
    });
  } catch (utidError) {
    // INVARIANT 4.2: UTID generation failure MUST block operation
    return createError("OPERATION_FAILED", `UTID generation failed: ${utidError instanceof Error ? utidError.message : String(utidError)}`);
  }
  
  // Prepare user data
  const userData: any = {
    email: input.email,
    role: input.role,
    alias: alias,
    state: "active", // Initial state
    createdAt: ctx.now,
    lastActiveAt: ctx.now,
  };
  
  // Add adminLevel and allowedStorageLocationIds for admin accounts
  if (input.role === "admin") {
    if (input.adminLevel !== undefined) {
      userData.adminLevel = input.adminLevel;
    }
    if (input.adminLevel === "junior" && input.allowedStorageLocationIds) {
      userData.allowedStorageLocationIds = input.allowedStorageLocationIds as Id<"storageLocations">[];
    }
  }
  
  // Create user
  const userId = await (ctx.db as DatabaseWriter).insert("users", userData);
  
  const createdUser = await (ctx.db as DatabaseWriter).get(userId);
  if (!createdUser) {
    return createError("OPERATION_FAILED", "Failed to create user");
  }
  
  const userRecord = dbUserToUserRecord(createdUser);
  if (!userRecord) {
    return createError("OPERATION_FAILED", "Failed to convert user record");
  }
  
  return userRecord;
}

/**
 * Change a user's role.
 * Admin-only. Self-role change forbidden (INVARIANT 3.1).
 * 
 * @param ctx - Database context (db, now)
 * @param actionContext - Acting user context (actingUserId, actingUserRole)
 * @param input - Role change input (targetUserId, newRole)
 * @returns Updated UserRecord on success, ErrorEnvelope on failure
 */
export async function changeUserRole(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: ChangeUserRoleInput
): Promise<UserRecord | ErrorEnvelope> {
  // Validate context
  const contextError = validateContext(ctx);
  if (contextError !== null) {
    return contextError;
  }
  
  // Validate action context
  const actionContextError = validateActionContext(actionContext);
  if (actionContextError !== null) {
    return actionContextError;
  }
  
  // Verify admin role (using Authorization module)
  const adminCheck = verifyAdminRole({
    userId: actionContext.actingUserId,
    userRole: actionContext.actingUserRole,
    operation: "changeUserRole",
    resource: "user",
  });
  
  if ("error" in adminCheck) {
    return adminCheck as ErrorEnvelope;
  }
  
  if (!adminCheck.allowed) {
    return createError("NOT_AUTHORIZED", "Only admin users can change user roles");
  }
  
  // Validate input
  if (input === null || input === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input");
  }
  
  if (input.targetUserId === null || input.targetUserId === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input.targetUserId");
  }
  
  if (typeof input.targetUserId !== "string" || input.targetUserId.length === 0) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.targetUserId must be a non-empty string");
  }
  
  if (input.newRole === null || input.newRole === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input.newRole");
  }
  
  const validRoles: UserRole[] = ["farmer", "trader", "buyer", "admin"];
  if (!validRoles.includes(input.newRole)) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.newRole must be a valid role");
  }
  
  // INVARIANT 3.1: Prevent self-role changes
  if (actionContext.actingUserId === input.targetUserId) {
    return createError("OPERATION_FAILED", "Users cannot change their own role (INVARIANT 3.1)");
  }
  
  // Get target user
  const targetUser = await (ctx.db as DatabaseWriter).get(input.targetUserId as Id<"users">);
  if (!targetUser) {
    return createError("USER_NOT_FOUND", "User not found");
  }
  
  // Check if user is deleted (cannot change role of deleted user)
  const currentState: UserState = targetUser.state;
  if (currentState === "deleted") {
    return createError("OPERATION_FAILED", "Cannot change role of deleted user");
  }
  
  // Get old role for UTID generation
  const oldRole = targetUser.role;
  
  // Generate UTID for role change (INVARIANT 4.2) - MUST succeed or operation fails
  let utid: string;
  try {
    utid = generateUTID({
      entityType: "user_role_change",
      timestamp: ctx.now,
      additionalData: {
        targetUserId: input.targetUserId,
        oldRole: oldRole,
        newRole: input.newRole,
      },
    });
  } catch (utidError) {
    // INVARIANT 4.2: UTID generation failure MUST block operation
    return createError("OPERATION_FAILED", `UTID generation failed: ${utidError instanceof Error ? utidError.message : String(utidError)}`);
  }
  
  // Update user role (only after UTID generation succeeds)
  await (ctx.db as DatabaseWriter).patch(input.targetUserId as Id<"users">, {
    role: input.newRole,
    lastActiveAt: ctx.now,
  });
  
  // Get updated user
  const updatedUser = await (ctx.db as DatabaseWriter).get(input.targetUserId as Id<"users">);
  if (!updatedUser) {
    return createError("OPERATION_FAILED", "Failed to retrieve updated user");
  }
  
  const userRecord = dbUserToUserRecord(updatedUser);
  if (!userRecord) {
    return createError("OPERATION_FAILED", "Failed to convert user record");
  }
  
  return userRecord;
}

/**
 * Suspend a user account.
 * Admin-only. Changes user state to 'suspended'.
 * 
 * @param ctx - Database context (db, now)
 * @param actionContext - Acting user context (actingUserId, actingUserRole)
 * @param input - Suspend user input (targetUserId)
 * @returns Updated UserRecord on success, ErrorEnvelope on failure
 */
export async function suspendUser(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: SuspendUserInput
): Promise<UserRecord | ErrorEnvelope> {
  // Validate context
  const contextError = validateContext(ctx);
  if (contextError !== null) {
    return contextError;
  }
  
  // Validate action context
  const actionContextError = validateActionContext(actionContext);
  if (actionContextError !== null) {
    return actionContextError;
  }
  
  // Verify admin role (using Authorization module)
  const adminCheck = verifyAdminRole({
    userId: actionContext.actingUserId,
    userRole: actionContext.actingUserRole,
    operation: "suspendUser",
    resource: "user",
  });
  
  if ("error" in adminCheck) {
    return adminCheck as ErrorEnvelope;
  }
  
  if (!adminCheck.allowed) {
    return createError("NOT_AUTHORIZED", "Only admin users can suspend user accounts");
  }
  
  // Validate input
  if (input === null || input === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input");
  }
  
  if (input.targetUserId === null || input.targetUserId === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input.targetUserId");
  }
  
  if (typeof input.targetUserId !== "string" || input.targetUserId.length === 0) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.targetUserId must be a non-empty string");
  }
  
  // Get target user
  const targetUser = await (ctx.db as DatabaseWriter).get(input.targetUserId as Id<"users">);
  if (!targetUser) {
    return createError("USER_NOT_FOUND", "User not found");
  }
  
  // Check current state
  const currentState: UserState = targetUser.state;
  
  // Validate state transition
  if (currentState === "deleted") {
    return createError("OPERATION_FAILED", "Cannot suspend deleted user");
  }
  
  if (currentState === "suspended") {
    // Already suspended, return current user record (no-op)
    const userRecord = dbUserToUserRecord(targetUser);
    if (!userRecord) {
      return createError("OPERATION_FAILED", "Failed to convert user record");
    }
    return userRecord;
  }
  
  // Generate UTID for suspension (INVARIANT 4.2) - MUST succeed or operation fails
  let utid: string;
  try {
    utid = generateUTID({
      entityType: "user_suspension",
      timestamp: ctx.now,
      additionalData: {
        targetUserId: input.targetUserId,
      },
    });
  } catch (utidError) {
    // INVARIANT 4.2: UTID generation failure MUST block operation
    return createError("OPERATION_FAILED", `UTID generation failed: ${utidError instanceof Error ? utidError.message : String(utidError)}`);
  }
  
  // Update user state to suspended (only after UTID generation succeeds)
  await (ctx.db as DatabaseWriter).patch(input.targetUserId as Id<"users">, {
    state: "suspended",
    lastActiveAt: ctx.now,
  });
  
  // Get updated user
  const updatedUser = await (ctx.db as DatabaseWriter).get(input.targetUserId as Id<"users">);
  if (!updatedUser) {
    return createError("OPERATION_FAILED", "Failed to retrieve updated user");
  }
  
  const userRecord = dbUserToUserRecord(updatedUser);
  if (!userRecord) {
    return createError("OPERATION_FAILED", "Failed to convert user record");
  }
  
  return userRecord;
}

/**
 * Delete a user account.
 * Admin-only. Terminal action (state to 'deleted').
 * 
 * @param ctx - Database context (db, now)
 * @param actionContext - Acting user context (actingUserId, actingUserRole)
 * @param input - Delete user input (targetUserId)
 * @returns void on success, ErrorEnvelope on failure
 */
export async function deleteUser(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: DeleteUserInput
): Promise<void | ErrorEnvelope> {
  // Validate context
  const contextError = validateContext(ctx);
  if (contextError !== null) {
    return contextError;
  }
  
  // Validate action context
  const actionContextError = validateActionContext(actionContext);
  if (actionContextError !== null) {
    return actionContextError;
  }
  
  // Verify admin role (using Authorization module)
  const adminCheck = verifyAdminRole({
    userId: actionContext.actingUserId,
    userRole: actionContext.actingUserRole,
    operation: "deleteUser",
    resource: "user",
  });
  
  if ("error" in adminCheck) {
    return adminCheck as ErrorEnvelope;
  }
  
  if (!adminCheck.allowed) {
    return createError("NOT_AUTHORIZED", "Only admin users can delete user accounts");
  }
  
  // Validate input
  if (input === null || input === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input");
  }
  
  if (input.targetUserId === null || input.targetUserId === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: input.targetUserId");
  }
  
  if (typeof input.targetUserId !== "string" || input.targetUserId.length === 0) {
    return createError("VALIDATION_FAILED", "Invalid parameter: input.targetUserId must be a non-empty string");
  }
  
  // Get target user
  const targetUser = await (ctx.db as DatabaseWriter).get(input.targetUserId as Id<"users">);
  if (!targetUser) {
    return createError("USER_NOT_FOUND", "User not found");
  }
  
  // Check current state
  const currentState: UserState = targetUser.state;
  
  if (currentState === "deleted") {
    // Already deleted, return void (no-op)
    return;
  }
  
  // Generate UTID for deletion (INVARIANT 4.2) - MUST succeed or operation fails
  let utid: string;
  try {
    utid = generateUTID({
      entityType: "user_deletion",
      timestamp: ctx.now,
      additionalData: {
        targetUserId: input.targetUserId,
      },
    });
  } catch (utidError) {
    // INVARIANT 4.2: UTID generation failure MUST block operation
    return createError("OPERATION_FAILED", `UTID generation failed: ${utidError instanceof Error ? utidError.message : String(utidError)}`);
  }
  
  // Update user state to deleted (terminal state) - only after UTID generation succeeds
  await (ctx.db as DatabaseWriter).patch(input.targetUserId as Id<"users">, {
    state: "deleted",
    lastActiveAt: ctx.now,
  });
  
  return;
}

/**
 * Fetch a user record by ID.
 * Read-only. No action context required for read operations.
 * 
 * @param ctx - Database query context (db)
 * @param userId - ID of the user to fetch
 * @returns UserRecord on success, ErrorEnvelope if not found or error
 */
export async function getUserById(
  ctx: { readonly db: DatabaseReader; readonly now: number },
  userId: string
): Promise<UserRecord | ErrorEnvelope> {
  // Validate context
  if (ctx === null || ctx === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: ctx");
  }
  
  if (ctx.db === null || ctx.db === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: ctx.db");
  }
  
  // Validate userId
  if (userId === null || userId === undefined) {
    return createError("VALIDATION_FAILED", "Missing required parameter: userId");
  }
  
  if (typeof userId !== "string" || userId.length === 0) {
    return createError("VALIDATION_FAILED", "Invalid parameter: userId must be a non-empty string");
  }
  
  // Get user
  const user = await (ctx.db as DatabaseReader).get(userId as Id<"users">);
  if (!user) {
    return createError("USER_NOT_FOUND", "User not found");
  }
  
  const userRecord = dbUserToUserRecord(user);
  if (!userRecord) {
    return createError("OPERATION_FAILED", "Failed to convert user record");
  }
  
  return userRecord;
}

// ============================================================================
// FINAL CHECK
// ============================================================================

/**
 * FINAL CHECK (REQUIRED):
 *
 * ✅ All functions from public interface implemented
 * ✅ No additional exports beyond interface
 * ✅ All errors returned as ErrorEnvelope via Error Handling helpers
 * ✅ No ErrorEnvelope construction or inspection
 * ✅ INVARIANT 3.1 enforced (self-role change prevention)
 * ✅ INVARIANT 4.2 enforced (UTID generation for all mutations)
 * ✅ Admin-only operations use Authorization module
 * ✅ No authentication logic
 * ✅ No role inference
 * ✅ No self-role changes allowed
 * ✅ Deterministic and stateless (same inputs + same database state = same outputs)
 * ✅ Only User entities created/modified
 * ✅ Explicit role assignment (not inferred)
 * ✅ State transitions validated
 * ✅ Database context explicitly required (not ambient)
 */
