# Farm2Market Uganda v1 - 1-Hour Pilot Simulation

## Overview

This document simulates a complete 1-hour pilot run with fake users, walking through all major system flows including successful operations, failures, and admin interventions.

**Simulation Time**: 1 hour (60 minutes)  
**Date**: 2024-03-15  
**Time Range**: 14:00:00 - 15:00:00 (2:00 PM - 3:00 PM)

---

## Pilot Participants

### Users

**Farmers**:
- `far_maize01` (Farmer 1) - Maize producer
- `far_beans02` (Farmer 2) - Beans producer

**Traders**:
- `tra_alpha03` (Trader 1) - Active trader, UGX 200,000 capital
- `tra_beta04` (Trader 2) - New trader, UGX 500,000 capital

**Buyers**:
- `buy_retail05` (Buyer 1) - Retail buyer

**Admin**:
- `adm_sys01` (Admin 1) - System administrator

---

## Timeline

### T+0:00 - System Initialization (14:00:00)

**State**:
- Pilot mode: `false` (disabled for simulation)
- Purchase window: `closed`
- All users logged in
- System ready

**UTIDs Created**: None

**Admin Decisions Required**: None

**Risk Points**: 
- ✅ None - system initialization complete

---

### T+0:05 - Farmer 1 Creates Listing (14:05:00)

**Action**: `far_maize01` creates listing

**Mutation**: `createListing`

**Parameters**:
- `farmerId`: `far_maize01`
- `produceType`: "Maize"
- `totalKilos`: 50
- `pricePerKilo`: 2000 UGX

**State Changes**:
1. **Listing Created**:
   - `listings` table: New listing with status `"active"`
   - `listingUtid`: `"20240315-140500-far-maize01"`
   - `totalKilos`: 50
   - `totalUnits`: 5 (50kg / 10kg per unit)
   - `pricePerKilo`: 2000 UGX

2. **Units Created**:
   - `listingUnits` table: 5 units created
   - Each unit: `status = "available"`, `unitNumber = 1-5`
   - No UTIDs for units (only listing has UTID)

**UTIDs Created**:
- `"20240315-140500-far-maize01"` (listing UTID)

**Admin Decisions Required**: None

**Risk Points**:
- ✅ Rate limit check: 1 listing created (limit: 10/day) - OK
- ✅ Validation: Kilos and price positive - OK
- ✅ Unit creation: 5 units created correctly - OK

**System State**:
- Active listings: 1
- Available units: 5
- Total kilos available: 50kg

---

### T+0:08 - Farmer 2 Creates Listing (14:08:00)

**Action**: `far_beans02` creates listing

**Mutation**: `createListing`

**Parameters**:
- `farmerId`: `far_beans02`
- `produceType`: "Beans"
- `totalKilos`: 30
- `pricePerKilo`: 3000 UGX

**State Changes**:
1. **Listing Created**:
   - `listings` table: New listing with status `"active"`
   - `listingUtid`: `"20240315-140800-far-beans02"`
   - `totalKilos`: 30
   - `totalUnits`: 3 (30kg / 10kg per unit)
   - `pricePerKilo`: 3000 UGX

2. **Units Created**:
   - `listingUnits` table: 3 units created
   - Each unit: `status = "available"`, `unitNumber = 1-3`

**UTIDs Created**:
- `"20240315-140800-far-beans02"` (listing UTID)

**Admin Decisions Required**: None

**Risk Points**:
- ✅ Rate limit check: 1 listing created (limit: 10/day) - OK
- ✅ Validation: Kilos and price positive - OK

**System State**:
- Active listings: 2
- Available units: 8 (5 maize + 3 beans)
- Total kilos available: 80kg

---

### T+0:12 - Trader 1 Deposits Capital (14:12:00)

**Action**: `tra_alpha03` deposits capital

**Mutation**: `depositCapital`

**Parameters**:
- `traderId`: `tra_alpha03`
- `amount`: 200,000 UGX

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-141200-tra-alpha03"`
   - `type`: `"capital_deposit"`
   - `amount`: 200,000 UGX
   - `balanceAfter`: 200,000 UGX

**UTIDs Created**:
- `"20240315-141200-tra-alpha03"` (wallet deposit UTID)

**Admin Decisions Required**: None

**Risk Points**:
- ✅ Rate limit check: 1 wallet operation (limit: 10/hour) - OK
- ✅ Validation: Amount positive - OK
- ✅ Balance calculation: Correct - OK

**System State**:
- `tra_alpha03` capital balance: 200,000 UGX
- `tra_alpha03` exposure: 0 UGX (no locked capital yet)

---

### T+0:15 - Trader 2 Deposits Capital (14:15:00)

**Action**: `tra_beta04` deposits capital

**Mutation**: `depositCapital`

**Parameters**:
- `traderId`: `tra_beta04`
- `amount`: 500,000 UGX

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-141500-tra-beta04"`
   - `type`: `"capital_deposit"`
   - `amount`: 500,000 UGX
   - `balanceAfter`: 500,000 UGX

**UTIDs Created**:
- `"20240315-141500-tra-beta04"` (wallet deposit UTID)

**Admin Decisions Required**: None

