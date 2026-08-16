# Buyer Purchase Implementation

## Overview

The `createBuyerPurchase` mutation allows buyers to purchase inventory from traders during admin-opened purchase windows. All operations are atomic, and UTIDs are only generated on successful purchase.

---

## Validation Order

### 1. First Validation: Purchase Window (CRITICAL)

**Location**: `convex/buyers.ts:30-40`

```typescript
// FIRST VALIDATION - happens before any other checks
const purchaseWindow = await ctx.db
  .query("purchaseWindows")
  .withIndex("by_status", (q) => q.eq("isOpen", true))
  .first();

if (!purchaseWindow) {
  throw new Error("Purchase window is not open...");
}
```

**Why First**:
- ✅ **Fail fast**: Rejects invalid requests immediately
- ✅ **No unnecessary work**: Doesn't check inventory if window is closed
- ✅ **Clear error**: Buyer knows exactly why purchase failed
- ✅ **Admin control**: Enforces admin authority over purchase timing

**Failure Path**: 
- Mutation throws error immediately
- No state changes occur
- No UTID generated

### 2. Buyer Role Verification

**Location**: `convex/buyers.ts:42-46`

```typescript
const user = await ctx.db.get(args.buyerId);
if (!user || user.role !== "buyer") {
  throw new Error("User is not a buyer");
}
```

**Failure Path**:
- Mutation throws error
- No state changes
- No UTID generated

### 3. Inventory Validation

**Location**: `convex/buyers.ts:52-70`

**Checks**:
- Inventory exists
- Inventory status is `"in_storage"` (available)
- Requested kilos ≤ available kilos

**Failure Paths**:
- **Inventory not found**: Error thrown, no changes
- **Wrong status**: Error with current status, no changes
- **Insufficient kilos**: Error with available amount, no changes

### 4. Atomic Lock and Purchase

**Location**: `convex/buyers.ts:72-95`

**Operations** (all atomic):
1. Lock inventory (`status → "sold"`)
2. Generate UTID (only here, after all validations pass)
3. Create buyer purchase entry

**Failure Path**: If any operation fails, all roll back atomically.

---

## Failure Paths

### Path 1: Purchase Window Closed

**Scenario**: Buyer attempts purchase when window is closed

**Flow**:
1. ✅ Query purchase window
2. ❌ No open window found
3. ❌ **Error thrown**: "Purchase window is not open..."
4. ❌ **No state changes**
5. ❌ **No UTID generated**

**Result**: 
- Inventory remains available
- No purchase created
- Buyer receives clear error message

---

### Path 2: User Not a Buyer

**Scenario**: Non-buyer attempts purchase

**Flow**:
1. ✅ Purchase window check passes
2. ✅ Query user
3. ❌ `user.role !== "buyer"`
4. ❌ **Error thrown**: "User is not a buyer"
5. ❌ **No state changes**
6. ❌ **No UTID generated**

**Result**:
- Inventory remains available
- No purchase created
- Role enforcement prevents unauthorized access

---

### Path 3: Inventory Not Found

**Scenario**: Invalid inventoryId provided

**Flow**:
1. ✅ Purchase window check passes
2. ✅ Buyer role verified
3. ✅ Query inventory
4. ❌ Inventory not found
5. ❌ **Error thrown**: "Inventory not found"
6. ❌ **No state changes**
7. ❌ **No UTID generated**

**Result**:
- No state changes
- Clear error message

---

### Path 4: Inventory Not Available

**Scenario**: Inventory exists but status is not "in_storage"

**Flow**:
1. ✅ Purchase window check passes
2. ✅ Buyer role verified
3. ✅ Inventory found
4. ❌ `inventory.status !== "in_storage"`
5. ❌ **Error thrown**: "Inventory is not available for purchase. Current status: {status}"
6. ❌ **No state changes**
7. ❌ **No UTID generated**

**Possible Statuses**:
- `"pending_delivery"`: Not yet delivered to trader
- `"sold"`: Already purchased by another buyer
- `"expired"`: Inventory expired

**Result**:
- Inventory status unchanged
- No purchase created
- Buyer knows why purchase failed

---

### Path 5: Insufficient Kilos

**Scenario**: Buyer requests more kilos than available

