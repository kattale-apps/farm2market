/**
 * User Management Module - Public Interface Only
 *
 * Step: 5a (IMPLEMENTATION_SEQUENCE.md Step 5a)
 * Status: Public interface only (no implementations, no logic, no side effects)
 * Authority: Single human (CEO / Engineering Lead / CTO)
 *
 * Context:
 * - User Management Module Specification (SPECIFICATION.md) defines requirements
 * - IMPLEMENTATION_BOUNDARIES.md defines coding constraints
 * - INVARIANTS.md (3.1, 4.2) defines user management invariants
 * - MODULARITY_GUIDE.md defines module boundaries
 * - architecture.md defines trust boundaries
 * - DOMAIN_MODEL.md defines User entity and role states
 * - BUSINESS_LOGIC.md defines user account creation workflow
 *
 * Purpose: This file defines the public interface for the User Management module.
 * This includes types, interfaces, and function signatures ONLY.
 * No implementations, no logic, no side effects.
 *
 * Rules:
 * - Types, interfaces, and function signatures ONLY
 * - No implementations
 * - No logic
 * - No side effects
 * - No imports from other modules (Error Handling types referenced conceptually)
 * - No default values
 * - No runtime assumptions
 *
 * BLOCKED Notes:
 * - Authentication: BLOCKED (User Management is separate from authentication)
 * - Role inference: BLOCKED FOR PRODUCTION (must use explicit role assignment)
 * - Self-role changes: BLOCKED (users cannot change their own role)
 */

// ============================================================================
// 1. Core User Types
// ============================================================================

/**
 * User state types (from DOMAIN_MODEL.md).
 *
 * Requirements:
 * - Must be explicit string literals (not inferred)
 * - Must match schema definition exactly
 * - Must be immutable (once defined, cannot change)
 *
 * From DOMAIN_MODEL.md:
 * - active: User account is active (initial state)
 * - suspended: User account is suspended (non-terminal state)
 * - deleted: User account is deleted (terminal state)
 */
export type UserState =
  | "active"
  | "suspended"
  | "deleted";

/**
 * User role type reference (from Authorization module).
 *
 * This type is imported from Authorization module to ensure consistency.
 * User Management module does not redefine role types.
 */
// import type { UserRole } from "../auth/types";
type UserRole = "farmer" | "trader" | "buyer" | "admin";

/**
 * User record structure.
 *
 * Requirements:
 * - Must match User entity schema (convex/schema.ts)
 * - Must be immutable (readonly fields)
 * - Must include all required fields: id, email, role, alias, state, createdAt, lastActiveAt
 *
 * From convex/schema.ts:
 * - email: User email address
 * - role: User role (farmer, trader, buyer, admin)
 * - alias: System-generated alias
 * - createdAt: Account creation timestamp
 * - lastActiveAt: Last activity timestamp
 */
export type UserRecord = {
  readonly id: string;
  readonly email: string;
  readonly role: UserRole;
  readonly alias: string;
  readonly state: UserState;
  readonly createdAt: number;
  readonly lastActiveAt: number;
};

// ============================================================================
// 2. Database Context Types
// ============================================================================

/**
 * Database reader type reference (from Convex).
 *
 * This type is intentionally opaque at this boundary.
 * User Management module uses it for database queries but does not construct it.
 */
// import type { DatabaseReader } from "../_generated/server";
type DatabaseReader = unknown;

/**
 * Database writer type reference (from Convex).
 *
 * This type is intentionally opaque at this boundary.
 * User Management module uses it for database writes but does not construct it.
 */
// import type { DatabaseWriter } from "../_generated/server";
type DatabaseWriter = unknown;

/**
 * User management context (database and time).
 *
 * Requirements:
 * - db: Database writer for creating/updating User entities
 * - now: Current timestamp (milliseconds since epoch)
 * - Must be provided by calling code (Convex mutations/queries)
 *
 * Constraints:
 * - No default values
 * - Must be provided explicitly
 * - Database context is required for user management to function
 */
export type UserManagementContext = {
  readonly db: DatabaseWriter;
  readonly now: number;
};

// ============================================================================
// 3. Action Context Types
// ============================================================================

/**
 * Context for user-affecting operations.
 *
 * Requirements:
 * - actingUserId: Required user identifier of the acting user (non-sensitive, system ID)
 * - actingUserRole: Required user role of the acting user (explicit, not inferred)
 * - Must be provided by calling code (Convex mutations/queries)
 *
 * Constraints:
 * - Must not contain sensitive information (passwords, tokens, real identities)
 * - Must not infer role (role must be explicit)
 * - Must not contain authentication data (authentication is separate)
 *
 * Used for:
 * - Admin role verification (INVARIANT 3.1: Users Cannot Change Their Own Role)
 * - Self-role change prevention (users cannot change their own role)
 */
