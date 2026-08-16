# Delivery Failure Reversal Implementation

## Overview

The `reverseDeliveryFailure` mutation atomically reverses failed delivery transactions. It unlocks units, reverses wallet ledger entries, and marks transactions as failed - all in a single atomic operation with no possibility of partial state.

---

## Conditions

### Required Conditions

1. **Admin Authority**: Only admins can trigger reversals
2. **Delivery Status**: `deliveryStatus` must be `"late"` OR `"cancelled"`
3. **Unit Status**: Unit must be in `"locked"` status
4. **Wallet Entry**: Must exist a `capital_lock` entry with matching `lockUtid`

### Validation Flow

```typescript
// 1. Admin verification (server-side)
await verifyAdmin(ctx, args.adminId);

// 2. Find unit by lockUtid
const unit = await ctx.db.query("listingUnits")
  .withIndex("by_lock_utid", (q) => q.eq("lockUtid", args.lockUtid))
  .first();

// 3. Validate unit status
if (unit.status !== "locked") throw Error;

// 4. Validate delivery status
if (unit.deliveryStatus !== "late" && unit.deliveryStatus !== "cancelled") {
  throw Error;
}

// 5. Find wallet entry
const walletEntry = await ctx.db.query("walletLedger")
  .withIndex("by_utid", (q) => q.eq("utid", args.lockUtid))
  .first();

// 6. Validate wallet entry type
if (walletEntry.type !== "capital_lock") throw Error;
```

**If any validation fails**: Mutation throws error, no state changes occur.

---

## Effects (Atomic)

### 1. Unlock Units

**Operation**: Update `listingUnits` record

```typescript
await ctx.db.patch(unit._id, {
  status: "available",              // Unit becomes available again
  lockedBy: undefined,               // Clear trader reference
  lockedAt: undefined,               // Clear lock timestamp
  lockUtid: undefined,               // Clear lock UTID
  deliveryDeadline: undefined,       // Clear deadline
  deliveryStatus: undefined,         // Clear delivery status
});
```

**Result**: Unit is available for other traders to lock.

### 2. Reverse Wallet Ledger Entries

**Operation**: Create `capital_unlock` ledger entry

```typescript
await ctx.db.insert("walletLedger", {
  userId: walletEntry.userId,
  utid: reversalUtid,                // New UTID for reversal
  type: "capital_unlock",            // Reverses capital_lock
  amount: unlockAmount,               // Same amount as original lock
  balanceAfter: newBalance,          // Balance after unlock
  timestamp: Date.now(),
  metadata: {
    originalLockUtid: args.lockUtid, // References original lock
    unitId: unit._id,
    reason: args.reason,
  },
});
```

**Result**: Trader's capital is unlocked and available again.

### 3. Mark Transaction Failed

**Operation**: Update listing status if needed

```typescript
// If all units in listing are now available
if (lockedCount === 0 && availableCount > 0) {
  await ctx.db.patch(listing._id, {
    status: "active",                // Listing active again
    deliverySLA: 0,                  // Clear delivery SLA
  });
}
```

**Result**: Listing reflects that transaction failed.

---

## How Atomicity is Preserved

### 1. Single Mutation Guarantee

**Convex Atomicity**: All operations in a mutation are atomic by default.

```typescript
export const reverseDeliveryFailure = mutation({
  handler: async (ctx, args) => {
    // ALL of these operations are in ONE mutation
    // Convex guarantees: ALL succeed or ALL fail
    
    await ctx.db.insert("walletLedger", {...});  // Step 1
    await ctx.db.patch(unit._id, {...});         // Step 2
    await ctx.db.patch(listing._id, {...});      // Step 3
    await logAdminAction(ctx, {...});            // Step 4
  },
});
```

**Why This Works**:
- ✅ **Convex guarantee**: All database operations in a mutation are atomic
- ✅ **No partial writes**: Either all operations succeed or none do
- ✅ **Automatic rollback**: If any operation fails, all previous operations roll back

### 2. Validation Before Writes

**Order of Operations**:
1. **Read operations** (queries) - no state changes
2. **Validation** - check all conditions
3. **Write operations** - only if validation passes

```typescript
// PHASE 1: Read and validate (no state changes)
const unit = await ctx.db.query(...).first();
const walletEntry = await ctx.db.query(...).first();
// Validate conditions...

// PHASE 2: Write operations (only if validation passes)
await ctx.db.insert("walletLedger", {...});  // Write 1
await ctx.db.patch(unit._id, {...});         // Write 2
await ctx.db.patch(listing._id, {...});      // Write 3
```

**Why This Matters**:
- ✅ **Fail fast**: Validation happens before any writes
- ✅ **No orphaned data**: If validation fails, no partial writes occur
- ✅ **Consistent state**: All writes happen together or not at all

### 3. No External Dependencies

**Self-Contained**: All data needed is within the mutation.

```typescript
// All data fetched within mutation
const unit = await ctx.db.query(...).first();
const walletEntry = await ctx.db.query(...).first();
const listing = await ctx.db.get(unit.listingId);

// All operations use this data
await ctx.db.insert("walletLedger", {...});  // Uses walletEntry
await ctx.db.patch(unit._id, {...});         // Uses unit
await ctx.db.patch(listing._id, {...});      // Uses listing
```

**Why This Matters**:
- ✅ **No race conditions**: All data read at start of mutation
- ✅ **Consistent snapshot**: Data doesn't change during mutation execution
- ✅ **Predictable**: No external factors can cause partial state

