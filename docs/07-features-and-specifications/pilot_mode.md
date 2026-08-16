# Pilot Mode System

## Overview

Global admin-controlled flag that blocks all mutations that move money or inventory when `pilotMode = true`. This system provides a critical safety mechanism to prevent catastrophic failures during pilot testing and system validation.

---

## Implementation

### 1. Schema

**Table**: `systemSettings` (singleton pattern)
- `pilotMode: boolean` - Global flag
- `setBy: id("users")` - Admin who set the flag
- `setAt: number` - Timestamp when flag was set
- `reason: string` - Required reason for setting flag
- `utid: string` - Admin action UTID

**Why Singleton Pattern**:
- Only one system settings record should exist
- Simplifies querying (no need to filter)
- Ensures single source of truth

---

### 2. Admin Mutations

#### `setPilotMode` (Admin Only)

**Purpose**: Enable or disable pilot mode.

**Parameters**:
- `adminId: id("users")` - Admin setting the flag
- `pilotMode: boolean` - New pilot mode status
- `reason: string` - Required reason for change

**Behavior**:
- Creates or updates system settings singleton
- Logs admin action with UTID
- All changes are immutable (logged in `adminActions`)

**Example**:
```typescript
// Enable pilot mode
await setPilotMode({
  adminId: "admin123",
  pilotMode: true,
  reason: "Testing system before production launch"
});

// Disable pilot mode
await setPilotMode({
  adminId: "admin123",
  pilotMode: false,
  reason: "Pilot testing complete, ready for production"
});
```

---

#### `getPilotMode` (Query - Anyone Can Check)

**Purpose**: Check current pilot mode status.

**Returns**:
- `pilotMode: boolean` - Current status
- `setBy: string | null` - Admin who set it
- `setAt: number | null` - When it was set
- `reason: string | null` - Reason for setting
- `utid: string | null` - Admin action UTID

**Why Public Query**:
- Allows clients to check status before attempting mutations
- Provides transparency about system state
- Enables UI to show pilot mode warnings

---

### 3. Utility Functions

#### `checkPilotMode(ctx)`

**Purpose**: Check if pilot mode is active and throw if it is.

**Behavior**:
- Called at the start of mutations that move money or inventory
- Throws explicit error if pilot mode is active
- Error message includes:
  - Clear indication that pilot mode is active
  - When pilot mode was set
  - Reason for setting pilot mode
  - Instructions for resolution

**Error Message Example**:
```
PILOT MODE ACTIVE: This operation is blocked because pilot mode is enabled.
Pilot mode was set by admin at 2024-03-15T14:30:22.000Z.
Reason: Testing system before production launch.
All mutations that move money or inventory are blocked during pilot mode.
Read-only queries are still available.
Contact an admin to disable pilot mode if this operation is needed.
```

**Why Explicit Errors**:
- Clear failure message helps users understand why operation failed
- Includes context (when set, reason) for debugging
- Provides actionable information (contact admin)

---

### 4. Mutations Blocked During Pilot Mode

All mutations that move money or inventory are blocked:

#### 4.1 Money Movement Mutations

**`lockUnit`** (`convex/payments.ts`):
- **What it does**: Locks capital in wallet when trader purchases unit
- **Why blocked**: Moves money (locks capital)
- **Check location**: First check in handler (before any operations)

**`depositCapital`** (`convex/wallet.ts`):
- **What it does**: Deposits capital into trader wallet
- **Why blocked**: Moves money (adds capital)
- **Check location**: First check in handler

**`withdrawProfit`** (`convex/wallet.ts`):
- **What it does**: Withdraws profit from trader wallet
- **Why blocked**: Moves money (removes profit)
- **Check location**: First check in handler

#### 4.2 Inventory Movement Mutations

**`createListing`** (`convex/listings.ts`):
- **What it does**: Creates inventory that can be purchased
- **Why blocked**: Creates inventory that moves money when purchased
- **Check location**: First check in handler

**`createBuyerPurchase`** (`convex/buyers.ts`):
- **What it does**: Locks inventory when buyer purchases
- **Why blocked**: Moves inventory (locks inventory)
- **Check location**: First check in handler (before purchase window check)

---

### 5. Mutations NOT Blocked (Admin Actions)

Admin actions are **explicitly allowed** during pilot mode:

- `verifyDelivery` - Admin verification
- `reverseDeliveryFailure` - Admin reversals
- `openPurchaseWindow` - Admin window control
- `closePurchaseWindow` - Admin window control
- `setPilotMode` - Admin pilot mode control

**Why Admin Actions Are Allowed**:
- Admin needs to manage system during pilot
- Admin actions are logged and auditable
- Admin can resolve issues that arise during pilot
- Admin can disable pilot mode when ready

---

### 6. Read-Only Access Still Allowed

All queries (read-only operations) remain available during pilot mode:

- `getWalletBalance` - View wallet balances
- `getActiveListings` - View available listings
- `getBuyerOrders` - View buyer orders
- `getTraderActiveUTIDs` - View trader UTIDs
- `getPilotMode` - Check pilot mode status
- All dashboard queries
- All introspection queries