export type UserActionContext = {
  readonly actingUserId: string;
  readonly actingUserRole: UserRole;
};

// ============================================================================
// 4. Input Types
// ============================================================================

/**
 * Input for user account creation.
 *
 * Requirements:
 * - email: Required email address (must be valid format)
 * - role: Required user role (explicit, not inferred)
 * - adminLevel: Optional admin hierarchy level (only for admin role)
 * - allowedStorageLocationIds: Optional storage location IDs (required for junior admin)
 *
 * Constraints:
 * - Role must be explicit (not inferred from email prefix)
 * - Email must be validated (server-side only)
 * - If role is "admin" and adminLevel is "junior", allowedStorageLocationIds must be provided and non-empty
 * - If role is "admin" and adminLevel is "super" or undefined, allowedStorageLocationIds should be ignored
 * - No default values
 */
export type CreateUserInput = {
  readonly email: string;
  readonly role: UserRole;
  readonly adminLevel?: "super" | "junior";
  readonly allowedStorageLocationIds?: readonly string[];
};

/**
 * Input for role change.
 *
 * Requirements:
 * - targetUserId: Required user identifier of the target user
 * - newRole: Required new role (explicit, not inferred)
 *
 * Constraints:
 * - Admin-only operation (INVARIANT 3.1 enforcement)
 * - Self-role change forbidden (actingUserId !== targetUserId)
 * - No default values
 */
export type ChangeUserRoleInput = {
  readonly targetUserId: string;
  readonly newRole: UserRole;
};

/**
 * Input for user suspension.
 *
 * Requirements:
 * - targetUserId: Required user identifier of the target user
 *
 * Constraints:
 * - Admin-only operation
 * - No default values
 */
export type SuspendUserInput = {
  readonly targetUserId: string;
};

/**
 * Input for user deletion.
 *
 * Requirements:
 * - targetUserId: Required user identifier of the target user
 *
 * Constraints:
 * - Admin-only operation
 * - Terminal action (cannot be reversed)
 * - No default values
 */
export type DeleteUserInput = {
  readonly targetUserId: string;
};

// ============================================================================
// 5. Error Surface (Conceptual Reference Only)
// ============================================================================

/**
 * ErrorEnvelope reference (from Error Handling module).
 *
 * This type is intentionally opaque at this boundary.
 * User Management module must not inspect or construct ErrorEnvelope directly.
 */
// import type { ErrorEnvelope } from "../errors/types";
type ErrorEnvelope = unknown;

// ============================================================================
// 6. Public Function Signatures
// ============================================================================

/**
 * Create a new user account.
 *
 * Requirements:
 * - Server-side only
 * - Deterministic (same inputs = same result, assuming same database state)
 * - Stateless (no internal state)
 *
 * Returns:
 * - UserRecord if creation succeeds
 * - ErrorEnvelope if creation fails due to invalid input or system error
 *
 * Operations:
 * - Validates email format (server-side)
 * - Checks if user already exists (prevents duplicates)
 * - Generates alias automatically (using Utilities module)
 * - Generates UTID for user creation action (using Utilities module)
 * - Sets initial state to "active"
 * - Sets createdAt and lastActiveAt timestamps
 *
 * BLOCKED:
 * - Role inference from email prefix is BLOCKED FOR PRODUCTION
 * - Authentication is BLOCKED (authentication is separate)
 *
 * @param ctx - User management context (database and time)
 * @param actionContext - User action context (acting user)
 * @param input - User creation input (email, role)
 */
export declare function createUser(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: CreateUserInput
): Promise<UserRecord | ErrorEnvelope>;

/**
 * Change a user's role.
 *
 * Requirements:
 * - Server-side only
 * - Admin-only (INVARIANT 3.1 enforcement)
 * - Self-role change forbidden (actingUserId !== targetUserId)
 * - Deterministic (same inputs = same result, assuming same database state)
 * - Stateless (no internal state)
 *
 * Returns:
 * - UserRecord if role change succeeds
 * - ErrorEnvelope if role change fails due to invalid input, authorization failure, or system error
 *
 * Operations:
 * - Verifies admin role (using Authorization module)
 * - Prevents self-role changes (INVARIANT 3.1 enforcement)
 * - Updates user role field (explicit role assignment, not inferred)
 * - Generates UTID for role change action (using Utilities module)
 *
 * BLOCKED:
 * - Self-role changes are BLOCKED (INVARIANT 3.1)
 * - Role inference is BLOCKED FOR PRODUCTION
 *
 * @param ctx - User management context (database and time)
 * @param actionContext - User action context (acting user)
 * @param input - Role change input (targetUserId, newRole)
 */
export declare function changeUserRole(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: ChangeUserRoleInput
): Promise<UserRecord | ErrorEnvelope>;

