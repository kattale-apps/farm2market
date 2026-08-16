# Exposure Calculation Refactoring

## Summary

Refactored trader exposure calculation logic to ensure there is exactly ONE canonical function used consistently across the codebase.

## Changes Made

### 1. Enhanced `calculateTraderExposureInternal` (convex/utils.ts)

**What Changed:**
- ✅ Made it the **single canonical function** for all exposure calculations
- ✅ Updated to use `MAX_TRADER_EXPOSURE_UGX` constant instead of hardcoded value
- ✅ Enhanced type signature to accept both `DatabaseReader` and `DatabaseWriter` (works in queries and mutations)
- ✅ Added comprehensive documentation explaining it's the single source of truth

**Why:**
- Eliminates duplicate exposure calculation logic
- Ensures consistent spend cap enforcement across all code paths
- Makes the function usable in both read (queries) and write (mutations) contexts

### 2. Verified Spend Cap Enforcement Order (convex/payments.ts)

**What Changed:**
- ✅ Added explicit comments documenting that spend cap enforcement happens **BEFORE** wallet debit
- ✅ Confirmed the enforcement order is correct:
  1. Calculate current exposure (line 59)
  2. Check if new exposure exceeds cap (lines 62-67)
  3. **THEN** proceed with wallet debit (line 89)

**Why:**
- Critical safety requirement: spend cap must be enforced before any money moves
- If enforcement fails, the entire mutation rolls back atomically
- Clear documentation prevents future regressions

### 3. Public Query Endpoint (convex/utils.ts)

**What Changed:**
- ✅ Kept `calculateTraderExposure` query as a wrapper around the internal function
- ✅ Added documentation clarifying it's just a client-accessible wrapper

**Why:**
- Maintains backward compatibility for client-side queries
- All calculation logic still flows through the canonical function

## Current Usage

The canonical `calculateTraderExposureInternal` function is now used in:

1. **`convex/payments.ts` - `lockUnit` mutation**
   - ✅ Calculates exposure BEFORE wallet debit
   - ✅ Enforces spend cap BEFORE any money moves
   - ✅ Uses canonical function

2. **`convex/wallet.ts` - `getWalletBalance` query**
   - ✅ Uses canonical function for exposure reporting
   - ✅ No spend cap enforcement needed (read-only query)

3. **`convex/utils.ts` - `calculateTraderExposure` query**
   - ✅ Public wrapper around canonical function
   - ✅ For client-side exposure queries

## Verification

### Spend Cap Enforcement Order ✅

In `convex/payments.ts`, the order is correct:

```typescript
// Line 59: Calculate exposure (BEFORE any wallet operations)
const exposure = await calculateTraderExposureInternal(ctx, args.traderId);

// Lines 62-67: Enforce spend cap (BEFORE wallet debit)
if (newExposure > MAX_TRADER_EXPOSURE_UGX) {
  throw new Error(...); // Mutation rolls back here
}

// Line 89: Wallet debit happens AFTER enforcement passes
await ctx.db.insert("walletLedger", {...});
```

### No Duplicate Functions ✅

- ✅ Only ONE exposure calculation function exists: `calculateTraderExposureInternal`
- ✅ All other functions are wrappers or use the canonical function
- ✅ No duplicate exposure calculation logic found

### Server-Only Usage ✅

- ✅ `calculateTraderExposureInternal` is server-only (not exported to client)
- ✅ Only the public query wrapper `calculateTraderExposure` is client-accessible
- ✅ All mutations use the internal function directly

## Constants Used

- `MAX_TRADER_EXPOSURE_UGX` from `convex/constants.ts` (1,000,000 UGX)
- Used consistently in both the calculation function and enforcement checks

## Impact

- **Safety**: Spend cap enforcement is now guaranteed to happen before wallet debit
- **Consistency**: All exposure calculations use the same logic
- **Maintainability**: Single source of truth makes future changes easier
- **Correctness**: No risk of different exposure calculations producing different results
