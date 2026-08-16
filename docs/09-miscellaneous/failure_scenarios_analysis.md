# Failure Scenarios: Step-by-Step System Behavior Analysis

This document walks through critical failure scenarios and explains exactly what happens in the system.

---

## Scenario 1: Two Traders Attempt to Pay-to-Lock the Same 10kg Unit Simultaneously

### Initial State
- **Unit**: `listingUnits` record with `status: "available"`
- **Trader A**: Calls `lockUnit(traderAId, unitId)` at time T1
- **Trader B**: Calls `lockUnit(traderBId, unitId)` at time T2 (simultaneously)

### Step-by-Step Execution

#### Trader A's Mutation (First to Execute)
1. **Role Verification** (line 36-39)
   - ✅ Checks `user.role === "trader"` → Passes
   
2. **Unit Availability Check** (line 42-48)
   - Reads unit: `status === "available"` → ✅ Passes
   
3. **Spend Cap Enforcement** (line 66-74)
   - Calculates exposure for Trader A
   - Checks if `newExposure <= 1,000,000` → ✅ Passes (assumed)
   
4. **Available Capital Check** (line 86-88)
   - Checks `availableCapital >= unitPrice` → ✅ Passes (assumed)
   
5. **UTID Generation** (line 91)
   - Creates: `UTID_A = "20240315-143022-tra-a3k9x2"`
   
6. **Atomic Operations** (lines 96-116)
   - ✅ **Step 1**: Inserts `walletLedger` entry with `utid: UTID_A`, `type: "capital_lock"`
   - ✅ **Step 2**: Patches unit: `status: "locked"`, `lockedBy: traderAId`, `lockUtid: UTID_A`
   - ✅ **Step 3**: Updates listing status if needed

**Result**: Trader A successfully locks the unit.

#### Trader B's Mutation (Executes After Trader A)
1. **Role Verification** (line 36-39)
   - ✅ Checks `user.role === "trader"` → Passes
   
2. **Unit Availability Check** (line 42-48)
   - Reads unit: `status === "locked"` (updated by Trader A)
   - ❌ **FAILS**: `unit.status !== "available"`
   - **Throws Error**: `"Unit is not available"`

3. **Mutation Rolls Back**
   - No wallet debit occurs
   - No UTID generated
   - No state changes

**Result**: Trader B's mutation fails atomically.

### State Changes
- ✅ **Unit**: `status: "available"` → `status: "locked"`, `lockedBy: traderAId`, `lockUtid: UTID_A`
- ✅ **Wallet Ledger**: New entry with `utid: UTID_A`, `type: "capital_lock"`, `userId: traderAId`
- ✅ **Listing**: Status updated to `"partially_locked"` or `"fully_locked"` (if applicable)
- ❌ **Trader B**: No state changes (mutation failed)

### What Is Prevented
- ✅ **Double-locking**: Only one trader can lock a unit
- ✅ **Race conditions**: Convex mutations are serialized - first one wins
- ✅ **Partial state**: If Trader B's mutation had progressed further, it would roll back completely

### UTIDs Created
- ✅ **UTID_A**: Generated for Trader A's successful lock
  - Stored in: `walletLedger.utid`, `listingUnits.lockUtid`
- ❌ **UTID_B**: Not generated (mutation failed before UTID generation)

### Key Mechanism
**Convex Mutation Serialization**: Convex executes mutations sequentially for the same data. When Trader A's mutation completes, the unit status changes to "locked". Trader B's mutation then reads the updated status and fails immediately.

---

## Scenario 2: Trader Exceeds UGX 1,000,000 Exposure by 1 Unit

### Initial State
- **Trader**: Current exposure = 999,950 UGX
- **Unit Price**: 100 UGX (10kg × 10 UGX/kg)
- **New Exposure Would Be**: 1,000,050 UGX (exceeds cap by 50 UGX)

### Step-by-Step Execution

1. **Role Verification** (line 36-39)
   - ✅ Checks `user.role === "trader"` → Passes
   
2. **Unit Availability Check** (line 42-48)
   - Reads unit: `status === "available"` → ✅ Passes
   
3. **Spend Cap Enforcement** (line 66-74)
   - Calls `calculateTraderExposureInternal(ctx, traderId)`
   - Returns: `{ totalExposure: 999950, ... }`
   - Calculates: `newExposure = 999950 + 100 = 1,000,050`
   - Checks: `1,000,050 > 1,000,000` → ❌ **FAILS**
   - **Throws Error**: `"Spend cap exceeded. Current exposure: 999950 UGX, would be: 1000050 UGX (cap: 1000000 UGX)"`

4. **Mutation Rolls Back**
   - No wallet debit occurs
   - No UTID generated
   - No unit lock occurs
   - No state changes