**Risk Points**:
- ✅ Rate limit check: 1 wallet operation (limit: 10/hour) - OK
- ✅ Validation: Amount positive - OK

**System State**:
- `tra_beta04` capital balance: 500,000 UGX
- `tra_beta04` exposure: 0 UGX

---

### T+0:18 - Trader 1 Locks Unit (Pay-to-Lock) (14:18:00)

**Action**: `tra_alpha03` locks a maize unit

**Mutation**: `lockUnit`

**Parameters**:
- `traderId`: `tra_alpha03`
- `unitId`: Unit 1 from `far_maize01` listing

**Pre-Check State**:
- Unit price: 2,000 UGX/kg × 10kg = 20,000 UGX
- Trader exposure: 0 UGX
- New exposure: 0 + 20,000 = 20,000 UGX
- Spend cap: 1,000,000 UGX
- ✅ Can proceed (20,000 < 1,000,000)

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-141800-tra-alpha03"`
   - `type`: `"capital_lock"`
   - `amount`: 20,000 UGX
   - `balanceAfter`: 180,000 UGX (200,000 - 20,000)

2. **Unit Locked**:
   - `listingUnits` table: Unit updated
   - `status`: `"locked"`
   - `lockedBy`: `tra_alpha03`
   - `lockedAt`: 14:18:00
   - `lockUtid`: `"20240315-141800-tra-alpha03"`
   - `deliveryDeadline`: 20:18:00 (14:18:00 + 6 hours)
   - `deliveryStatus`: `"pending"`

3. **Listing Status Updated**:
   - `listings` table: Listing updated
   - `status`: `"partially_locked"` (1 of 5 units locked)

**UTIDs Created**:
- `"20240315-141800-tra-alpha03"` (lock UTID - same for wallet and unit)

**Admin Decisions Required**: None (yet - delivery pending)

**Risk Points**:
- ✅ Spend cap check: Passed (20,000 < 1,000,000)
- ✅ Rate limit check: 1 negotiation (limit: 20/hour) - OK
- ✅ Atomicity: Payment and lock happened together - OK
- ✅ Delivery deadline: Set correctly (6 hours) - OK
- ⚠️ **Risk**: Delivery must happen by 20:18:00 or will be late

**System State**:
- `tra_alpha03` capital balance: 180,000 UGX
- `tra_alpha03` locked capital: 20,000 UGX
- `tra_alpha03` exposure: 20,000 UGX
- Available units: 7 (4 maize + 3 beans)
- Locked units: 1 (maize unit 1)

---

### T+0:22 - Trader 2 Locks Unit (Pay-to-Lock) (14:22:00)

**Action**: `tra_beta04` locks a beans unit

**Mutation**: `lockUnit`

**Parameters**:
- `traderId`: `tra_beta04`
- `unitId`: Unit 1 from `far_beans02` listing

**Pre-Check State**:
- Unit price: 3,000 UGX/kg × 10kg = 30,000 UGX
- Trader exposure: 0 UGX
- New exposure: 0 + 30,000 = 30,000 UGX
- Spend cap: 1,000,000 UGX
- ✅ Can proceed (30,000 < 1,000,000)

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-142200-tra-beta04"`
   - `type`: `"capital_lock"`
   - `amount`: 30,000 UGX
   - `balanceAfter`: 470,000 UGX (500,000 - 30,000)

2. **Unit Locked**:
   - `listingUnits` table: Unit updated
   - `status`: `"locked"`
   - `lockedBy`: `tra_beta04`
   - `lockedAt`: 14:22:00
   - `lockUtid`: `"20240315-142200-tra-beta04"`
   - `deliveryDeadline`: 20:22:00 (14:22:00 + 6 hours)
   - `deliveryStatus`: `"pending"`

3. **Listing Status Updated**:
   - `listings` table: Listing updated
   - `status`: `"partially_locked"` (1 of 3 units locked)

**UTIDs Created**:
- `"20240315-142200-tra-beta04"` (lock UTID)

**Admin Decisions Required**: None (yet - delivery pending)

**Risk Points**:
- ✅ Spend cap check: Passed (30,000 < 1,000,000)
- ✅ Rate limit check: 1 negotiation (limit: 20/hour) - OK
- ✅ Atomicity: Payment and lock happened together - OK
- ⚠️ **Risk**: Delivery must happen by 20:22:00 or will be late

**System State**:
- `tra_beta04` capital balance: 470,000 UGX
- `tra_beta04` locked capital: 30,000 UGX
- `tra_beta04` exposure: 30,000 UGX
- Available units: 6 (4 maize + 2 beans)
- Locked units: 2 (1 maize + 1 beans)

---

### T+0:25 - Trader 1 Attempts to Lock Another Unit (Spend Cap Check) (14:25:00)

**Action**: `tra_alpha03` attempts to lock another maize unit

**Mutation**: `lockUnit`

**Parameters**:
- `traderId`: `tra_alpha03`
- `unitId`: Unit 2 from `far_maize01` listing