**Flow**:
1. ✅ Purchase window check passes
2. ✅ Buyer role verified
3. ✅ Inventory found and available
4. ❌ `args.kilos > inventory.totalKilos`
5. ❌ **Error thrown**: "Requested kilos (X) exceeds available inventory (Y kg)"
6. ❌ **No state changes**
7. ❌ **No UTID generated**

**Result**:
- Inventory remains available
- No purchase created
- Buyer knows available amount

---

### Path 6: Concurrent Purchase (Race Condition)

**Scenario**: Two buyers attempt to purchase same inventory simultaneously

**Flow**:

#### Buyer A (First to Execute)
1. ✅ All validations pass
2. ✅ Inventory status is `"in_storage"`
3. ✅ Patch inventory: `status → "sold"`
4. ✅ Generate UTID
5. ✅ Create buyer purchase
6. ✅ **Success**

#### Buyer B (Executes After Buyer A)
1. ✅ Purchase window check passes
2. ✅ Buyer role verified
3. ✅ Query inventory
4. ❌ `inventory.status === "sold"` (updated by Buyer A)
5. ❌ **Error thrown**: "Inventory is not available for purchase. Current status: sold"
6. ❌ **No state changes**
7. ❌ **No UTID generated**

**Result**:
- ✅ First buyer wins (atomic lock)
- ❌ Second buyer fails (inventory already sold)
- ✅ No double purchase possible

**Why This Works**:
- Convex mutations are serialized
- Inventory lock happens atomically
- Second buyer reads updated status

---

### Path 7: Database Write Failure

**Scenario**: Network or database error during write

**Flow**:
1. ✅ All validations pass
2. ✅ Attempt to patch inventory
3. ❌ Database write fails
4. ❌ **Mutation throws error**
5. ❌ **Automatic rollback**: All operations rolled back
6. ❌ **No UTID generated**

**Result**:
- Inventory status unchanged
- No purchase created
- No UTID generated
- System remains in consistent state

---

## UTID Behavior

### When UTID is Generated

**Location**: `convex/buyers.ts:85-86`

```typescript
// UTID is generated ONLY after all validations pass
// and inventory is successfully locked
const purchaseUtid = generateUTID(user.role);
```

**Timing**:
- ✅ **After** purchase window validation
- ✅ **After** buyer role verification
- ✅ **After** inventory validation
- ✅ **After** inventory lock (status → "sold")
- ❌ **Before** creating buyer purchase entry

**Why This Order**:
- UTID is only created when purchase will definitely succeed
- If any validation fails, no UTID is generated
- UTID generation is cheap, so it's safe to do after lock

### UTID Format

**Function**: `generateUTID("buyer")`  
**Format**: `YYYYMMDD-HHMMSS-buy-RANDOM`  
**Example**: `20240215-143022-buy-a3k9x2`

### Where UTID is Stored

1. **buyerPurchases.utid** (required field)
   - Primary UTID for the purchase
   - Used to reference the purchase transaction

2. **Referenced in**:
   - Buyer purchase queries
   - Admin action logs (if admin intervenes)
   - Future pickup verification (when implemented)

### UTID Chain

```
Purchase Window UTID (admin action)
  └─> Purchase UTID (buyer purchase)
       └─> (Future) Pickup Verification UTID
```

**Example**:
```
Window UTID: "20240215-100000-adm-w1x2y3"
  └─> Purchase UTID: "20240215-143022-buy-a3k9x2"
       └─> (Future) Pickup UTID: "20240217-143022-buy-b4k5x3"
```

### UTID on Failure

**Key Rule**: **No UTID generated on failure**

**Failure Scenarios**:
- ❌ Purchase window closed → No UTID
- ❌ Not a buyer → No UTID
- ❌ Inventory not found → No UTID
- ❌ Inventory not available → No UTID
- ❌ Insufficient kilos → No UTID
- ❌ Database error → No UTID

**Why**:
- UTIDs represent successful transactions
- Failed attempts don't need UTIDs
- Prevents UTID pollution in database
- Clear distinction between attempts and transactions

### UTID Uniqueness

**Guarantee**: Each successful purchase gets unique UTID

**Mechanism**:
- `generateUTID` uses timestamp + random string
- Timestamp ensures uniqueness across time
- Random string ensures uniqueness within same second
- Format: `YYYYMMDD-HHMMSS-role-random`