### State Changes
- ❌ **No state changes**: Entire mutation fails before any database writes

### What Is Prevented
- ✅ **Spend cap violation**: Trader cannot exceed 1,000,000 UGX exposure
- ✅ **Wallet debit**: No money is locked
- ✅ **Unit lock**: Unit remains available for other traders
- ✅ **Partial state**: No partial updates occur

### UTIDs Created
- ❌ **No UTID**: Mutation fails before UTID generation (line 91 never reached)

### Key Mechanism
**Enforcement Before Payment**: Spend cap is checked **BEFORE** any wallet debit (line 66-74 happens before line 96). This ensures the trader's exposure never exceeds the cap, even momentarily.

---

## Scenario 3: Farmer Does Not Deliver Within 6 Hours

### Initial State
- **Unit**: `status: "locked"`, `lockedAt: T0`, `lockUtid: "UTID_LOCK"`
- **Listing**: `deliverySLA: T0 + 6 hours` (set when unit was locked)
- **Current Time**: `T0 + 7 hours` (1 hour past SLA)

### System Behavior (Current Implementation)

**Note**: The current codebase does not have automated SLA enforcement. The system tracks the SLA timestamp but does not automatically take action when it expires.

### What Happens
1. **SLA Timestamp Exists**: `listing.deliverySLA = T0 + 6 hours`
2. **No Automatic Enforcement**: No scheduled job or cron function checks for expired SLAs
3. **Manual Review Required**: Admin must manually check and take action

### State Changes
- ❌ **No automatic state changes**: System does not automatically update unit or listing status
- ⚠️ **Unit remains**: `status: "locked"` (not automatically changed to "delivered" or "cancelled")
- ⚠️ **Listing remains**: Status unchanged (still "partially_locked" or "fully_locked")

### What Is Prevented
- ❌ **Automatic enforcement**: SLA violation is not automatically detected or handled
- ⚠️ **Manual intervention required**: Admin must manually verify and update status

### UTIDs Created
- ❌ **No new UTID**: No automatic action occurs

### Missing Implementation
**Required Functions** (not yet implemented):
- `checkDeliverySLAs` - Scheduled function to check expired delivery SLAs
- `markDeliveryLate` - Admin function to mark delivery as late
- `cancelLockedUnits` - Admin function to cancel units if delivery fails

### Current Workaround
Admin must:
1. Query listings with expired `deliverySLA`
2. Manually verify delivery status
3. Use admin override functions (when implemented) to update status

---

## Scenario 4: Admin Verifies Delivery Late

### Initial State
- **Unit**: `status: "locked"`, `lockedAt: T0`, `lockUtid: "UTID_LOCK"`
- **Delivery SLA**: `T0 + 6 hours` (expired)
- **Current Time**: `T0 + 8 hours` (2 hours past SLA)
- **Admin**: Calls delivery verification function (not yet implemented)

### System Behavior (Current Implementation)

**Note**: The current codebase does not have a delivery verification function. This scenario describes what **should** happen when implemented.

### Expected Step-by-Step Execution (When Implemented)

1. **Admin Verification** (hypothetical function)
   - Admin calls `verifyDelivery(adminId, unitId, reason)`
   - Function checks: `user.role === "admin"` → ✅ Passes
   
2. **UTID Generation**
   - Creates: `UTID_VERIFY = generateUTID("admin")`
   
3. **Admin Action Logging**
   - Logs: `adminActions` entry with:
     - `actionType: "verify_delivery"`
     - `utid: UTID_VERIFY`
     - `targetUtid: UTID_LOCK` (references original lock)
     - `reason: reason` (required)
     - `timestamp: T0 + 8 hours`
   
4. **Unit Status Update**
   - Updates unit: `status: "locked"` → `status: "delivered"`
   
5. **Inventory Creation** (if all units delivered)
   - Creates `traderInventory` entry with:
     - `utid: UTID_INVENTORY` (new UTID)
     - `status: "in_storage"`
     - `acquiredAt: T0 + 8 hours`
     - `storageStartTime: T0 + 8 hours`

### State Changes (When Implemented)
- ✅ **Unit**: `status: "locked"` → `status: "delivered"`
- ✅ **Admin Actions**: New entry with `utid: UTID_VERIFY`, `actionType: "verify_delivery"`
- ✅ **Trader Inventory**: New entry created (if all units delivered)
- ✅ **Listing**: Status updated to `"delivered"` (if all units delivered)

### What Is Prevented
- ✅ **Unauthorized verification**: Only admin can verify delivery
- ✅ **Untracked actions**: All admin actions are logged with UTID and reason
- ✅ **Late delivery tracking**: System records when delivery actually occurred vs. SLA

