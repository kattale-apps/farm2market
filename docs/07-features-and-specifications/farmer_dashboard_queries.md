# Farmer Dashboard Queries

## Overview

Read-only queries for farmers to view their dashboard. All queries are farmer-specific, server-side calculated, and preserve anonymity by only exposing trader aliases.

---

## Queries

### 1. `getFarmerListings`

**Purpose**: View all listings created by the farmer.

**Returns**:
- All listings with status, unit counts, and delivery SLA
- Unit breakdown: available, locked, delivered, cancelled
- Sorted by most recent first

**Farmer-Specific**:
- ✅ Only queries listings where `farmerId = args.farmerId`
- ✅ Server-side filtering by farmer ID
- ✅ No other farmers' listings shown

---

### 2. `getActiveNegotiations`

**Purpose**: View locked units awaiting delivery (active negotiations).

**Returns**:
- All locked units from farmer's listings
- Trader aliases (anonymity preserved)
- Pay-to-lock confirmations (lockUtid, lockedAt)
- Delivery deadlines with server-calculated countdown
- Delivery status

**Farmer-Specific**:
- ✅ Only units from farmer's listings
- ✅ Filtered by listing ownership
- ✅ No other farmers' units shown

---

### 3. `getPayToLockConfirmations`

**Purpose**: View payment confirmations when units were locked.

**Returns**:
- All locked units with payment confirmation details
- lockUtid (payment transaction UTID)
- Payment amount and timestamp
- Trader aliases (anonymity preserved)

**Farmer-Specific**:
- ✅ Only units from farmer's listings
- ✅ Payment confirmations verified via wallet ledger
- ✅ No other farmers' confirmations shown

---

### 4. `getDeliveryDeadlines`

**Purpose**: View delivery deadlines with server-calculated countdown.

**Returns**:
- All locked units with delivery deadlines
- Server-calculated countdown (hours/minutes remaining or overdue)
- Grouped by pending vs overdue
- Sorted by deadline (earliest first)

**Farmer-Specific**:
- ✅ Only units from farmer's listings
- ✅ Server-side time calculations
- ✅ Real-time countdown (no client-side time logic)

---

### 5. `getDeliveryStatus`

**Purpose**: View delivery status summary (pending, delivered, late, cancelled).

**Returns**:
- Units grouped by deliveryStatus
- Totals for each status
- Server-calculated overdue hours
- Trader aliases (anonymity preserved)

**Farmer-Specific**:
- ✅ Only units from farmer's listings
- ✅ Complete delivery status tracking
- ✅ No other farmers' status shown

---

## How Delivery Accountability is Enforced

### 1. Immutable Deadline Recording

**When Unit is Locked** (`convex/payments.ts:111-121`):
```typescript
const paymentTime = Date.now();
const deliveryDeadline = calculateDeliverySLA(paymentTime); // Payment time + 6 hours

await ctx.db.patch(args.unitId, {
  deliveryDeadline: deliveryDeadline, // Immutably recorded
  deliveryStatus: "pending",          // Initial status
  lockedAt: paymentTime,              // Payment timestamp
  lockUtid: utid,                     // Payment UTID
});
```

**Why This Enforces Accountability**:
- ✅ **Immutable record**: Deadline set at payment time, cannot be changed
- ✅ **Server-side calculation**: No client manipulation possible
- ✅ **UTID reference**: Every deadline tied to payment UTID
- ✅ **Timestamped**: Payment time recorded for audit

---

### 2. Server-Side Time Calculations

**All Time Calculations Done Server-Side**:

```typescript
// In farmer dashboard queries
const now = Date.now(); // Server time
const isPastDeadline = unit.deliveryDeadline ? now > unit.deliveryDeadline : false;
const hoursRemaining = unit.deliveryDeadline
  ? Math.max(0, (unit.deliveryDeadline - now) / (1000 * 60 * 60))
  : null;
const hoursOverdue = unit.deliveryDeadline && isPastDeadline
  ? (now - unit.deliveryDeadline) / (1000 * 60 * 60)
  : 0;
```

**Why This Enforces Accountability**:
- ✅ **No client manipulation**: All time calculations server-side
- ✅ **Accurate countdown**: Real-time, server-calculated
- ✅ **Consistent**: Same time source for all calculations
- ✅ **Tamper-proof**: Client cannot manipulate deadlines

---

### 3. Delivery Status Tracking

**Status States**:
- `"pending"`: Unit locked, awaiting delivery (within deadline)
- `"delivered"`: Admin verified delivery (successful)
- `"late"`: Past deadline, not yet delivered (accountability failure)
- `"cancelled"`: Delivery cancelled/reversed

