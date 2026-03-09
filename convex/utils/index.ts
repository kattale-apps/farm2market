/**
 * Utilities Module - Implementation
 * 
 * Step: 1c (IMPLEMENTATION_SEQUENCE.md Step 1)
 * Step 1b Extension: Alias Generation (ALIAS_GENERATION_PROPOSAL.md approved)
 * Status: Implementation complete
 * 
 * Context:
 * - convex/utils/README.md defines the full specification
 * - convex/utils/types.ts defines the public interface (Step 1a, approved and locked)
 * - convex/utils/TEST_SPECIFICATION.md defines test requirements (Step 1b, approved and locked)
 * - ALIAS_GENERATION_PROPOSAL.md defines alias generation extension
 * - IMPLEMENTATION_BOUNDARIES.md applies
 * - INVARIANTS.md (4.1, 4.2, 6.1, 6.2) applies
 * 
 * Purpose:
 * This file implements the Utilities module functions as specified.
 * All functions are pure, deterministic, and stateless.
 */

import type {
  UTIDGenerationContext,
  ExposureCalculationData,
  ExposureCalculationResult,
  ExposureValidationResult,
  SLACalculationResult,
  UserAliasGenerationContext,
} from "./types";

// ============================================================================
// ERROR IMPLEMENTATIONS
// ============================================================================

/**
 * Error thrown when a required parameter is missing.
 */
export class MissingParameterError extends Error {
  constructor(message?: string) {
    super(message || "Missing required parameter");
    this.name = "MissingParameterError";
  }
}

/**
 * Error thrown when a parameter is invalid (wrong type, negative value, etc.).
 */
export class InvalidParameterError extends Error {
  constructor(message?: string) {
    super(message || "Invalid parameter");
    this.name = "InvalidParameterError";
  }
}

/**
 * Error thrown when a function behaves non-deterministically.
 */
export class DeterminismViolationError extends Error {
  constructor(message?: string) {
    super(message || "Determinism violation detected");
    this.name = "DeterminismViolationError";
  }
}

// ============================================================================
// INTERNAL HELPER FUNCTIONS (Pure, Deterministic, Stateless)
// ============================================================================

/**
 * Simple deterministic hash function for UTID generation.
 * Pure, deterministic, stateless.
 * 
 * @param input - String input to hash
 * @returns Hash value as number
 */
function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Convert object to deterministic string representation.
 * Pure, deterministic, stateless.
 * 
 * @param obj - Object to stringify
 * @returns Deterministic string representation
 */
function deterministicStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  const parts: string[] = [];
  for (const key of keys) {
    const value = obj[key];
    if (value === null || value === undefined) {
      parts.push(`${key}:null`);
    } else if (typeof value === "object") {
      parts.push(`${key}:${deterministicStringify(value as Record<string, unknown>)}`);
    } else {
      parts.push(`${key}:${String(value)}`);
    }
  }
  return `{${parts.join(",")}}`;
}

// ============================================================================
// PUBLIC FUNCTIONS
// ============================================================================

/**
 * Generate a unique, deterministic UTID (Unique Transaction ID).
 * 
 * Contract: Pure function, deterministic, stateless, no side effects
 * Supports: INVARIANT 4.1 (UTID Immutability), INVARIANT 4.2 (All Meaningful Actions Generate UTIDs)
 * 
 * @param context - Context for UTID generation (entityType, timestamp, optional additionalData)
 * @returns UTID string (unique, deterministic, immutable identifier)
 * @throws MissingParameterError if required parameters are missing
 * @throws InvalidParameterError if parameters are invalid
 * @throws DeterminismViolationError if UTID generation is non-deterministic
 */