**Pre-Check State**:
- Unit price: 20,000 UGX
- Current exposure: 20,000 UGX (from previous lock)
- New exposure: 20,000 + 20,000 = 40,000 UGX
- Spend cap: 1,000,000 UGX
- ✅ Can proceed (40,000 < 1,000,000)

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-142500-tra-alpha03"`
   - `type`: `"capital_lock"`
   - `amount`: 20,000 UGX
   - `balanceAfter`: 160,000 UGX (180,000 - 20,000)

2. **Unit Locked**:
   - `listingUnits` table: Unit updated
   - `status`: `"locked"`
   - `lockedBy`: `tra_alpha03`
   - `lockedAt`: 14:25:00
   - `lockUtid`: `"20240315-142500-tra-alpha03"`
   - `deliveryDeadline`: 20:25:00 (14:25:00 + 6 hours)
   - `deliveryStatus`: `"pending"`

3. **Listing Status Updated**:
   - `listings` table: Listing updated
   - `status`: `"partially_locked"` (2 of 5 units locked)

**UTIDs Created**:
- `"20240315-142500-tra-alpha03"` (lock UTID)

**Admin Decisions Required**: None (yet - delivery pending)

**Risk Points**:
- ✅ Spend cap check: Passed (40,000 < 1,000,000)
- ✅ Rate limit check: 2 negotiations (limit: 20/hour) - OK
- ⚠️ **Risk**: Now 2 deliveries pending for `tra_alpha03`

**System State**:
- `tra_alpha03` capital balance: 160,000 UGX
- `tra_alpha03` locked capital: 40,000 UGX
- `tra_alpha03` exposure: 40,000 UGX
- Available units: 5 (3 maize + 2 beans)
- Locked units: 3 (2 maize + 1 beans)

---

### T+0:30 - Farmer 1 Delivers On-Time (14:30:00)

**Action**: `far_maize01` delivers first unit to `tra_alpha03`

**Reality**: Farmer physically delivers 10kg of maize to trader

**System State**: No system changes (delivery is physical, not system action)

**UTIDs Created**: None (delivery is physical)

**Admin Decisions Required**: 
- ⚠️ **Admin must verify delivery** using `verifyDelivery` mutation

**Risk Points**:
- ⚠️ **Risk**: Admin must verify within reasonable time
- ⚠️ **Risk**: If admin doesn't verify, delivery status remains "pending"

**System State** (unchanged):
- Unit still shows `deliveryStatus = "pending"`
- Delivery deadline: 20:18:00 (still 5 hours 48 minutes away)

---

### T+0:32 - Admin Verifies On-Time Delivery (14:32:00)

**Action**: `adm_sys01` verifies delivery

**Mutation**: `verifyDelivery`

**Parameters**:
- `adminId`: `adm_sys01`
- `lockUtid`: `"20240315-141800-tra-alpha03"`
- `outcome`: `"delivered"`
- `reason`: "Farmer delivered on time. Trader confirmed receipt. Quality acceptable. Delivery completed at 14:30:00, verified at 14:32:00."

**State Changes**:
1. **Unit Status Updated**:
   - `listingUnits` table: Unit updated
   - `deliveryStatus`: `"delivered"` (changed from "pending")
   - Status remains `"locked"` (not yet converted to inventory)

2. **Admin Action Logged**:
   - `adminActions` table: New entry
   - `utid`: `"20240315-143200-adm-sys01"`
   - `actionType`: `"verify_delivery"`
   - `targetUtid`: `"20240315-141800-tra-alpha03"`
   - `reason`: [as above]

**UTIDs Created**:
- `"20240315-143200-adm-sys01"` (admin action UTID)

**Admin Decisions Required**: None (delivery verified)

**Risk Points**:
- ✅ Delivery verified on time
- ⚠️ **Note**: Unit still locked, not yet converted to inventory
- ⚠️ **Note**: Capital still locked (not yet unlocked)

**System State**:
- Unit 1: `deliveryStatus = "delivered"`
- Unit 1: `status = "locked"` (still locked)
- `tra_alpha03` capital: Still locked (40,000 UGX locked)
- Admin action logged

**Next Steps**: 
- Unit should be converted to inventory (not yet implemented in v1)
- Capital should remain locked until inventory created

---

### T+0:35 - Trader 2 Attempts Third Lock (Rate Limit Check) (14:35:00)

**Action**: `tra_beta04` attempts to lock another beans unit

**Mutation**: `lockUnit`

**Parameters**:
- `traderId`: `tra_beta04`
- `unitId`: Unit 2 from `far_beans02` listing

**Pre-Check State**:
- Unit price: 30,000 UGX
- Current exposure: 30,000 UGX
- New exposure: 30,000 + 30,000 = 60,000 UGX
- Spend cap: 1,000,000 UGX
- ✅ Can proceed (60,000 < 1,000,000)

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-143500-tra-beta04"`
   - `type`: `"capital_lock"`
   - `amount`: 30,000 UGX
   - `balanceAfter`: 440,000 UGX (470,000 - 30,000)

2. **Unit Locked**:
   - `listingUnits` table: Unit updated
   - `status`: `"locked"`
   - `lockedBy`: `tra_beta04`
   - `lockedAt`: 14:35:00
   - `lockUtid`: `"20240315-143500-tra-beta04"`
   - `deliveryDeadline`: 20:35:00 (14:35:00 + 6 hours)
   - `deliveryStatus`: `"pending"`