### UTIDs Created (When Implemented)
- ✅ **UTID_VERIFY**: Admin action UTID for verification
- ✅ **UTID_INVENTORY**: Trader inventory creation UTID (if applicable)

### Current Status
- ❌ **Function not implemented**: No `verifyDelivery` function exists
- ⚠️ **Manual process required**: Admin must manually update database or wait for implementation

---

## Scenario 5: Buyer Attempts Purchase Outside Open Window

### Initial State
- **Purchase Window**: `purchaseWindows.isOpen = false` (window is closed)
- **Buyer**: Calls `createBuyerPurchase(buyerId, inventoryId, kilos)` (function not yet implemented)

### System Behavior (Current Implementation)

**Note**: The current codebase does not have a `createBuyerPurchase` function. This scenario describes what **should** happen when implemented.

### Expected Step-by-Step Execution (When Implemented)

1. **Role Verification** (hypothetical function)
   - Checks: `user.role === "buyer"` → ✅ Passes
   
2. **Purchase Window Check** (CRITICAL)
   - Calls `isPurchaseWindowOpen()` query
   - Returns: `{ isOpen: false, ... }`
   - ❌ **FAILS**: `if (!isOpen) throw new Error("Purchase window is not open")`
   
3. **Mutation Rolls Back**
   - No purchase created
   - No UTID generated
   - No state changes

### State Changes
- ❌ **No state changes**: Mutation fails before any database writes

### What Is Prevented
- ✅ **Purchases outside window**: Buyers cannot purchase when window is closed
- ✅ **Unauthorized purchases**: Only buyers can attempt purchases (role check)
- ✅ **Price exposure**: Buyers never see prices (enforced in function design)

### UTIDs Created
- ❌ **No UTID**: Mutation fails before UTID generation

### Required Implementation Pattern

When `createBuyerPurchase` is implemented, it **must**:

```typescript
export const createBuyerPurchase = mutation({
  args: {
    buyerId: v.id("users"),
    inventoryId: v.id("traderInventory"),
    kilos: v.number(),
  },
  handler: async (ctx, args) => {
    // 1. Verify buyer role
    const user = await ctx.db.get(args.buyerId);
    if (!user || user.role !== "buyer") {
      throw new Error("User is not a buyer");
    }

    // 2. CHECK PURCHASE WINDOW (CRITICAL)
    const window = await ctx.db
      .query("purchaseWindows")
      .withIndex("by_status", (q) => q.eq("isOpen", true))
      .first();
    
    if (!window) {
      throw new Error("Purchase window is not open");
    }

    // 3. Verify inventory exists and is available
    // 4. Generate UTID
    // 5. Create buyerPurchase entry
    // 6. Update inventory status
    // ...
  },
});
```

### Current Status
- ❌ **Function not implemented**: No `createBuyerPurchase` function exists
- ✅ **Window check exists**: `isPurchaseWindowOpen` query is available for use
- ⚠️ **Enforcement pending**: Window enforcement will be implemented when purchase function is created

---

## Summary Table

| Scenario | State Changes | Prevention | UTIDs Created | Status |
|----------|--------------|------------|---------------|--------|
| **1. Simultaneous Pay-to-Lock** | ✅ First trader locks unit | ✅ Double-locking prevented | ✅ UTID for winner only | ✅ **Working** |
| **2. Exceed Spend Cap** | ❌ No changes | ✅ Cap violation prevented | ❌ No UTID | ✅ **Working** |
| **3. Late Delivery** | ❌ No automatic changes | ❌ No automatic enforcement | ❌ No UTID | ⚠️ **Not Implemented** |
| **4. Admin Verifies Late** | ⚠️ Depends on implementation | ✅ Admin-only, logged | ✅ UTIDs when implemented | ⚠️ **Not Implemented** |
| **5. Purchase Outside Window** | ❌ No changes | ✅ Window check prevents | ❌ No UTID | ⚠️ **Not Implemented** |

---

## Key Takeaways

### ✅ Working Correctly
1. **Pay-to-lock race conditions**: Convex serialization ensures first payment wins
2. **Spend cap enforcement**: Enforced before payment, prevents violations
3. **Atomic operations**: Mutations roll back completely on failure

### ⚠️ Requires Implementation
1. **SLA enforcement**: No automated checking of delivery/pickup SLAs
2. **Delivery verification**: No admin function to verify deliveries
3. **Buyer purchases**: No function to create buyer purchases (window check pending)

### 🔒 Critical Patterns
1. **Check before write**: All validations happen before database writes
2. **Atomic rollback**: Failed mutations leave no partial state
3. **UTID generation**: Only occurs after validation passes
4. **Role enforcement**: All mutations verify roles server-side

---

*Last updated: Based on current codebase as of audit date*