/**
 * Suspend a user account.
 *
 * Requirements:
 * - Server-side only
 * - Admin-only
 * - Deterministic (same inputs = same result, assuming same database state)
 * - Stateless (no internal state)
 *
 * Returns:
 * - UserRecord if suspension succeeds
 * - ErrorEnvelope if suspension fails due to invalid input, authorization failure, or system error
 *
 * Operations:
 * - Verifies admin role (using Authorization module)
 * - Changes user state from "active" to "suspended"
 * - Generates UTID for suspension action (using Utilities module)
 *
 * @param ctx - User management context (database and time)
 * @param actionContext - User action context (acting user)
 * @param input - Suspension input (targetUserId)
 */
export declare function suspendUser(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: SuspendUserInput
): Promise<UserRecord | ErrorEnvelope>;

/**
 * Delete a user account.
 *
 * Requirements:
 * - Server-side only
 * - Admin-only
 * - Terminal action (cannot be reversed)
 * - Deterministic (same inputs = same result, assuming same database state)
 * - Stateless (no internal state)
 *
 * Returns:
 * - void if deletion succeeds
 * - ErrorEnvelope if deletion fails due to invalid input, authorization failure, or system error
 *
 * Operations:
 * - Verifies admin role (using Authorization module)
 * - Changes user state to "deleted" (terminal state)
 * - Generates UTID for deletion action (using Utilities module)
 *
 * Note: User deletion is terminal state (cannot be reversed). Alias cannot be reused.
 *
 * @param ctx - User management context (database and time)
 * @param actionContext - User action context (acting user)
 * @param input - Deletion input (targetUserId)
 */
export declare function deleteUser(
  ctx: UserManagementContext,
  actionContext: UserActionContext,
  input: DeleteUserInput
): Promise<void | ErrorEnvelope>;

/**
 * Fetch a user record by ID.
 *
 * Requirements:
 * - Server-side only
 * - Read-only (no modifications)
 * - Deterministic (same inputs = same result, assuming same database state)
 * - Stateless (no internal state)
 *
 * Returns:
 * - UserRecord if user exists
 * - ErrorEnvelope if user not found or system error
 *
 * Operations:
 * - Reads User entity from database (read-only)
 * - Returns user record (no modifications)
 *
 * Note: This is a read-only operation. No UserActionContext required.
 *
 * @param ctx - User management context (database reader and time)
 * @param userId - User identifier
 */
export declare function getUserById(
  ctx: { readonly db: DatabaseReader; readonly now: number },
  userId: string
): Promise<UserRecord | ErrorEnvelope>;

// ============================================================================
// 7. BLOCKED / FORBIDDEN (Explicitly Not Present)
// ============================================================================

/**
 * BLOCKED: Authentication
 *
 * Authentication is FORBIDDEN for the User Management module.
 * User Management is separate from authentication.
 * Authentication is BLOCKED (VISION.md BLOCKED #1).
 */

/**
 * BLOCKED: Password Verification
 *
 * Password verification is FORBIDDEN for the User Management module.
 * Password verification is authentication responsibility.
 * Authentication is BLOCKED (VISION.md BLOCKED #1).
 */

/**
 * BLOCKED: Session Management
 *
 * Session management is FORBIDDEN for the User Management module.
 * Session management is authentication responsibility.
 * Authentication is BLOCKED (VISION.md BLOCKED #1).
 */

/**
 * BLOCKED: Role Inference
 *
 * Role inference from email prefix is BLOCKED FOR PRODUCTION.
 * User Management module must use explicit role assignment (not inferred).
 * (DOMAIN_MODEL.md, BUSINESS_LOGIC.md).
 */

/**
 * BLOCKED: Self-Role Changes
 *
 * Self-role changes are FORBIDDEN for the User Management module.
 * Users cannot change their own role (INVARIANT 3.1).
 * Only admin can change user roles.
 */

/**
 * BLOCKED: Frontend Access
 *
 * Frontend access to user management operations is FORBIDDEN.
 * User Management must be server-side only (frontend is untrusted).
 * (architecture.md).
 */

// ============================================================================
// FINAL CHECK
// ============================================================================

/**
 * FINAL CHECK (REQUIRED):
 *
 * ✅ Types and interfaces only
 * ✅ No implementations
 * ✅ No logic
 * ✅ No side effects
 * ✅ No runtime assumptions
 * ✅ ErrorEnvelope treated as opaque
 * ✅ Database context types are opaque (from Convex)
 * ✅ Explicit admin-only operations documented
 * ✅ Self-role change prevention documented
 * ✅ Role inference BLOCKED FOR PRODUCTION documented
 * ✅ User state transitions preserved
 * ✅ Database context explicitly required (not ambient)
 * ✅ No authorization, authentication, or business logic
 * ✅ All BLOCKED areas explicitly respected
 */