3. **Listing Status Updated**:
   - `listings` table: Listing updated
   - `status`: `"partially_locked"` (2 of 3 units locked)

**UTIDs Created**:
- `"20240315-143500-tra-beta04"` (lock UTID)

**Admin Decisions Required**: None (yet - delivery pending)

**Risk Points**:
- ✅ Spend cap check: Passed (60,000 < 1,000,000)
- ✅ Rate limit check: 2 negotiations (limit: 20/hour) - OK
- ⚠️ **Risk**: Now 2 deliveries pending for `tra_beta04`

**System State**:
- `tra_beta04` capital balance: 440,000 UGX
- `tra_beta04` locked capital: 60,000 UGX
- `tra_beta04` exposure: 60,000 UGX
- Available units: 4 (3 maize + 1 beans)
- Locked units: 4 (2 maize + 2 beans)

---

### T+0:40 - Admin Opens Purchase Window (14:40:00)

**Action**: `adm_sys01` opens purchase window

**Mutation**: `openPurchaseWindow`

**Parameters**:
- `adminId`: `adm_sys01`
- `reason`: "Opening purchase window for pilot testing. Buyers can now purchase inventory."

**State Changes**:
1. **Purchase Window Created**:
   - `purchaseWindows` table: New entry (or existing updated)
   - `isOpen`: `true`
   - `openedBy`: `adm_sys01`
   - `openedAt`: 14:40:00
   - `utid`: `"20240315-144000-adm-sys01"`

2. **Admin Action Logged**:
   - `adminActions` table: New entry
   - `utid`: `"20240315-144000-adm-sys01-action"`
   - `actionType`: `"open_purchase_window"`
   - `reason`: [as above]

**UTIDs Created**:
- `"20240315-144000-adm-sys01"` (purchase window UTID)
- `"20240315-144000-adm-sys01-action"` (admin action UTID)

**Admin Decisions Required**: None (window opened)

**Risk Points**:
- ✅ Window opened successfully
- ⚠️ **Note**: No inventory available yet (deliveries not converted to inventory)
- ⚠️ **Risk**: Buyers can see window is open but no inventory to purchase

**System State**:
- Purchase window: `open`
- Buyers can now attempt purchases
- Available inventory: 0 (no inventory created yet)

---

### T+0:45 - Farmer 2 Delivers Late (14:45:00)

**Action**: `far_beans02` delivers first unit to `tra_beta04`

**Reality**: Farmer delivers 10kg of beans to trader

**Context**: This delivery is for the unit locked at 14:22:00
- Delivery deadline: 20:22:00 (14:22:00 + 6 hours)
- Current time: 14:45:00
- ✅ Delivery is on time (deadline not yet passed)

**System State**: No system changes (delivery is physical)

**UTIDs Created**: None

**Admin Decisions Required**: 
- ⚠️ **Admin must verify delivery**

**Risk Points**:
- ✅ Delivery happened before deadline
- ⚠️ **Note**: Admin verification pending

---

### T+0:48 - Admin Verifies On-Time Delivery (14:48:00)

**Action**: `adm_sys01` verifies delivery

**Mutation**: `verifyDelivery`

**Parameters**:
- `adminId`: `adm_sys01`
- `lockUtid`: `"20240315-142200-tra-beta04"`
- `outcome`: `"delivered"`
- `reason`: "Farmer delivered on time. Trader confirmed receipt. Quality acceptable. Delivery completed at 14:45:00, verified at 14:48:00."

**State Changes**:
1. **Unit Status Updated**:
   - `listingUnits` table: Unit updated
   - `deliveryStatus`: `"delivered"`

2. **Admin Action Logged**:
   - `adminActions` table: New entry
   - `utid`: `"20240315-144800-adm-sys01"`
   - `actionType`: `"verify_delivery"`
   - `targetUtid`: `"20240315-142200-tra-beta04"`

**UTIDs Created**:
- `"20240315-144800-adm-sys01"` (admin action UTID)

**Admin Decisions Required**: None

**Risk Points**:
- ✅ Delivery verified on time

**System State**:
- Unit 1 (beans): `deliveryStatus = "delivered"`
- `tra_beta04` has 1 delivered unit, 1 pending delivery

---

### T+0:50 - Farmer 1 Delivers Second Unit (14:50:00)

**Action**: `far_maize01` delivers second unit to `tra_alpha03`

**Reality**: Farmer delivers 10kg of maize to trader

**Context**: This delivery is for the unit locked at 14:25:00
- Delivery deadline: 20:25:00
- Current time: 14:50:00
- ✅ Delivery is on time

**System State**: No system changes

**UTIDs Created**: None

**Admin Decisions Required**: 
- ⚠️ **Admin must verify delivery**

---

### T+0:52 - Admin Verifies Second Delivery (14:52:00)

**Action**: `adm_sys01` verifies delivery

**Mutation**: `verifyDelivery`

**Parameters**:
- `adminId`: `adm_sys01`
- `lockUtid`: `"20240315-142500-tra-alpha03"`
- `outcome`: `"delivered"`
- `reason`: "Farmer delivered on time. Trader confirmed receipt. Quality acceptable. Delivery completed at 14:50:00, verified at 14:52:00."