**Why Read-Only Access Is Allowed**:
- Allows users to view system state
- Enables testing of UI and queries
- Provides transparency about system state
- No risk of data corruption (read-only)

---

## How This Reduces Catastrophic Risk

### 1. Prevents Financial Losses

**Risk**: During pilot testing, bugs or misconfigurations could cause:
- Incorrect wallet balances
- Unauthorized money movements
- Double-spending
- Capital lock failures

**How Pilot Mode Prevents**:
- ✅ **Blocks all money movements**: No deposits, withdrawals, or locks can occur
- ✅ **Prevents financial corruption**: Wallet ledger cannot be modified
- ✅ **Eliminates double-spending risk**: No payments can be processed
- ✅ **Prevents capital lock failures**: No unit locking can occur

**Example Scenario**:
```
❌ Without Pilot Mode:
- Bug in lockUnit mutation causes double capital lock
- Trader loses UGX 500,000 due to bug
- System state corrupted

✅ With Pilot Mode:
- Pilot mode enabled before testing
- lockUnit mutation blocked
- No money movements possible
- System state remains clean
```

---

### 2. Prevents Inventory Corruption

**Risk**: During pilot testing, bugs could cause:
- Incorrect inventory counts
- Inventory double-allocation
- Inventory lock failures
- Inventory state corruption

**How Pilot Mode Prevents**:
- ✅ **Blocks inventory creation**: No new listings can be created
- ✅ **Blocks inventory movement**: No purchases can lock inventory
- ✅ **Prevents inventory corruption**: Inventory state cannot be modified
- ✅ **Eliminates double-allocation risk**: No inventory locking can occur

**Example Scenario**:
```
❌ Without Pilot Mode:
- Bug in createBuyerPurchase causes inventory to be locked twice
- Same 100kg block sold to two buyers
- System state corrupted

✅ With Pilot Mode:
- Pilot mode enabled before testing
- createBuyerPurchase mutation blocked
- No inventory movements possible
- System state remains clean
```

---

### 3. Enables Safe Testing

**Risk**: During pilot testing, untested code paths could cause:
- Unexpected state changes
- Partial transaction failures
- Race conditions
- Data corruption

**How Pilot Mode Prevents**:
- ✅ **Allows read-only testing**: Queries can be tested safely
- ✅ **Prevents state changes**: No mutations can modify data
- ✅ **Enables UI testing**: UI can be tested without risk
- ✅ **Allows admin intervention**: Admin can still manage system

**Example Scenario**:
```
❌ Without Pilot Mode:
- Testing UI triggers unexpected mutation
- System state modified unintentionally
- Pilot test data corrupted

✅ With Pilot Mode:
- Pilot mode enabled during testing
- UI can be tested (queries work)
- Mutations blocked (no state changes)
- Test data remains clean
```

---

### 4. Provides Explicit Failure Messages

**Risk**: During pilot testing, unclear errors could cause:
- Confusion about why operations fail
- Difficulty debugging issues
- Users attempting workarounds
- Support burden

**How Pilot Mode Prevents**:
- ✅ **Explicit error messages**: Clear indication that pilot mode is active
- ✅ **Context provided**: When and why pilot mode was set
- ✅ **Actionable information**: Instructions for resolution
- ✅ **Reduces support burden**: Users understand why operations fail

**Example Error Message**:
```
PILOT MODE ACTIVE: This operation is blocked because pilot mode is enabled.
Pilot mode was set by admin at 2024-03-15T14:30:22.000Z.
Reason: Testing system before production launch.
All mutations that move money or inventory are blocked during pilot mode.
Read-only queries are still available.
Contact an admin to disable pilot mode if this operation is needed.
```

---

### 5. Enables Controlled Rollout

**Risk**: During production rollout, issues could cause:
- System-wide failures
- Data corruption
- Financial losses
- User trust loss

**How Pilot Mode Prevents**:
- ✅ **Gradual rollout**: Pilot mode can be enabled for specific user groups
- ✅ **Safe validation**: System can be validated before full rollout
- ✅ **Quick rollback**: Pilot mode can be re-enabled if issues arise
- ✅ **Controlled testing**: Testing can be done in production-like environment

**Example Rollout Strategy**:
```
1. Enable pilot mode
2. Test system with read-only queries
3. Validate UI and user experience
4. Test admin actions (still allowed)
5. Disable pilot mode for limited user group
6. Monitor for issues
7. Gradually expand user group
8. Full production rollout
```

---

### 6. Provides Audit Trail

**Risk**: During pilot testing, lack of audit trail could cause:
- Difficulty tracking changes
- Inability to debug issues
- Compliance problems
- Accountability gaps

**How Pilot Mode Prevents**:
- ✅ **All changes logged**: Pilot mode changes logged with UTID
- ✅ **Admin actions tracked**: All admin actions logged
- ✅ **Complete audit trail**: Full history of pilot mode changes
- ✅ **Compliance ready**: Audit trail supports compliance requirements