**Collision Probability**: Negligible
- Timestamp precision: 1 second
- Random string: 6 characters (36^6 = 2.1 billion combinations)
- Combined: ~2.1 billion unique IDs per second

---

## Atomicity Guarantees

### All-or-Nothing

**Convex Guarantee**: All operations in mutation are atomic

```typescript
// All of these happen atomically:
await ctx.db.patch(args.inventoryId, { status: "sold" });  // Step 1
const purchaseUtid = generateUTID(user.role);              // Step 2
await ctx.db.insert("buyerPurchases", { utid: purchaseUtid, ... }); // Step 3
```

**Scenarios**:

1. **All succeed**: Complete purchase, UTID created
2. **Step 1 fails**: No inventory lock, no UTID, no purchase
3. **Step 2 fails**: (Cannot fail - UTID generation is pure function)
4. **Step 3 fails**: Inventory lock rolled back, no UTID, no purchase

### No Partial State

**Impossible States**:
- ❌ Inventory locked but no purchase entry
- ❌ Purchase entry but inventory not locked
- ❌ UTID generated but purchase not created

**Why**:
- All operations in single mutation
- Convex guarantees atomicity
- Automatic rollback on failure

---

## Example Flows

### Successful Purchase

1. **Buyer calls**: `createBuyerPurchase(buyerId, inventoryId, 50)`
2. ✅ Purchase window open
3. ✅ Buyer role verified
4. ✅ Inventory found, status `"in_storage"`, 100kg available
5. ✅ 50kg ≤ 100kg (valid)
6. ✅ Lock inventory: `status → "sold"`
7. ✅ Generate UTID: `"20240215-143022-buy-a3k9x2"`
8. ✅ Create purchase entry with UTID
9. ✅ **Return**: Purchase details with UTID

**State After**:
- Inventory: `status = "sold"`
- Purchase: Created with `utid = "20240215-143022-buy-a3k9x2"`
- UTID: Generated and stored

### Failed Purchase (Window Closed)

1. **Buyer calls**: `createBuyerPurchase(buyerId, inventoryId, 50)`
2. ❌ Purchase window closed
3. ❌ **Error thrown**: "Purchase window is not open..."
4. ❌ **No state changes**
5. ❌ **No UTID generated**

**State After**:
- Inventory: Unchanged (`status = "in_storage"`)
- Purchase: Not created
- UTID: Not generated

### Failed Purchase (Concurrent)

**Buyer A**:
1. ✅ All validations pass
2. ✅ Lock inventory: `status → "sold"`
3. ✅ Generate UTID: `"20240215-143022-buy-a3k9x2"`
4. ✅ Create purchase
5. ✅ **Success**

**Buyer B** (simultaneous):
1. ✅ Purchase window open
2. ✅ Buyer role verified
3. ✅ Query inventory
4. ❌ `inventory.status === "sold"` (locked by Buyer A)
5. ❌ **Error thrown**: "Inventory is not available... Current status: sold"
6. ❌ **No UTID generated**

**State After**:
- Inventory: `status = "sold"` (locked by Buyer A)
- Buyer A purchase: Created with UTID
- Buyer B purchase: Not created, no UTID

---

## Summary

### Failure Paths ✅

1. **Purchase window closed**: Fails immediately, no UTID
2. **Not a buyer**: Role check fails, no UTID
3. **Inventory not found**: Validation fails, no UTID
4. **Inventory not available**: Status check fails, no UTID
5. **Insufficient kilos**: Validation fails, no UTID
6. **Concurrent purchase**: Second buyer fails, no UTID
7. **Database error**: Rollback, no UTID

### UTID Behavior ✅

1. **Generated only on success**: After all validations pass
2. **Stored in purchase entry**: `buyerPurchases.utid`
3. **Unique per purchase**: Timestamp + random ensures uniqueness
4. **Not generated on failure**: Failed attempts have no UTID
5. **Part of UTID chain**: Links to purchase window and future operations

### Atomicity ✅

1. **All operations atomic**: Single mutation guarantees
2. **No partial state**: Either complete purchase or no changes
3. **Automatic rollback**: Failures cause complete rollback
4. **Inventory lock atomic**: Prevents concurrent purchases

---

*Implementation Date: Buyer purchase mutation added*  
*Status: Fully atomic - UTID only on success*