**State Changes**:
1. **Unit Status Updated**:
   - `deliveryStatus`: `"delivered"`

2. **Admin Action Logged**:
   - `utid`: `"20240315-145200-adm-sys01"`

**UTIDs Created**:
- `"20240315-145200-adm-sys01"` (admin action UTID)

**Admin Decisions Required**: None

**System State**:
- `tra_alpha03`: 2 units delivered
- `tra_beta04`: 1 unit delivered, 1 pending

---

### T+0:55 - Farmer 2 Fails to Deliver (Late Delivery Scenario) (14:55:00)

**Action**: `far_beans02` does NOT deliver second unit

**Context**: This delivery is for the unit locked at 14:35:00
- Delivery deadline: 20:35:00
- Current time: 14:55:00
- ⚠️ **Deadline not yet passed** (5 hours 40 minutes remaining)
- ⚠️ **But farmer has not delivered and is not responding**

**System State**: No system changes (delivery not happened)

**UTIDs Created**: None

**Admin Decisions Required**: 
- ⚠️ **Admin must monitor** - delivery deadline is 20:35:00
- ⚠️ **If deadline passes without delivery, admin must verify as "late"**

**Risk Points**:
- ⚠️ **Risk**: Delivery deadline approaching
- ⚠️ **Risk**: Capital locked (30,000 UGX)
- ⚠️ **Risk**: Unit unavailable for other traders
- ⚠️ **Risk**: If delivery fails, reversal needed

**System State**:
- Unit 2 (beans): `deliveryStatus = "pending"`
- `deliveryDeadline`: 20:35:00
- `tra_beta04`: 1 delivered, 1 pending (at risk)

---

### T+1:00 - End of Pilot Hour (15:00:00)

**Current System State**:

**Listings**:
- Maize listing: 2 units locked, 3 units available
- Beans listing: 1 unit delivered, 1 unit locked (pending), 1 unit available

**Traders**:
- `tra_alpha03`: 
  - Capital: 160,000 UGX available, 40,000 UGX locked
  - Exposure: 40,000 UGX
  - 2 units delivered (verified)
- `tra_beta04`:
  - Capital: 440,000 UGX available, 60,000 UGX locked
  - Exposure: 60,000 UGX
  - 1 unit delivered (verified), 1 unit pending (at risk)

**Buyers**:
- `buy_retail05`: No purchases yet (no inventory available)

**Admin**:
- Purchase window: Open
- 3 deliveries verified
- 1 delivery pending (at risk)

**UTIDs Created (Total)**:
- Listing UTIDs: 2
- Wallet deposit UTIDs: 2
- Lock UTIDs: 4
- Admin action UTIDs: 4 (3 verifications + 1 window open)
- **Total**: 12 UTIDs

**Admin Decisions Required**:
- ⚠️ **Monitor pending delivery** (deadline: 20:35:00)
- ⚠️ **If delivery fails, reverse transaction**

**Risk Points**:
- ⚠️ **1 pending delivery** at risk of being late
- ⚠️ **No inventory created yet** (deliveries verified but not converted)
- ⚠️ **Buyers cannot purchase** (no inventory available)

---

## Extended Simulation: Post-Pilot Hour

### T+6:00 - Delivery Deadline Passes (20:35:00)

**Action**: Delivery deadline for second beans unit has passed

**System State**:
- Unit 2 (beans): `deliveryStatus = "pending"`
- `deliveryDeadline`: 20:35:00 (passed)
- `hoursOverdue`: 0.5 hours (30 minutes)

**Admin Decisions Required**: 
- ⚠️ **CRITICAL**: Admin must verify delivery

**Admin Action**: `adm_sys01` verifies as "late"

**Mutation**: `verifyDelivery`

**Parameters**:
- `adminId`: `adm_sys01`
- `lockUtid`: `"20240315-143500-tra-beta04"`
- `outcome`: `"late"`
- `reason`: "Delivery deadline passed. Farmer did not deliver within 6-hour SLA. Deadline: 20:35:00, Current: 21:05:00 (30 minutes overdue). No communication received from farmer. Capital will be unlocked."

**State Changes**:
1. **Unit Status Updated**:
   - `deliveryStatus`: `"late"` (changed from "pending")

2. **Admin Action Logged**:
   - `utid`: `"20240315-210500-adm-sys01"`
   - `actionType`: `"verify_delivery"`
   - `targetUtid`: `"20240315-143500-tra-beta04"`

**UTIDs Created**:
- `"20240315-210500-adm-sys01"` (admin action UTID)

**Risk Points**:
- ⚠️ **Risk**: Delivery failed, reversal needed
- ⚠️ **Risk**: Capital locked (30,000 UGX)
- ⚠️ **Risk**: Unit unavailable

---

### T+6:05 - Admin Reverses Failed Delivery (21:05:00)

**Action**: `adm_sys01` reverses failed delivery

**Mutation**: `reverseDeliveryFailure`