**Status Updates**:
- **Initial**: Set to `"pending"` when unit is locked
- **Verified**: Admin sets to `"delivered"` via `verifyDelivery`
- **Failed**: Admin sets to `"late"` or `"cancelled"` via `verifyDelivery`
- **Reversed**: Admin can reverse failed deliveries

**Why This Enforces Accountability**:
- ✅ **Status history**: Complete audit trail of delivery attempts
- ✅ **Admin verification**: Only admin can mark as delivered
- ✅ **Failure tracking**: Late deliveries are explicitly marked
- ✅ **Queryable**: Farmers can see their delivery status

---

### 4. UTID Chain for Audit

**UTID Chain**:
```
lockUtid (payment)
  ├─> walletLedger entry (payment confirmation)
  ├─> listingUnits.lockUtid (unit lock)
  ├─> listingUnits.deliveryDeadline (deadline)
  └─> (Future) adminActionUtid (delivery verification)
```

**Why This Enforces Accountability**:
- ✅ **Complete traceability**: Can trace from payment to delivery
- ✅ **Payment proof**: Wallet ledger entry confirms payment
- ✅ **Deadline proof**: Delivery deadline tied to payment UTID
- ✅ **Verification proof**: Admin actions logged with UTID

---

### 5. Real-Time Visibility

**Farmer Dashboard Shows**:
- ✅ **Countdown timers**: Hours/minutes remaining until deadline
- ✅ **Overdue status**: Clear indication when deadline passed
- ✅ **Delivery status**: Current status (pending, delivered, late, cancelled)
- ✅ **Payment confirmation**: Proof that payment was received

**Why This Enforces Accountability**:
- ✅ **Transparency**: Farmer sees exactly when delivery is due
- ✅ **Real-time updates**: Countdown updates with each query
- ✅ **Clear obligations**: Farmer knows what needs to be delivered
- ✅ **No excuses**: Deadline is clear and immutable

---

### 6. Admin Verification Required

**Delivery Verification Process**:
1. **Payment**: Trader locks unit → `deliveryStatus = "pending"`, `deliveryDeadline` set
2. **Deadline**: 6 hours pass → Deadline expires (status still "pending" until verified)
3. **Verification**: Admin calls `verifyDelivery` → Sets status to "delivered", "late", or "cancelled"
4. **Accountability**: Status change logged with UTID and reason

**Why This Enforces Accountability**:
- ✅ **Admin oversight**: Delivery must be verified by admin
- ✅ **No self-reporting**: Farmer cannot mark own delivery as complete
- ✅ **Audit trail**: All verifications logged with UTID
- ✅ **Final authority**: Admin decision is final (v1.x)

---

### 7. Failure Consequences

**Late Delivery**:
- Status set to `"late"` by admin
- Farmer can see overdue hours
- Admin can reverse transaction if needed
- All actions logged with UTID

**Cancelled Delivery**:
- Status set to `"cancelled"` by admin
- Transaction can be reversed
- Capital unlocked, unit unlocked
- Full audit trail maintained

**Why This Enforces Accountability**:
- ✅ **Consequences visible**: Farmer sees late/cancelled status
- ✅ **Reversibility**: Failed deliveries can be reversed
- ✅ **Financial impact**: Capital remains locked until delivery or reversal
- ✅ **Reputation impact**: Delivery status is tracked

---

## How Anonymity is Preserved

### 1. Only Trader Aliases Exposed

**Rule**: Farmers never see trader real names, emails, or phone numbers.

**Implementation**:
```typescript
const trader = unit.lockedBy ? await ctx.db.get(unit.lockedBy) : null;
traderAlias: trader?.alias || null, // Only alias, no real identity
```

**What Farmer Sees**:
- ✅ `traderAlias: "tra_a3k9x2"` (system-generated alias)
- ❌ No email, phone, or real name

**What Farmer Does NOT See**:
- ❌ Trader's email
- ❌ Trader's phone number
- ❌ Trader's real name
- ❌ Any identifying information

---

### 2. Server-Side Filtering

**Rule**: All data filtering happens server-side, farmer can only query their own data.

**Implementation**:
```typescript
// Get farmer's listings only
const listings = await ctx.db
  .query("listings")
  .withIndex("by_farmer", (q) => q.eq("farmerId", args.farmerId))
  .collect();

// Filter units to only those from farmer's listings
const farmerLockedUnits = allLockedUnits.filter((unit) =>
  listingIds.includes(unit.listingId)
);
```

**Why This Preserves Anonymity**:
- ✅ Farmer cannot query other farmers' listings
- ✅ Server enforces `farmerId` filter
- ✅ Units filtered by listing ownership
- ✅ No cross-user data exposure possible

---

### 3. No Cross-User Data Exposure

**Rule**: Farmers cannot access data from other users.

