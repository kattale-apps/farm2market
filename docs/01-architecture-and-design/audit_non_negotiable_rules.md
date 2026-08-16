# Audit: Non-Negotiable Rules Compliance

**Date**: Audit of Convex codebase against MASTER SYSTEM & EXECUTION DOCUMENT (v1.1)  
**Scope**: All Convex functions and schema

---

## ✅ CONFIRMED INVARIANTS

### 1. Anonymity Enforcement ✅

**Status**: **ENFORCED**

- ✅ **Schema**: Stores `email` but it's **never exposed** in queries
- ✅ **`getUser` query**: Returns only `alias`, `role`, `userId`, `createdAt` - no email or real identity
- ✅ **`getActiveListings` query**: Returns `farmerAlias` only, not real identity
- ✅ **`getListingDetails` query**: Returns `farmerAlias` only
- ✅ **No phone numbers**: Schema does not store phone numbers
- ✅ **Alias generation**: System-generated aliases in `createUser` mutation
- ✅ **Alias format**: `role_prefix_randomstring` (e.g., "farmer_a3k9x2")

**Evidence**:
- `convex/auth.ts:70-85` - `getUser` only returns alias
- `convex/listings.ts:86-100` - `getActiveListings` uses `farmerAlias`
- `convex/auth.ts:18-22` - `generateAlias` creates non-identifying aliases

---

### 2. Role Enforcement Server-Side ✅

**Status**: **ENFORCED** (with one weak point)

- ✅ **All mutations verify roles server-side**:
  - `createUser`: Validates role in args (schema enforces union type)
  - `depositCapital`: Checks `user.role !== "trader"` (line 83)
  - `withdrawProfit`: Checks `user.role !== "trader"` (line 132)
  - `lockUnit`: Checks `user.role !== "trader"` (line 37)
  - `createListing`: Checks `user.role !== "farmer"` (line 28)
  - `openPurchaseWindow`: Uses `verifyAdmin` (line 59)
  - `closePurchaseWindow`: Uses `verifyAdmin` (line 103)

- ✅ **Never trusts client claims**: All role checks query database first
- ✅ **Schema enforces role union**: `v.union(v.literal("farmer"), ...)` prevents invalid roles

**Evidence**:
- All mutations follow pattern: `const user = await ctx.db.get(userId); if (!user || user.role !== requiredRole) throw Error`
- `convex/admin.ts:17-22` - `verifyAdmin` function enforces admin role

---

### 3. UTID Presence in Financial Actions ✅

**Status**: **ENFORCED** (for existing functions)

- ✅ **Wallet operations**:
  - `depositCapital`: Generates UTID (line 92), stores in ledger (line 108)
  - `withdrawProfit`: Generates UTID (line 160), stores in ledger (line 176)
  - `lockUnit`: Generates UTID (line 91), stores in wallet ledger (line 98) and unit (line 115)

- ✅ **Inventory operations**:
  - `createListing`: Generates UTID (line 37), stores in listing (line 48)

- ✅ **Admin actions**:
  - `openPurchaseWindow`: Generates UTID via `logAdminAction` (line 75), stores in window (line 87)
  - `closePurchaseWindow`: Generates UTID via `logAdminAction` (line 114)

- ✅ **Schema requires UTIDs**: All financial/inventory tables have `utid` field (required, not optional)

**Evidence**:
- `convex/schema.ts:42` - `walletLedger.utid` is required
- `convex/schema.ts:66` - `listings.utid` is required
- `convex/schema.ts:127` - `traderInventory.utid` is required
- `convex/schema.ts:157` - `buyerPurchases.utid` is required

---

### 4. Spend Cap Enforcement Before Payment ✅

**Status**: **ENFORCED**

- ✅ **`lockUnit` mutation**: Enforces spend cap **BEFORE** wallet debit
  - Line 66: Calculate exposure
  - Lines 69-74: Check if new exposure exceeds cap (throws if exceeded)
  - Line 96: Wallet debit happens **AFTER** enforcement passes