**Parameters**:
- `adminId`: `adm_sys01`
- `lockUtid`: `"20240315-143500-tra-beta04"`
- `reason`: "Delivery failed - farmer did not deliver within SLA. Capital unlocked (UGX 30,000) and unit made available again. Trader and farmer notified."

**State Changes**:
1. **Wallet Ledger Entry**:
   - `walletLedger` table: New entry
   - `utid`: `"20240315-210500-adm-reverse"`
   - `type`: `"capital_unlock"`
   - `amount`: 30,000 UGX
   - `balanceAfter`: 470,000 UGX (440,000 + 30,000)

2. **Unit Unlocked**:
   - `listingUnits` table: Unit updated
   - `status`: `"available"` (changed from "locked")
   - `lockedBy`: `undefined` (cleared)
   - `lockedAt`: `undefined` (cleared)
   - `lockUtid`: `undefined` (cleared)
   - `deliveryDeadline`: `undefined` (cleared)
   - `deliveryStatus`: `undefined` (cleared)

3. **Listing Status Updated**:
   - `listings` table: Listing updated
   - `status`: `"partially_locked"` (1 of 3 units locked, 2 available)

4. **Admin Action Logged**:
   - `adminActions` table: New entry
   - `utid`: `"20240315-210505-adm-sys01"`
   - `actionType`: `"reverse_delivery_failure"`
   - `targetUtid`: `"20240315-143500-tra-beta04"`

**UTIDs Created**:
- `"20240315-210500-adm-reverse"` (capital unlock UTID)
- `"20240315-210505-adm-sys01"` (admin action UTID)

**Admin Decisions Required**: None (reversal complete)

**Risk Points**:
- ✅ Capital unlocked correctly
- ✅ Unit unlocked correctly
- ✅ Transaction reversed atomically
- ✅ All UTIDs logged

**System State**:
- `tra_beta04` capital balance: 470,000 UGX (unlocked)
- `tra_beta04` locked capital: 30,000 UGX (only first unit)
- `tra_beta04` exposure: 30,000 UGX (reduced from 60,000)
- Available units: 5 (3 maize + 2 beans)
- Locked units: 3 (2 maize + 1 beans)

---

### T+6:10 - Inventory Created (Simulated) (21:10:00)

**Note**: Inventory creation not yet implemented in v1, but simulated here

**Action**: System creates inventory from delivered units

**Simulated State Changes**:
1. **Trader Inventory Created**:
   - `traderInventory` table: New entries
   - `tra_alpha03`: 20kg maize inventory (2 units × 10kg)
   - `tra_beta04`: 10kg beans inventory (1 unit × 10kg)
   - `status`: `"in_storage"`
   - `storageStartTime`: 21:10:00
   - `utid`: `"20240315-211000-inv-alpha03"` (for trader 1)

2. **Units Updated**:
   - Delivered units: `status = "delivered"` (or removed from available)

**UTIDs Created**:
- `"20240315-211000-inv-alpha03"` (inventory UTID for trader 1)
- `"20240315-211000-inv-beta04"` (inventory UTID for trader 2)

**System State**:
- `tra_alpha03`: 20kg maize in storage
- `tra_beta04`: 10kg beans in storage
- Total inventory: 30kg available for buyers

---

### T+6:15 - Buyer Attempts Purchase (21:15:00)

**Action**: `buy_retail05` attempts to purchase 15kg of maize

**Mutation**: `createBuyerPurchase`

**Parameters**:
- `buyerId`: `buy_retail05`
- `inventoryId`: `tra_alpha03` maize inventory
- `kilos`: 15

**Pre-Check State**:
- Purchase window: `open` ✅
- Inventory status: `"in_storage"` ✅
- Available kilos: 20kg ✅
- Requested: 15kg ✅

**State Changes**:
1. **Inventory Locked**:
   - `traderInventory` table: Inventory updated
   - `status`: `"sold"` (changed from "in_storage")
   - 15kg locked, 5kg remaining (if partial purchase supported)

2. **Buyer Purchase Created**:
   - `buyerPurchases` table: New entry
   - `buyerId`: `buy_retail05`
   - `inventoryId`: [inventory ID]
   - `kilos`: 15
   - `utid`: `"20240315-211500-buy-retail05"`
   - `purchasedAt`: 21:15:00
   - `pickupSLA`: 23:15:00 (21:15:00 + 48 hours = 2 days later)
   - `status`: `"pending_pickup"`

**UTIDs Created**:
- `"20240315-211500-buy-retail05"` (purchase UTID)

**Admin Decisions Required**: None (yet - pickup pending)

**Risk Points**:
- ✅ Purchase window check: Passed
- ✅ Rate limit check: 1 purchase (limit: 5/hour) - OK
- ✅ Inventory available: OK
- ⚠️ **Risk**: Buyer must pick up within 48 hours (by 23:15:00 next day)

**System State**:
- `buy_retail05`: 1 purchase pending pickup
- `tra_alpha03`: 5kg maize remaining in storage
- Purchase window: Still open

---

### T+6:20 - Inventory Aging (Storage Fees) (21:20:00)

**Action**: System calculates storage fees for remaining inventory

**Context**: 
- `tra_alpha03`: 5kg maize remaining
- `tra_beta04`: 10kg beans in storage
- Storage started: 21:10:00
- Current time: 21:20:00
- Time in storage: 10 minutes (0.017 days)