### 4. Error Handling

**Failures Cause Rollback**:

```typescript
// If unit not found
if (!unit) {
  throw new Error(...);  // Mutation fails, no state changes
}

// If validation fails
if (unit.status !== "locked") {
  throw new Error(...);  // Mutation fails, no state changes
}

// If wallet entry not found
if (!walletEntry) {
  throw new Error(...);  // Mutation fails, no state changes
}
```

**Why This Works**:
- ✅ **Early exit**: Errors thrown before any writes
- ✅ **Automatic rollback**: Convex rolls back any writes if error occurs
- ✅ **No partial state**: Either all operations succeed or none do

### 5. UTID References

**All Operations Reference UTIDs**:

```typescript
// Original lock UTID
const lockUtid = args.lockUtid;

// Reversal UTID (new)
const reversalUtid = generateUTID("admin");

// Admin action UTID (new)
const adminActionUtid = await logAdminAction(...);

// Wallet entry references original
metadata: { originalLockUtid: lockUtid }

// Admin action references original
targetUtid: lockUtid
```

**Why This Matters**:
- ✅ **Traceability**: Can trace from lock → reversal
- ✅ **Audit trail**: All operations linked via UTIDs
- ✅ **Reversibility**: Can verify reversal matches original lock

---

## Atomicity Guarantees

### Scenario 1: All Operations Succeed

**Result**: Complete reversal
- ✅ Unit unlocked
- ✅ Capital unlocked
- ✅ Listing updated
- ✅ Admin action logged

### Scenario 2: Validation Fails

**Result**: No state changes
- ❌ Unit remains locked
- ❌ Capital remains locked
- ❌ Listing unchanged
- ❌ No admin action logged

### Scenario 3: Write Operation Fails

**Result**: Automatic rollback
- ❌ All previous writes rolled back
- ❌ Unit remains locked
- ❌ Capital remains locked
- ❌ Listing unchanged
- ❌ No admin action logged

### Scenario 4: Concurrent Reversal Attempts

**Result**: First succeeds, second fails
- ✅ First mutation: All operations succeed
- ❌ Second mutation: Unit no longer locked, validation fails
- ✅ No double reversal possible

---

## UTID Chain

### Complete Transaction Lifecycle

```
1. lockUtid (original payment)
   ├─> walletLedger entry (capital_lock)
   └─> listingUnits.lockUtid

2. adminActionUtid (verification)
   ├─> adminActions entry
   └─> references lockUtid (targetUtid)

3. reversalUtid (reversal)
   ├─> walletLedger entry (capital_unlock)
   ├─> references lockUtid (metadata.originalLockUtid)
   └─> listingUnits cleared (lockUtid = undefined)

4. adminActionUtid_reversal (reversal log)
   ├─> adminActions entry
   └─> references lockUtid (targetUtid)
```

### Example UTIDs

```typescript
{
  lockUtid: "20240215-143022-tra-a3k9x2",           // Original lock
  reversalUtid: "20240215-203022-adm-x7p9q1",        // Capital unlock
  adminActionUtid: "20240215-203023-adm-y8r0s2",      // Reversal log
}
```

---

## Example Flow

### Scenario: Farmer fails to deliver, admin reverses

1. **Trader locks unit** (T0)
   - `lockUtid = "20240215-143022-tra-a3k9x2"`
   - `walletLedger`: `capital_lock` entry created
   - `listingUnits`: `status = "locked"`, `lockUtid = lockUtid`

2. **6 hours pass** (T0 + 6 hours)
   - `deliveryDeadline` expires
   - `deliveryStatus` still `"pending"`

3. **Admin verifies as "late"**
   - `verifyDelivery(adminId, lockUtid, "late", reason)`
   - `deliveryStatus = "late"`
   - Capital still locked, unit still locked

4. **Admin reverses delivery**
   - `reverseDeliveryFailure(adminId, lockUtid, reason)`
   - ✅ **Atomic operation begins**:
     - Validates: unit is locked, deliveryStatus is "late"
     - Creates: `capital_unlock` entry (`reversalUtid`)
     - Updates: unit `status = "available"`, clears lock fields
     - Updates: listing status if needed
     - Logs: admin action (`adminActionUtid`)
   - ✅ **All operations succeed atomically**

5. **Result**
   - Unit available for other traders
   - Trader capital unlocked
   - Transaction marked as failed
   - Full audit trail maintained

---

## Summary

### Atomicity Mechanisms ✅

1. **Single Mutation**: All operations in one mutation
2. **Convex Guarantee**: Automatic atomicity for all writes
3. **Validation First**: All checks before any writes
4. **Error Handling**: Failures cause automatic rollback
5. **No External Dependencies**: All data within mutation

### What Cannot Happen ❌

- ❌ Unit unlocked but capital still locked
- ❌ Capital unlocked but unit still locked
- ❌ Partial reversal (some operations succeed, others fail)
- ❌ Double reversal (concurrent reversals)
- ❌ Orphaned data (writes without corresponding entries)

### Guarantees ✅

- ✅ **All or nothing**: Either complete reversal or no changes
- ✅ **Consistent state**: Database always in valid state
- ✅ **Traceable**: All operations linked via UTIDs
- ✅ **Auditable**: All actions logged with UTID and reason

---

*Implementation Date: Delivery failure reversal added*  
*Status: Fully atomic - no partial state possible*