**Example Audit Trail**:
```
Admin Action Log:
- 2024-03-15T14:30:22.000Z: enable_pilot_mode
  - Admin: admin123
  - Reason: Testing system before production launch
  - UTID: 20240315-143022-adm-a3k9x2

- 2024-03-15T16:45:10.000Z: disable_pilot_mode
  - Admin: admin123
  - Reason: Pilot testing complete, ready for production
  - UTID: 20240315-164510-adm-b4l8y3
```

---

### 7. Prevents Race Conditions

**Risk**: During pilot testing, race conditions could cause:
- Concurrent mutation conflicts
- Partial state updates
- Data inconsistency
- System corruption

**How Pilot Mode Prevents**:
- ✅ **Blocks all mutations**: No concurrent mutations possible
- ✅ **Prevents race conditions**: No state changes can occur
- ✅ **Eliminates conflicts**: No concurrent operations
- ✅ **Ensures consistency**: System state remains consistent

**Example Scenario**:
```
❌ Without Pilot Mode:
- Two traders attempt to lock same unit simultaneously
- Race condition causes both to succeed
- Unit locked twice, capital locked twice
- System state corrupted

✅ With Pilot Mode:
- Pilot mode enabled
- Both lockUnit mutations blocked
- No race conditions possible
- System state remains consistent
```

---

### 8. Enables Quick Recovery

**Risk**: During pilot testing, issues could require:
- System rollback
- Data restoration
- Manual intervention
- Extended downtime

**How Pilot Mode Prevents**:
- ✅ **Quick enable**: Pilot mode can be enabled instantly
- ✅ **Immediate protection**: All mutations blocked immediately
- ✅ **No data corruption**: System state remains clean
- ✅ **Fast recovery**: Issues can be resolved without data loss

**Example Recovery Scenario**:
```
1. Issue detected during pilot testing
2. Admin enables pilot mode (instant)
3. All mutations blocked immediately
4. System state protected
5. Issue investigated and resolved
6. Pilot mode disabled
7. System continues normally
```

---

## Summary: Risk Reduction Mechanisms

### 1. Prevents Financial Losses ✅
- Blocks all money movements
- Prevents wallet corruption
- Eliminates double-spending risk
- Prevents capital lock failures

### 2. Prevents Inventory Corruption ✅
- Blocks inventory creation and movement
- Prevents inventory state corruption
- Eliminates double-allocation risk
- Ensures inventory consistency

### 3. Enables Safe Testing ✅
- Allows read-only testing
- Prevents state changes
- Enables UI testing
- Allows admin intervention

### 4. Provides Explicit Failure Messages ✅
- Clear error messages
- Context provided
- Actionable information
- Reduces support burden

### 5. Enables Controlled Rollout ✅
- Gradual rollout possible
- Safe validation
- Quick rollback
- Controlled testing

### 6. Provides Audit Trail ✅
- All changes logged
- Admin actions tracked
- Complete audit trail
- Compliance ready

### 7. Prevents Race Conditions ✅
- Blocks all mutations
- Prevents concurrent conflicts
- Eliminates race conditions
- Ensures consistency

### 8. Enables Quick Recovery ✅
- Quick enable
- Immediate protection
- No data corruption
- Fast recovery

---

## Usage Guidelines

### When to Enable Pilot Mode

1. **Before Production Launch**:
   - Enable pilot mode before first production deployment
   - Test system with read-only queries
   - Validate UI and user experience
   - Test admin actions

2. **During System Updates**:
   - Enable pilot mode before deploying updates
   - Test new features safely
   - Validate system behavior
   - Disable after validation

3. **During Issue Investigation**:
   - Enable pilot mode if issues detected
   - Protect system state
   - Investigate safely
   - Disable after resolution

4. **During Maintenance**:
   - Enable pilot mode during maintenance windows
   - Prevent accidental operations
   - Ensure clean maintenance
   - Disable after maintenance

### When NOT to Enable Pilot Mode

1. **During Normal Operations**:
   - Pilot mode should be OFF during normal operations
   - Users need to perform mutations
   - System needs to process transactions

2. **During Critical Operations**:
   - Pilot mode should be OFF during critical operations
   - System needs full functionality
   - Users need to complete transactions

---

## Implementation Checklist

- ✅ Schema updated with `systemSettings` table
- ✅ `pilotMode.ts` created with utility functions
- ✅ `setPilotMode` mutation (admin only)
- ✅ `getPilotMode` query (public)
- ✅ `checkPilotMode` utility function
- ✅ Pilot mode checks added to `lockUnit`
- ✅ Pilot mode checks added to `depositCapital`
- ✅ Pilot mode checks added to `withdrawProfit`
- ✅ Pilot mode checks added to `createListing`
- ✅ Pilot mode checks added to `createBuyerPurchase`
- ✅ Admin actions NOT blocked (explicitly allowed)
- ✅ Read-only queries still available
- ✅ Explicit error messages
- ✅ Admin action logging

---

*Implementation Date: Pilot mode system added*  
*Status: Admin-controlled, explicit failures, read-only access preserved*