**Enforcement**:
- ✅ All queries filtered by `farmerId`
- ✅ Units filtered by listing ownership
- ✅ Server-side role verification
- ✅ Index-based queries prevent cross-user access

---

## Delivery Accountability Mechanisms

### 1. Immutable Deadline

**Mechanism**: Deadline set at payment time, cannot be changed.

**Enforcement**:
- ✅ `deliveryDeadline` stored in database
- ✅ Set when unit is locked (payment time + 6 hours)
- ✅ Never modified after creation
- ✅ Server-calculated, tamper-proof

---

### 2. Real-Time Countdown

**Mechanism**: Server calculates time remaining/overdue on each query.

**Enforcement**:
- ✅ Server-side time: `Date.now()` (server time)
- ✅ Real-time calculation: `hoursRemaining = (deadline - now) / hours`
- ✅ No client-side time logic
- ✅ Accurate, tamper-proof countdown

---

### 3. Status Tracking

**Mechanism**: Delivery status tracks outcome (pending, delivered, late, cancelled).

**Enforcement**:
- ✅ Status set to "pending" at lock time
- ✅ Admin verifies delivery (sets status)
- ✅ Status changes logged with UTID
- ✅ Queryable by farmer (accountability visibility)

---

### 4. Admin Verification

**Mechanism**: Only admin can verify delivery completion.

**Enforcement**:
- ✅ `verifyDelivery` mutation requires admin role
- ✅ Status change logged with UTID and reason
- ✅ Farmer cannot self-verify
- ✅ Admin decision is final (v1.x)

---

### 5. Audit Trail

**Mechanism**: All actions logged with UTIDs.

**Enforcement**:
- ✅ Payment UTID: `lockUtid` in unit
- ✅ Verification UTID: Admin action logged
- ✅ Reversal UTID: If delivery fails
- ✅ Complete traceability from payment to delivery

---

### 6. Financial Consequences

**Mechanism**: Capital remains locked until delivery or reversal.

**Enforcement**:
- ✅ Payment locks capital in wallet
- ✅ Capital unlocked only on delivery verification or reversal
- ✅ Farmer sees locked capital in dashboard
- ✅ Financial incentive to deliver on time

---

## Example: Delivery Accountability Flow

### Scenario: Farmer must deliver within 6 hours

1. **Trader locks unit** (T0)
   - `lockUtid = "20240215-143022-tra-a3k9x2"`
   - `deliveryDeadline = T0 + 6 hours`
   - `deliveryStatus = "pending"`
   - Capital locked in trader's wallet

2. **Farmer views dashboard** (`getDeliveryDeadlines`)
   - Sees unit with `hoursRemaining = 5.5`
   - Sees `deliveryDeadline` timestamp
   - Sees `traderAlias = "tra_a3k9x2"` (anonymity preserved)
   - Sees `lockUtid` (payment confirmation)

3. **6 hours pass** (T0 + 6 hours)
   - `deliveryDeadline` expires
   - `deliveryStatus` still "pending" (not auto-updated)

4. **Farmer views dashboard** (`getDeliveryDeadlines`)
   - Sees unit with `isPastDeadline = true`
   - Sees `hoursOverdue = 0.5`
   - Sees status still "pending" (awaiting admin verification)

5. **Admin verifies delivery** (`verifyDelivery`)
   - If delivered: `deliveryStatus = "delivered"`
   - If late: `deliveryStatus = "late"`
   - Action logged with UTID

6. **Farmer views dashboard** (`getDeliveryStatus`)
   - Sees updated status
   - Sees accountability outcome
   - Can see if delivery was late

---

## Summary

### Queries Provided ✅

1. **`getFarmerListings`**: All farmer's listings
2. **`getActiveNegotiations`**: Locked units awaiting delivery
3. **`getPayToLockConfirmations`**: Payment confirmations
4. **`getDeliveryDeadlines`**: Delivery deadlines with countdown
5. **`getDeliveryStatus`**: Delivery status summary

### Delivery Accountability Enforced ✅

1. **Immutable deadline**: Set at payment time, cannot be changed
2. **Server-side time**: All calculations done server-side
3. **Status tracking**: Complete delivery status history
4. **Admin verification**: Only admin can verify delivery
5. **Audit trail**: All actions logged with UTIDs
6. **Financial consequences**: Capital locked until delivery
7. **Real-time visibility**: Farmers see countdown and status

### Anonymity Preserved ✅

1. **Only aliases**: Traders shown as aliases only
2. **Server-side filtering**: All queries filtered by farmerId
3. **No cross-user data**: Farmers only see their own data
4. **Consistent API**: Always aliases, never real identities

---

*Implementation Date: Farmer dashboard queries added*  
*Status: Read-only, farmer-specific, delivery accountability enforced*
