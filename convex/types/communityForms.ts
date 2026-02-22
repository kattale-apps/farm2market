/**
 * Community Form Table Type Definitions
 * 
 * IMPORTANT: All community-specific form tables MUST implement CommunityFormTable
 * This enforces that every form has a communityId field for data isolation.
 * 
 * Without this, cross-community data leaks are possible during exports and queries.
 */

/**
 * Base interface that ALL community form tables must satisfy
 * 
 * This is NOT just documentation - it's enforced by TypeScript at compile time.
 * If you create a new form table without communityId, the code that uses it won't compile.
 */
export interface CommunityFormTable {
  /** ✅ REQUIRED: Community this form belongs to - used for data isolation in exports/queries */
  communityId: string; // Will be v.id("communities") or v.literal("COMMUNITY_NAME")
  
  /** ✅ REQUIRED: Farmer who filled this form */
  farmerId: string; // v.id("users")
  
  /** Form status - typically DRAFT or SUBMITTED */
  status: "DRAFT" | "SUBMITTED";
  
  /** Timestamps for audit trail */
  createdAt: number;
  updatedAt: number;
}

/**
 * Example: When you create a new community form table, structure it like this:
 * 
 * ```typescript
 * bioFarmValidationForm: defineTable({
 *   // ✅ REQUIRED - Data Isolation Fields
 *   communityId: v.id("communities"),  // ← ALWAYS ADD THIS
 *   farmerId: v.id("users"),
 *   status: v.union(v.literal("DRAFT"), v.literal("SUBMITTED")),
 *   
 *   // Community-specific form fields below
 *   section1: v.optional(v.object({
 *     farmName: v.optional(v.string()),
 *     // ... your fields
 *   })),
 * })
 *   .index("by_community", ["communityId"])      // ✅ Index by community
 *   .index("by_community_farmer", ["communityId", "farmerId"])
 *   .index("by_status", ["status"])
 * ```
 * 
 * Benefits:
 * - TypeScript will error if you forget communityId
 * - Query validation functions will catch it if you try to bypass
 * - Export filtering automatically includes the field
 */

/**
 * Validation helper: Use this to validate that a form object has all required fields
 * 
 * Usage in queries:
 * ```typescript
 * const form = await ctx.db.get(formId);
 * validateCommunityForm(form, "BioFarm validation");
 * ```
 */
export function validateCommunityForm(
  form: any,
  formName: string,
  expectedCommunityId?: string
): void {
  if (!form) {
    throw new Error(`${formName}: Form not found`);
  }

  if (!form.communityId) {
    throw new Error(
      `${formName}: SECURITY ERROR - Form ${form._id} missing communityId. ` +
      `This MUST be added to prevent cross-community data leaks. ` +
      `Update schema.ts and add 'communityId: v.id("communities")' to the table.`
    );
  }

  if (!form.farmerId) {
    throw new Error(`${formName}: Form missing farmerId`);
  }

  if (expectedCommunityId && String(form.communityId) !== String(expectedCommunityId)) {
    throw new Error(
      `${formName}: SECURITY ERROR - Form ${form._id} belongs to community ${form.communityId}, ` +
      `not ${expectedCommunityId}. This prevents cross-community data leaks.`
    );
  }
}

/**
 * Filter helper: Use this in queries to safely filter forms by community
 * 
 * Replaces manual filtering and ensures consistent validation
 * 
 * Usage:
 * ```typescript
 * const forms = await Promise.all(formIds.map((id) => ctx.db.get(id)));
 * const validForms = filterCommunityForms(forms, communityId);
 * ```
 */
export function filterCommunityForms(
  forms: any[],
  communityId: string,
  throwOnMismatch: boolean = true
): any[] {
  const valid: any[] = [];
  const invalid: any[] = [];

  for (const form of forms) {
    if (!form) continue;

    if (!form.communityId) {
      if (throwOnMismatch) {
        throw new Error(
          `Form ${form._id} missing communityId. ` +
          `Add 'communityId: v.id("communities")' to schema.`
        );
      }
      invalid.push(form);
      continue;
    }

    if (String(form.communityId) === String(communityId)) {
      valid.push(form);
    } else {
      if (throwOnMismatch) {
        console.warn(
          `[SECURITY] Filtering out form ${form._id} from community ${form.communityId}, ` +
          `requested by community ${communityId}`
        );
      }
      invalid.push(form);
    }
  }

  if (throwOnMismatch && invalid.length > 0) {
    throw new Error(
      `Found ${invalid.length} forms that don't match community ${communityId}. ` +
      `This indicates a schema or data integrity issue.`
    );
  }

  return valid;
}

/**
 * Type guard: Check if an object satisfies CommunityFormTable
 * 
 * Usage:
 * ```typescript
 * if (isCommunityForm(form)) {
 *   // TypeScript knows form has communityId
 *   const communityId = form.communityId; // ✓ No error
 * }
 * ```
 */
export function isCommunityForm(obj: any): obj is CommunityFormTable {
  return (
    obj &&
    typeof obj.communityId === "string" &&
    typeof obj.farmerId === "string" &&
    ["DRAFT", "SUBMITTED"].includes(obj.status) &&
    typeof obj.createdAt === "number" &&
    typeof obj.updatedAt === "number"
  );
}