export function generateUTID(context: UTIDGenerationContext): string {
  // Validate context
  if (context === null || context === undefined) {
    throw new MissingParameterError("Missing required parameter: context");
  }

  // Validate entityType
  if (context.entityType === null || context.entityType === undefined) {
    throw new MissingParameterError("Missing required parameter: context.entityType");
  }
  if (typeof context.entityType !== "string") {
    throw new InvalidParameterError("Invalid parameter: context.entityType must be a string");
  }
  if (context.entityType.length === 0) {
    throw new InvalidParameterError("Invalid parameter: context.entityType must not be empty");
  }

  // Validate timestamp
  if (context.timestamp === null || context.timestamp === undefined) {
    throw new MissingParameterError("Missing required parameter: context.timestamp");
  }
  if (typeof context.timestamp !== "number") {
    throw new InvalidParameterError("Invalid parameter: context.timestamp must be a number");
  }
  if (context.timestamp < 0) {
    throw new InvalidParameterError("Invalid parameter: context.timestamp must be non-negative");
  }
  if (!Number.isFinite(context.timestamp)) {
    throw new InvalidParameterError("Invalid parameter: context.timestamp must be a finite number");
  }

  // Validate additionalData if provided
  if (context.additionalData !== null && context.additionalData !== undefined) {
    if (typeof context.additionalData !== "object" || Array.isArray(context.additionalData)) {
      throw new InvalidParameterError("Invalid parameter: context.additionalData must be an object");
    }
  }

  // Generate deterministic UTID
  // Format: entityType-timestamp-hash(additionalData)
  // This ensures uniqueness and determinism
  try {
    const entityPart = context.entityType;
    const timestampPart = Math.floor(context.timestamp).toString(36);
    const additionalPart = context.additionalData
      ? simpleHash(deterministicStringify(context.additionalData)).toString(36)
      : "0";
    
    const utid = `${entityPart}-${timestampPart}-${additionalPart}`;
    
    // Verify determinism: same inputs should produce same UTID
    // This is guaranteed by the algorithm (no randomness, no external state)
    return utid;
  } catch (error) {
    // If any error occurs during UTID generation, it's a determinism violation
    throw new DeterminismViolationError(`UTID generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Calculate trader exposure and verify it does not exceed UGX 1,000,000.
 * 
 * Contract: Pure function, deterministic, stateless, no side effects
 * Supports: INVARIANT 6.1 (Trader Exposure Limit Enforcement), INVARIANT 6.2 (Exposure Calculation Atomicity)
 * 
 * @param exposureData - Exposure calculation data (capitalCommitted, lockedOrders, inventoryValue)
 * @returns Exposure calculation result (totalExposure, exceedsLimit, limit, remainingCapacity)
 * @throws MissingParameterError if required parameters are missing
 * @throws InvalidParameterError if parameters are invalid
 * @throws DeterminismViolationError if exposure calculation is non-deterministic
 */
export function calculateExposure(
  exposureData: ExposureCalculationData
): ExposureCalculationResult {
  // Validate exposureData
  if (exposureData === null || exposureData === undefined) {
    throw new MissingParameterError("Missing required parameter: exposureData");
  }

  // Validate capitalCommitted
  if (exposureData.capitalCommitted === null || exposureData.capitalCommitted === undefined) {
    throw new InvalidParameterError("Missing required parameter: exposureData.capitalCommitted");
  }
  if (typeof exposureData.capitalCommitted !== "number") {
    throw new InvalidParameterError("Invalid parameter: exposureData.capitalCommitted must be a number");
  }
  if (exposureData.capitalCommitted < 0) {
    throw new InvalidParameterError("Invalid parameter: exposureData.capitalCommitted must be non-negative");
  }
  if (!Number.isFinite(exposureData.capitalCommitted)) {
    throw new InvalidParameterError("Invalid parameter: exposureData.capitalCommitted must be a finite number");
  }

  // Validate lockedOrders
  if (exposureData.lockedOrders === null || exposureData.lockedOrders === undefined) {
    throw new InvalidParameterError("Missing required parameter: exposureData.lockedOrders");
  }
  if (typeof exposureData.lockedOrders !== "number") {
    throw new InvalidParameterError("Invalid parameter: exposureData.lockedOrders must be a number");
  }
  if (exposureData.lockedOrders < 0) {
    throw new InvalidParameterError("Invalid parameter: exposureData.lockedOrders must be non-negative");
  }
  if (!Number.isFinite(exposureData.lockedOrders)) {
    throw new InvalidParameterError("Invalid parameter: exposureData.lockedOrders must be a finite number");
  }

  // Validate inventoryValue
  if (exposureData.inventoryValue === null || exposureData.inventoryValue === undefined) {
    throw new InvalidParameterError("Missing required parameter: exposureData.inventoryValue");
  }
  if (typeof exposureData.inventoryValue !== "number") {
    throw new InvalidParameterError("Invalid parameter: exposureData.inventoryValue must be a number");
  }
  if (exposureData.inventoryValue < 0) {
    throw new InvalidParameterError("Invalid parameter: exposureData.inventoryValue must be non-negative");
  }
  if (!Number.isFinite(exposureData.inventoryValue)) {
    throw new InvalidParameterError("Invalid parameter: exposureData.inventoryValue must be a finite number");
  }

  // Calculate exposure (deterministic, pure, stateless)
  const EXPOSURE_LIMIT = 1000000; // UGX 1,000,000
  const totalExposure = exposureData.capitalCommitted + exposureData.lockedOrders + exposureData.inventoryValue;
  const exceedsLimit = totalExposure > EXPOSURE_LIMIT;
  const remainingCapacity = exceedsLimit ? 0 : EXPOSURE_LIMIT - totalExposure;

  return {
    totalExposure,
    exceedsLimit,
    limit: EXPOSURE_LIMIT,
    remainingCapacity,
  };
}

/**
 * Validate that exposure does not exceed UGX 1,000,000 limit.
 * 
 * Contract: Pure function, deterministic, stateless, no side effects
 * Supports: INVARIANT 6.1 (Trader Exposure Limit Enforcement)
 * 
 * @param exposure - Total exposure to validate (UGX)
 * @returns Exposure validation result (isValid, exceedsLimit, limit, excess)
 * @throws MissingParameterError if exposure is missing
 * @throws InvalidParameterError if exposure is invalid
 */
export function validateExposureLimit(exposure: number): ExposureValidationResult {
  // Validate exposure
  if (exposure === null || exposure === undefined) {
    throw new MissingParameterError("Missing required parameter: exposure");
  }
  if (typeof exposure !== "number") {
    throw new InvalidParameterError("Invalid parameter: exposure must be a number");
  }
  if (exposure < 0) {
    throw new InvalidParameterError("Invalid parameter: exposure must be non-negative");
  }
  if (!Number.isFinite(exposure)) {
    throw new InvalidParameterError("Invalid parameter: exposure must be a finite number");
  }

  // Validate exposure limit (deterministic, pure, stateless)
  const EXPOSURE_LIMIT = 1000000; // UGX 1,000,000
  const exceedsLimit = exposure > EXPOSURE_LIMIT;
  const isValid = !exceedsLimit;
  const excess = exceedsLimit ? exposure - EXPOSURE_LIMIT : 0;

  return {
    isValid,
    exceedsLimit,
    limit: EXPOSURE_LIMIT,
    excess,
  };
}

/**
 * Calculate farmer delivery deadline (6 hours from lock time).
 * 
 * Contract: Pure function, deterministic, stateless, no side effects
 * Supports: Business logic (not an invariant)
 * 
 * Note: isExpired and timeRemaining require current time, which is not accessible.
 * Since current time is not accessible (not in function signature),
 * these fields are set to conservative defaults (isExpired: false, timeRemaining: 0).
 * Callers should calculate isExpired and timeRemaining if needed.
 * 
 * @param lockTime - Timestamp when unit was locked (milliseconds since epoch)
 * @returns SLA calculation result (deadline, slaHours, isExpired, timeRemaining)
 * @throws MissingParameterError if lockTime is missing
 * @throws InvalidParameterError if lockTime is invalid
 * @throws DeterminismViolationError if SLA calculation is non-deterministic
 */
export function calculateFarmerDeliverySLA(lockTime: number): SLACalculationResult {
  // Validate lockTime
  if (lockTime === null || lockTime === undefined) {
    throw new MissingParameterError("Missing required parameter: lockTime");
  }
  if (typeof lockTime !== "number") {
    throw new InvalidParameterError("Invalid parameter: lockTime must be a number");
  }
  if (lockTime < 0) {
    throw new InvalidParameterError("Invalid parameter: lockTime must be non-negative");
  }
  if (!Number.isFinite(lockTime)) {
    throw new InvalidParameterError("Invalid parameter: lockTime must be a finite number");
  }

  // Calculate deadline (6 hours from lock time)
  const SLA_HOURS = 6;
  const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
  const deadline = lockTime + (SLA_HOURS * MILLISECONDS_PER_HOUR);

  // isExpired and timeRemaining require current time, which is not accessible.
  // Since current time is not accessible (not in function signature),
  // we return conservative defaults that are deterministic and pure.
  // Callers should calculate isExpired and timeRemaining if needed.
  const isExpired = false; // Conservative default (cannot determine without current time)
  const timeRemaining = 0; // Conservative default (cannot determine without current time)

  return {
    deadline,
    slaHours: SLA_HOURS,
    isExpired,
    timeRemaining,
  };
}

/**
 * Calculate buyer pickup deadline (48 hours from purchase time).
 * 
 * Contract: Pure function, deterministic, stateless, no side effects
 * Supports: Business logic (not an invariant)
 * 
 * BLOCKED: Buyer purchase function is NOT IMPLEMENTED (BLOCKED).
 * This function may not be used until purchase function is implemented.
 * 
 * Note: isExpired and timeRemaining require current time, which is not accessible.
 * Since current time is not accessible (not in function signature),
 * these fields are set to conservative defaults (isExpired: false, timeRemaining: 0).
 * Callers should calculate isExpired and timeRemaining if needed.
 * 
 * @param purchaseTime - Timestamp when inventory was purchased (milliseconds since epoch)
 * @returns SLA calculation result (deadline, slaHours, isExpired, timeRemaining)
 * @throws MissingParameterError if purchaseTime is missing
 * @throws InvalidParameterError if purchaseTime is invalid
 * @throws DeterminismViolationError if SLA calculation is non-deterministic
 */
export function calculateBuyerPickupSLA(purchaseTime: number): SLACalculationResult {
  // Validate purchaseTime
  if (purchaseTime === null || purchaseTime === undefined) {
    throw new MissingParameterError("Missing required parameter: purchaseTime");
  }
  if (typeof purchaseTime !== "number") {
    throw new InvalidParameterError("Invalid parameter: purchaseTime must be a number");
  }
  if (purchaseTime < 0) {
    throw new InvalidParameterError("Invalid parameter: purchaseTime must be non-negative");
  }
  if (!Number.isFinite(purchaseTime)) {
    throw new InvalidParameterError("Invalid parameter: purchaseTime must be a finite number");
  }

  // Calculate deadline (48 hours from purchase time)
  const SLA_HOURS = 48;
  const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
  const deadline = purchaseTime + (SLA_HOURS * MILLISECONDS_PER_HOUR);

  // isExpired and timeRemaining require current time, which is not accessible.
  // Since current time is not accessible (not in function signature),
  // we return conservative defaults that are deterministic and pure.
  // Callers should calculate isExpired and timeRemaining if needed.
  const isExpired = false; // Conservative default (cannot determine without current time)
  const timeRemaining = 0; // Conservative default (cannot determine without current time)

  return {
    deadline,
    slaHours: SLA_HOURS,
    isExpired,
    timeRemaining,
  };
}

/**
 * Deterministic hash function for alias generation.
 * Pure, deterministic, stateless.
 * Returns base36 string representation for compact alias format.
 * 
 * @param input - String input to hash
 * @returns Hash value as base36 string
 */
function hashString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0; // Force 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a deterministic, stable, non-identifying user alias.
 * 
 * Contract: Pure function, deterministic, stateless, no side effects
 * Supports: User anonymity (DOMAIN_MODEL.md, BUSINESS_LOGIC.md)
 * 
 * Format: {rolePrefix}_{timestampHash}_{emailHash}
 * Example: "far_a3k9x2_m7p4q1"
 * 
 * Requirements enforced:
 * - Deterministic: same inputs → same output
 * - Stateless: no internal memory
 * - Pure: no side effects
 * - Non-identifying: email is hashed, never exposed
 * 
 * @param context - Context for alias generation (role, email, timestamp)
 * @returns Alias string (stable, non-identifying, deterministic identifier)
 * @throws MissingParameterError if required parameters are missing
 * @throws InvalidParameterError if parameters are invalid
 * @throws DeterminismViolationError if alias generation is non-deterministic
 */
export function generateUserAlias(
  context: UserAliasGenerationContext
): string {
  // Validate context
  if (context === null || context === undefined) {
    throw new MissingParameterError("Missing required parameter: context");
  }

  // Validate role
  if (context.role === null || context.role === undefined) {
    throw new MissingParameterError("Missing required parameter: context.role");
  }
  if (typeof context.role !== "string") {
    throw new InvalidParameterError("Invalid parameter: context.role must be a string");
  }
  if (context.role.length === 0) {
    throw new InvalidParameterError("Invalid parameter: context.role must not be empty");
  }

  // Validate email
  if (context.email === null || context.email === undefined) {
    throw new MissingParameterError("Missing required parameter: context.email");
  }
  if (typeof context.email !== "string") {
    throw new InvalidParameterError("Invalid parameter: context.email must be a string");
  }
  if (context.email.length === 0) {
    throw new InvalidParameterError("Invalid parameter: context.email must not be empty");
  }
  // Validate email format (must contain @ symbol)
  const atIndex = context.email.indexOf("@");
  if (atIndex <= 0 || atIndex >= context.email.length - 1) {
    throw new InvalidParameterError("Invalid parameter: context.email must be a valid email address (must contain @ symbol)");
  }

  // Validate timestamp
  if (context.timestamp === null || context.timestamp === undefined) {
    throw new MissingParameterError("Missing required parameter: context.timestamp");
  }
  if (typeof context.timestamp !== "number") {
    throw new InvalidParameterError("Invalid parameter: context.timestamp must be a number");
  }
  if (context.timestamp < 0) {
    throw new InvalidParameterError("Invalid parameter: context.timestamp must be non-negative");
  }
  if (!Number.isFinite(context.timestamp)) {
    throw new InvalidParameterError("Invalid parameter: context.timestamp must be a finite number");
  }

  // Generate deterministic alias
  // Format: {rolePrefix}_{timestampHash}_{emailHash}
  // This ensures uniqueness and determinism
  try {
    // Use full role name (lowercase) as alias prefix
    const rolePrefix = context.role.toLowerCase();
    
    // Hash timestamp (deterministic)
    const timestampHash = hashString(context.timestamp.toString()).slice(0, 6);
    
    // Hash email (deterministic, lowercase for consistency)
    // Email is hashed and never exposed in alias (preserves anonymity)
    const emailHash = hashString(context.email.toLowerCase()).slice(0, 6);
    
    // Combine: rolePrefix_timestampHash_emailHash
    const alias = `${rolePrefix}_${timestampHash}_${emailHash}`;
    
    // Verify determinism: same inputs should produce same alias
    // This is guaranteed by the algorithm (no randomness, no external state)
    return alias;
  } catch (error) {
    // If any error occurs during alias generation, it's a determinism violation
    throw new DeterminismViolationError(`Alias generation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
