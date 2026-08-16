# Delivery SLA Tracking Implementation

## Overview

Delivery SLA tracking records when units must be delivered after payment, but does **not** automatically enforce or reverse transactions. This allows admin oversight before any automated actions occur.

---

## Where the Deadline is Stored

### Database Location

**Table**: `listingUnits`  
**Fields**:
- `deliveryDeadline`: `number` (timestamp in milliseconds)
- `deliveryStatus`: `"pending" | "delivered" | "late" | "cancelled"`

### Storage Details

1. **Per-Unit Storage**: Each unit has its own `deliveryDeadline` and `deliveryStatus`
   - **Why**: Units can be locked at different times, so each needs its own deadline
   - **Location**: `convex/schema.ts:102-103` (listingUnits table)

2. **Calculation**: `deliveryDeadline = lockedAt + 6 hours`
   - **Function**: `calculateDeliverySLA(paymentTime)` in `convex/utils.ts:128-130`
   - **Set when**: Unit is locked via `lockUnit` mutation
   - **Location**: `convex/payments.ts:114-116`

3. **Index**: `by_delivery_status` index for efficient querying
   - **Location**: `convex/schema.ts:106`

### Example Data Structure

```typescript
{
  _id: "unit123",
  listingId: "listing456",
  status: "locked",
  lockedAt: 1708000000000,  // Payment time
  deliveryDeadline: 1708021600000,  // lockedAt + 6 hours
  deliveryStatus: "pending",
  lockUtid: "20240215-143022-tra-a3k9x2",
  // ...
}
```

---

## Why No Automation is Triggered Yet

### 1. Admin Oversight Required (v1.x Policy)

**Rule**: "Admin decisions are final in v1.x. No automated dispute resolution."

- **Rationale**: Late deliveries may have legitimate reasons (weather, transport issues, etc.)
- **Risk**: Automatic reversals could harm farmers unfairly
- **Solution**: Admin reviews each case and makes final decision

### 2. No Scheduled Functions

**Current State**: Convex does not have scheduled/cron functions running automatically.

- **What's missing**: No `scheduled` function to check expired deadlines
- **Why not implemented**: Requires explicit decision on automation policy
- **Future**: Could add scheduled function when automation is approved

### 3. Manual Verification Process

**Current Flow**:
1. Admin queries `getDeliverySLAStatus` to see pending/late deliveries
2. Admin reviews each case manually
3. Admin uses future `verifyDelivery` or `cancelDelivery` functions (not yet implemented)
4. System records admin decision with UTID and reason

**Benefits**:
- Prevents false positives (automatic reversals for legitimate delays)
- Allows context-aware decisions
- Maintains audit trail (all admin actions logged)

### 4. Time Calculation is Server-Side Only

**Implementation**: All time comparisons happen in `getDeliverySLAStatus` query

- **Location**: `convex/admin.ts:195-202`
- **Calculation**: `isPastDeadline = now > deliveryDeadline` (server-side)
- **Why**: Prevents client-side time manipulation
- **Result**: Admin always sees accurate, server-calculated status

---

## Implementation Details

### When Pay-to-Lock Succeeds

**Function**: `lockUnit` mutation  
**Location**: `convex/payments.ts:110-116`

```typescript
const paymentTime = Date.now();
const deliveryDeadline = calculateDeliverySLA(paymentTime);

await ctx.db.patch(args.unitId, {
  status: "locked",
  lockedBy: args.traderId,
  lockedAt: paymentTime,
  lockUtid: utid,
  deliveryDeadline: deliveryDeadline,  // Payment time + 6 hours
  deliveryStatus: "pending",           // Initial status
});
```

**What Happens**:
1. ✅ `deliveryDeadline` is calculated: `paymentTime + 6 hours`
2. ✅ `deliveryStatus` is set to `"pending"`
3. ✅ Both fields are stored atomically with unit lock
4. ❌ **No automatic check** is triggered
5. ❌ **No reversal** occurs

### Admin Query for Delivery Status

**Function**: `getDeliverySLAStatus` query  
**Location**: `convex/admin.ts:179-250`

**Features**:
- ✅ Admin-only access (role verified server-side)
- ✅ Server-side time calculations (no client logic)
- ✅ Filters by status: `"pending"`, `"late"`, or `"delivered"`
- ✅ Returns `isPastDeadline`, `hoursRemaining`, `hoursOverdue`
- ✅ Includes related information (listing, farmer alias, trader alias)

**Example Response**:
```typescript
{
  units: [
    {
      unitId: "unit123",
      deliveryDeadline: 1708021600000,
      deliveryStatus: "pending",
      isPastDeadline: false,
      hoursRemaining: 4.5,
      hoursOverdue: 0,
      lockUtid: "20240215-143022-tra-a3k9x2",
      // ...
    },
    {
      unitId: "unit456",
      deliveryDeadline: 1708000000000,  // Past deadline
      deliveryStatus: "pending",
      isPastDeadline: true,
      hoursRemaining: null,
      hoursOverdue: 2.3,
      // ...
    }
  ],
  summary: {
    total: 2,
    pending: 1,
    late: 1,
    delivered: 0,
  },
  currentTime: 1708008280000,
}
```

---

## Future Automation (When Approved)

### Potential Scheduled Function

**If automation is approved**, could add:

```typescript
// convex/scheduled.ts (hypothetical)
export const checkDeliverySLAs = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const lockedUnits = await ctx.db
      .query("listingUnits")
      .withIndex("by_status", (q) => q.eq("status", "locked"))
      .collect();

    for (const unit of lockedUnits) {
      if (unit.deliveryDeadline && now > unit.deliveryDeadline) {
        if (unit.deliveryStatus === "pending") {
          // Mark as late (but don't auto-reverse)
          await ctx.db.patch(unit._id, {
            deliveryStatus: "late",
          });
        }
      }
    }
  },
});
```

**Why Not Implemented Now**:
- Requires explicit approval for automation
- May need admin notification system first
- Should align with dispute resolution policy

---

## Summary

### What Is Implemented ✅

1. **Deadline Storage**: `deliveryDeadline` stored per unit in `listingUnits` table
2. **Status Tracking**: `deliveryStatus` tracks `"pending"`, `"delivered"`, `"late"`, `"cancelled"`
3. **Automatic Recording**: Deadline calculated and stored when unit is locked
4. **Admin Query**: `getDeliverySLAStatus` allows admin to view all delivery statuses
5. **Server-Side Time**: All time calculations done server-side (no client logic)

### What Is NOT Implemented ❌

1. **Automatic Enforcement**: No scheduled function checks deadlines
2. **Auto-Reversal**: No automatic cancellation or refund on late delivery
3. **Notifications**: No automatic alerts to admin or users
4. **Status Updates**: No automatic `"pending"` → `"late"` status change

### Why No Automation

1. **Policy**: Admin decisions are final in v1.x
2. **Risk**: Automatic actions could harm legitimate users
3. **Flexibility**: Allows context-aware decisions
4. **Audit**: All actions require explicit admin decision with UTID and reason

---

*Implementation Date: Delivery SLA tracking added*  
*Status: Tracking only - no automation*