**Storage Fee Calculation**:
- Rate: 0.5 kg per day per 100kg block
- `tra_alpha03`: 5kg = 0.05 blocks × 0.5 kg/day × 0.017 days = 0.0004 kg (negligible)
- `tra_beta04`: 10kg = 0.1 blocks × 0.5 kg/day × 0.017 days = 0.0009 kg (negligible)

**State Changes**: None (fees not yet deducted, just calculated)

**UTIDs Created**: None (calculation only)

**Admin Decisions Required**: None

**Risk Points**:
- ⚠️ **Note**: Storage fees accumulate over time
- ⚠️ **Risk**: If inventory sits for days, significant kilo loss
- ⚠️ **Risk**: Traders may not realize storage fees are accumulating

**System State**:
- Storage fees: Minimal (10 minutes)
- Projected loss: Negligible
- No action needed yet

---

### T+6:25 - Buyer Pickup Delay Scenario (21:25:00)

**Action**: `buy_retail05` has not picked up purchase

**Context**:
- Purchase made: 21:15:00
- Pickup deadline: 23:15:00 (next day, 48 hours later)
- Current time: 21:25:00
- Time until deadline: 25 hours 50 minutes
- ✅ Still within pickup window

**System State**: No changes (pickup deadline not yet passed)

**UTIDs Created**: None

**Admin Decisions Required**: 
- ⚠️ **Admin should monitor** - pickup deadline is 23:15:00 next day
- ⚠️ **If deadline passes, admin must update purchase status**

**Risk Points**:
- ⚠️ **Risk**: Buyer may not pick up
- ⚠️ **Risk**: Inventory stuck (sold but not picked up)
- ⚠️ **Risk**: If buyer doesn't pick up, inventory should be released

**System State**:
- Purchase: `status = "pending_pickup"`
- Inventory: `status = "sold"` (locked)
- Pickup deadline: 23:15:00 (next day)

---

## Complete UTID Chain Summary

### UTID Chain for Trader 1 (tra_alpha03)

```
1. Wallet Deposit: "20240315-141200-tra-alpha03"
   └─> Capital: 200,000 UGX

2. Unit Lock 1: "20240315-141800-tra-alpha03"
   ├─> Wallet: capital_lock (20,000 UGX)
   ├─> Unit: locked, deliveryDeadline: 20:18:00
   └─> Delivery Verified: "20240315-143200-adm-sys01"
       └─> deliveryStatus: "delivered"

3. Unit Lock 2: "20240315-142500-tra-alpha03"
   ├─> Wallet: capital_lock (20,000 UGX)
   ├─> Unit: locked, deliveryDeadline: 20:25:00
   └─> Delivery Verified: "20240315-145200-adm-sys01"
       └─> deliveryStatus: "delivered"

4. Inventory Created: "20240315-211000-inv-alpha03"
   └─> 20kg maize in storage
```

### UTID Chain for Trader 2 (tra_beta04)

```
1. Wallet Deposit: "20240315-141500-tra-beta04"
   └─> Capital: 500,000 UGX

2. Unit Lock 1: "20240315-142200-tra-beta04"
   ├─> Wallet: capital_lock (30,000 UGX)
   ├─> Unit: locked, deliveryDeadline: 20:22:00
   └─> Delivery Verified: "20240315-144800-adm-sys01"
       └─> deliveryStatus: "delivered"

3. Unit Lock 2: "20240315-143500-tra-beta04"
   ├─> Wallet: capital_lock (30,000 UGX)
   ├─> Unit: locked, deliveryDeadline: 20:35:00
   ├─> Delivery Verified: "20240315-210500-adm-sys01"
   │   └─> deliveryStatus: "late"
   └─> Reversal: "20240315-210500-adm-reverse"
       ├─> Wallet: capital_unlock (30,000 UGX)
       └─> Unit: unlocked (status: "available")

4. Inventory Created: "20240315-211000-inv-beta04"
   └─> 10kg beans in storage
```

### UTID Chain for Buyer (buy_retail05)

```
1. Purchase: "20240315-211500-buy-retail05"
   ├─> Inventory: locked (15kg maize)
   ├─> Purchase window: open
   └─> Pickup deadline: 23:15:00 (next day)
```

### UTID Chain for Admin Actions

```
1. Open Purchase Window: "20240315-144000-adm-sys01"
   └─> Purchase window: open

2. Verify Delivery 1: "20240315-143200-adm-sys01"
   └─> Target: "20240315-141800-tra-alpha03"

3. Verify Delivery 2: "20240315-144800-adm-sys01"
   └─> Target: "20240315-142200-tra-beta04"

4. Verify Delivery 3: "20240315-145200-adm-sys01"
   └─> Target: "20240315-142500-tra-alpha03"

5. Verify Delivery 4 (Late): "20240315-210500-adm-sys01"
   └─> Target: "20240315-143500-tra-beta04"

6. Reverse Delivery: "20240315-210505-adm-sys01"
   └─> Target: "20240315-143500-tra-beta04"
```

---

## Risk Points Summary

### High Risk Points