- ✅ **Uses canonical function**: `calculateTraderExposureInternal` is the single source of truth
- ✅ **Atomic rollback**: If spend cap check fails, entire mutation rolls back (no partial state)

**Evidence**:
- `convex/payments.ts:58-74` - Spend cap enforcement with explicit comments
- `convex/payments.ts:96` - Wallet debit happens after enforcement
- `convex/utils.ts:44-110` - Canonical exposure calculation function

---

### 5. Atomicity of Pay-to-Lock ✅

**Status**: **ENFORCED**

- ✅ **Single mutation**: `lockUnit` is one atomic mutation
- ✅ **Convex guarantees**: All operations in a mutation are atomic
- ✅ **Operations in order**:
  1. Spend cap check (lines 66-74)
  2. Available capital check (lines 86-88)
  3. Wallet debit (line 96)
  4. Unit lock (lines 111-116)
  5. Listing status update (lines 127-136)

- ✅ **Rollback guarantee**: If any step fails, entire operation rolls back
- ✅ **First payment wins**: Unit status check (line 46) prevents double-locking

**Evidence**:
- `convex/payments.ts:29-148` - All operations in single mutation
- `convex/payments.ts:46` - Unit availability check prevents race conditions
- Convex mutation atomicity: All database operations in one mutation are atomic

---

### 6. Admin-Only Authority ✅

**Status**: **ENFORCED**

- ✅ **`verifyAdmin` function**: Checks `user.role !== "admin"` (line 19)
- ✅ **All admin functions use it**:
  - `openPurchaseWindow`: Calls `verifyAdmin` (line 59)
  - `closePurchaseWindow`: Calls `verifyAdmin` (line 103)

- ✅ **Admin actions logged**: `logAdminAction` creates entry with:
  - UTID (line 36)
  - Reason (required parameter)
  - Timestamp (line 44)
  - Target UTID (optional, for related transactions)

- ✅ **Admin action log**: `adminActions` table stores all admin actions

**Evidence**:
- `convex/admin.ts:17-22` - `verifyAdmin` enforces admin role
- `convex/admin.ts:28-46` - `logAdminAction` logs all admin actions
- `convex/schema.ts:193-205` - `adminActions` table schema

---

## ⚠️ WEAK POINTS

### 1. Missing Critical Functions

**Issue**: Schema defines tables but mutations don't exist:

- ❌ **`traderInventory` creation**: No mutation to create inventory from delivered units
- ❌ **`buyerPurchases` creation**: No mutation for buyers to purchase from traders
- ❌ **`storageFeeDeductions` creation**: No mutation to apply storage fees
- ❌ **Unit delivery confirmation**: No mutation to mark units as delivered

**Impact**: 
- System cannot complete the full transaction flow
- Inventory management is incomplete
- Storage fees cannot be applied
- Buyers cannot make purchases

**Required Functions** (not implemented):
- `markUnitsDelivered` - Farmer confirms delivery, creates traderInventory
- `createBuyerPurchase` - Buyer purchases from trader (during open window)
- `applyStorageFees` - Admin/system applies storage fee deductions
- `unlockCapital` - Trader unlocks capital after delivery (if needed)

---

### 2. Type Safety in Admin Functions

**Issue**: `verifyAdmin` and `logAdminAction` use `ctx: any`

**Location**: `convex/admin.ts:17, 28`

**Impact**: 
- Loses TypeScript type safety
- Could allow incorrect usage

**Recommendation**: Use proper Convex context types:
```typescript
async function verifyAdmin(ctx: MutationCtx, adminId: Id<"users">)
async function logAdminAction(ctx: MutationCtx, ...)
```

---

### 3. Role Verification Query Not Used

**Issue**: `verifyRole` is a query, not used by mutations

**Location**: `convex/auth.ts:92-117`

**Impact**: 
- Mutations do their own role checks (good)
- But `verifyRole` query could be used by client incorrectly
- Client could call `verifyRole` and trust the result (bad pattern)

**Recommendation**: 
- Keep `verifyRole` for client-side UI hints only
- Ensure all mutations do their own server-side checks (✅ already done)
- Consider making it `internalQuery` if only used server-side

---

### 4. Email Storage (Low Risk)

**Issue**: Schema stores `email` in users table

**Status**: **ACCEPTABLE** - Email is never exposed in queries

**Evidence**:
- `getUser` does not return email
- All listing queries return aliases only
- Email is only used for account lookup, not user interaction

**Recommendation**: 
- Current implementation is correct
- Email is needed for authentication/account management
- As long as it's never exposed in queries, anonymity is maintained

---

## ❌ MISSING ENFORCEMENT

### 1. Buyer Purchase Window Enforcement

**Issue**: No mutation exists to create buyer purchases, so window enforcement cannot be verified

**Required**: When `createBuyerPurchase` is implemented, it must:
- ✅ Check `isPurchaseWindowOpen` query result
- ✅ Verify buyer role server-side
- ✅ Generate UTID
- ✅ Never expose prices to buyer
- ✅ Enforce 48-hour pickup SLA

**Status**: **CANNOT VERIFY** - Function doesn't exist yet

---

### 2. Storage Fee Application

**Issue**: No mutation exists to apply storage fees

**Required**: When `applyStorageFees` is implemented, it must:
- ✅ Deduct kilos (not money)
- ✅ Generate UTID for each deduction
- ✅ Log all deductions in `storageFeeDeductions` table
- ✅ Update inventory kilos

**Status**: **CANNOT VERIFY** - Function doesn't exist yet

---

### 3. Trader Inventory Creation

**Issue**: No mutation exists to create trader inventory from delivered units

**Required**: When `markUnitsDelivered` is implemented, it must:
- ✅ Verify farmer role
- ✅ Verify units belong to farmer's listing
- ✅ Verify units are locked (paid for)
- ✅ Create `traderInventory` with UTID
- ✅ Aggregate into 100kg blocks
- ✅ Update unit status to "delivered"

**Status**: **CANNOT VERIFY** - Function doesn't exist yet

---

## SUMMARY

### ✅ Strengths

1. **Anonymity**: Fully enforced - no real identities exposed
2. **Role enforcement**: All mutations verify roles server-side
3. **UTID presence**: All existing financial actions generate UTIDs
4. **Spend cap**: Enforced before payment in `lockUnit`
5. **Atomicity**: Pay-to-lock is atomic (single mutation)
6. **Admin authority**: Admin functions properly protected and logged

### ⚠️ Weak Points

1. **Missing functions**: Critical mutations don't exist (inventory, purchases, storage fees)
2. **Type safety**: Admin functions use `any` types
3. **Email storage**: Stored but never exposed (acceptable)

### ❌ Missing Enforcement

1. **Buyer purchase window**: Cannot verify (function doesn't exist)
2. **Storage fees**: Cannot verify (function doesn't exist)
3. **Inventory creation**: Cannot verify (function doesn't exist)

---

## RECOMMENDATIONS

### Priority 1: Implement Missing Functions

1. **`markUnitsDelivered`** - Complete farmer→trader flow
2. **`createBuyerPurchase`** - Complete trader→buyer flow
3. **`applyStorageFees`** - Complete storage fee system

### Priority 2: Type Safety

1. Fix `verifyAdmin` and `logAdminAction` to use proper Convex types

### Priority 3: Documentation

1. Document that `verifyRole` query is for UI hints only
2. Document that email storage is acceptable (never exposed)

---

**Conclusion**: The existing codebase correctly enforces all non-negotiable rules for implemented features. However, critical functions are missing that prevent the full transaction flow from working. Once these functions are implemented, they must follow the same enforcement patterns.