1. **Late Delivery** (T+6:00)
   - **Risk**: Farmer did not deliver within SLA
   - **Impact**: Capital locked, unit unavailable
   - **Resolution**: Admin verified as "late", reversed transaction
   - **UTID**: `"20240315-143500-tra-beta04"`

2. **Pending Pickup** (T+6:25)
   - **Risk**: Buyer may not pick up within 48 hours
   - **Impact**: Inventory stuck, unavailable for other buyers
   - **Resolution**: Admin must monitor and update status if deadline passes
   - **UTID**: `"20240315-211500-buy-retail05"`

### Medium Risk Points

1. **Multiple Pending Deliveries**
   - **Risk**: Multiple deliveries pending simultaneously
   - **Impact**: Higher capital lock, more admin verification needed
   - **Mitigation**: Admin monitoring, timely verification

2. **Storage Fee Accumulation**
   - **Risk**: Inventory sitting in storage accruing fees
   - **Impact**: Trader value loss over time
   - **Mitigation**: Admin monitoring, trader notifications

### Low Risk Points

1. **Rate Limits**
   - **Risk**: Users hitting rate limits
   - **Impact**: Operations blocked temporarily
   - **Mitigation**: Rate limits logged, admin can review

2. **Spend Cap**
   - **Risk**: Traders approaching spend cap
   - **Impact**: Traders unable to make new purchases
   - **Mitigation**: Admin monitoring, trader notifications

---

## Admin Decisions Required Summary

### Immediate Decisions (During Pilot)

1. **T+0:32**: Verify first delivery ✅
   - Decision: Verified as "delivered"
   - UTID: `"20240315-143200-adm-sys01"`

2. **T+0:48**: Verify second delivery ✅
   - Decision: Verified as "delivered"
   - UTID: `"20240315-144800-adm-sys01"`

3. **T+0:52**: Verify third delivery ✅
   - Decision: Verified as "delivered"
   - UTID: `"20240315-145200-adm-sys01"`

4. **T+0:40**: Open purchase window ✅
   - Decision: Window opened
   - UTID: `"20240315-144000-adm-sys01"`

### Post-Pilot Decisions

5. **T+6:00**: Verify late delivery ⚠️
   - Decision: Verified as "late"
   - UTID: `"20240315-210500-adm-sys01"`

6. **T+6:05**: Reverse failed delivery ⚠️
   - Decision: Reversed transaction
   - UTID: `"20240315-210505-adm-sys01"`

7. **T+6:25+**: Monitor buyer pickup ⚠️
   - Decision: Pending (deadline: 23:15:00 next day)
   - Action: Admin must update status if deadline passes

---

## Key Learnings from Simulation

### What Worked Well

1. ✅ **Pay-to-Lock Atomicity**: All locks happened atomically
2. ✅ **Spend Cap Enforcement**: Traders stayed within limits
3. ✅ **Rate Limiting**: No spam detected
4. ✅ **UTID Tracking**: All actions tracked with UTIDs
5. ✅ **Admin Verification**: Timely verification of deliveries

### Areas of Concern

1. ⚠️ **Late Deliveries**: 1 out of 4 deliveries was late (25% failure rate)
2. ⚠️ **Admin Response Time**: Admin verified deliveries within 2-3 minutes (good)
3. ⚠️ **Inventory Creation**: Not yet implemented (simulated)
4. ⚠️ **Pickup Monitoring**: Buyer pickup deadline requires monitoring

### System Health Indicators

- **Error Rate**: 0% (no system errors)
- **Transaction Success Rate**: 100% (all valid transactions succeeded)
- **Delivery On-Time Rate**: 75% (3 out of 4 on time)
- **Admin Response Time**: 2-3 minutes (excellent)
- **UTID Coverage**: 100% (all actions have UTIDs)

---

## Simulation Statistics

### Transactions

- **Listings Created**: 2
- **Capital Deposits**: 2
- **Unit Locks**: 4
- **Deliveries Verified**: 4 (3 on-time, 1 late)
- **Transaction Reversals**: 1
- **Purchases**: 1
- **Admin Actions**: 6

### Financial

- **Total Capital Deposited**: 700,000 UGX
- **Total Capital Locked**: 100,000 UGX (peak)
- **Total Capital Unlocked**: 30,000 UGX (reversal)
- **Final Capital Locked**: 70,000 UGX
- **No Capital Lost**: ✅

### Inventory

- **Inventory Created**: 30kg (20kg maize + 10kg beans)
- **Inventory Sold**: 15kg (maize)
- **Inventory Remaining**: 15kg (5kg maize + 10kg beans)
- **Storage Fees**: Negligible (10 minutes)

### UTIDs

- **Total UTIDs Created**: 15
- **Listing UTIDs**: 2
- **Wallet UTIDs**: 5 (2 deposits + 3 locks + 1 unlock)
- **Lock UTIDs**: 4
- **Admin Action UTIDs**: 6
- **Purchase UTIDs**: 1
- **Inventory UTIDs**: 2 (simulated)

---

*Simulation Date: 2024-03-15*  
*Duration: 1 hour (14:00-15:00) + extended scenarios*  
*Status: Complete*
