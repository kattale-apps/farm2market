# Buyer Dashboard Queries

## Overview

Read-only queries for buyers to view their dashboard. All queries are buyer-specific, server-side calculated, and preserve anonymity by only exposing trader aliases. **Buyers never see prices** - this is a core non-negotiable rule.

---

## Queries

### 1. `getAvailableInventory`

**Purpose**: View available inventory in 100kg blocks.

**Returns**:
- All inventory with status `"in_storage"` (available for purchase)
- Produce type, total kilos, block size
- Trader aliases (anonymity preserved)
- Inventory UTID
- Grouped by produce type

**Buyer-Specific**:
- ✅ Only queries inventory with `status = "in_storage"`
- ✅ Server-side filtering
- ✅ No prices shown (critical rule)
- ✅ Only trader aliases (no real identities)

**What Buyers DO NOT See**:
- ❌ Prices (never shown to buyers)
- ❌ Trader real identity
- ❌ Other buyers' purchases
- ❌ Storage fees
- ❌ Purchase history

---

### 2. `getPurchaseWindowStatus`

**Purpose**: Check if purchase window is open.

**Returns**:
- `isOpen`: Whether purchase window is currently open
- `openedAt`: When window was opened (if open)
- `openedByAlias`: Admin alias who opened it (if open)
- `utid`: Admin action UTID (if open)

**Buyer-Specific**:
- ✅ Buyer role verification
- ✅ Real-time window status
- ✅ Admin alias only (anonymity preserved)

**Why This Matters**:
- ✅ Buyers can only purchase during open windows
- ✅ Admin controls when purchases are allowed
- ✅ Creates controlled access (prevents uncontrolled trading)

---

### 3. `getBuyerOrders`

**Purpose**: View all purchases made by this buyer.

**Returns**:
- All purchases with purchase UTID
- Produce type and kilos
- Trader aliases (anonymity preserved)
- Purchase timestamp
- Pickup deadline (48 hours after purchase)
- Server-calculated countdown (hours remaining or overdue)
- Status (pending_pickup, picked_up, expired)
- Grouped by status

**Buyer-Specific**:
- ✅ Only queries purchases where `buyerId = args.buyerId`
- ✅ Server-side filtering by buyer ID
- ✅ No other buyers' purchases shown
- ✅ No prices shown (critical rule)

---

### 4. `getBuyerActiveOrders`

**Purpose**: View only active orders (pending pickup).

**Returns**:
- Same as `getBuyerOrders` but filtered to `status = "pending_pickup"`
- Convenience query for buyers to see only orders needing pickup

**Buyer-Specific**:
- ✅ Only pending pickup orders
- ✅ Server-side filtering
- ✅ No prices shown

---

## How This Discourages Side Trading

### 1. No Price Visibility

**Rule**: Buyers never see prices in any query or mutation.

**Implementation**:
```typescript
// In all buyer queries, prices are NEVER included
return {
  produceType: inventory.produceType,
  totalKilos: inventory.totalKilos,
  traderAlias: trader?.alias || null,
  // NO pricePerKilo
  // NO totalPrice
  // NO cost information
};
```

**Why This Discourages Side Trading**:
- ✅ **No price negotiation possible**: Buyers cannot see what traders paid, so they cannot negotiate outside the platform
- ✅ **No price comparison**: Buyers cannot compare prices across traders to find "better deals" outside the platform
- ✅ **No arbitrage opportunity**: Without price visibility, buyers cannot identify arbitrage opportunities to exploit outside the platform
- ✅ **Platform is the only price source**: Since buyers don't know prices, they cannot negotiate alternative deals

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer: "I see you have 100kg of maize. What did you pay for it?"
Trader: "I paid UGX 2,000/kg"
Buyer: "I'll give you UGX 2,200/kg if we trade outside the platform"

✅ With No Price Visibility:
Buyer: "I see you have 100kg of maize. What did you pay for it?"
Trader: "I can't tell you - the platform doesn't show prices to buyers"
Buyer: "How can I negotiate without knowing prices?"
Trader: "You can't - you must use the platform"
```

---

### 2. Purchase Window Control

**Rule**: Buyers can only purchase during admin-opened windows.

**Implementation**:
```typescript
// In createBuyerPurchase mutation (convex/buyers.ts)
const purchaseWindow = await ctx.db
  .query("purchaseWindows")
  .withIndex("by_status", (q) => q.eq("isOpen", true))
  .first();

if (!purchaseWindow) {
  throw new Error("Purchase window is not open");
}
```

**Why This Discourages Side Trading**:
- ✅ **Controlled access**: Admin controls when purchases are allowed
- ✅ **No continuous trading**: Buyers cannot purchase at any time, reducing opportunity for side deals
- ✅ **Platform is the only path**: If window is closed, buyers cannot purchase through platform, but also cannot easily arrange side deals (no price visibility)
- ✅ **Admin oversight**: Admin can monitor and control trading activity

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer: "The purchase window is closed. Can we trade outside the platform?"
Trader: "Sure, I'll sell you 100kg for UGX 2,200/kg"
Buyer: "Deal!"

✅ With Purchase Window Control + No Price Visibility:
Buyer: "The purchase window is closed. Can we trade outside the platform?"
Trader: "I don't know what price to charge - the platform doesn't show prices to buyers"
Buyer: "How do we negotiate?"
Trader: "We can't - we must wait for the window to open and use the platform"
```

---

### 3. UTID Audit Trail

**Rule**: All transactions tracked with UTIDs.

**Implementation**:
```typescript
// Every purchase has a UTID
purchaseUtid: purchase.utid, // Purchase transaction UTID
inventoryUtid: inventory?.utid || null, // Inventory creation UTID
```

**Why This Discourages Side Trading**:
- ✅ **Complete traceability**: All platform transactions are logged with UTIDs
- ✅ **Audit trail**: Admin can trace all transactions
- ✅ **No hidden transactions**: Side trades cannot be tracked, making them risky
- ✅ **Accountability**: Traders and buyers are accountable for all platform transactions

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer: "Let's trade outside the platform to avoid fees"
Trader: "OK, but there's no UTID for this transaction"
Buyer: "That's fine - no one will know"

✅ With UTID Audit Trail:
Buyer: "Let's trade outside the platform to avoid fees"
Trader: "But there's no UTID - admin will see we made a purchase but no UTID"
Buyer: "That's risky - we could be flagged"
Trader: "Let's just use the platform - it's safer"
```

---

### 4. Anonymity (Alias-Only)

**Rule**: Buyers only see trader aliases, never real identities.

**Implementation**:
```typescript
traderAlias: trader?.alias || null, // Only alias, no real identity
// Never returns:
// - trader.email
// - trader.phone
// - trader.realName
```

**Why This Discourages Side Trading**:
- ✅ **No direct contact**: Buyers cannot contact traders directly (no email/phone)
- ✅ **Platform is the only communication channel**: All communication must go through platform
- ✅ **No relationship building**: Without real identities, buyers and traders cannot build relationships outside the platform
- ✅ **Reduced trust**: Without real identities, side trading is riskier

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer: "I see trader 'tra_a3k9x2' has maize. Let me find their contact info"
Buyer: *Searches for trader's email/phone*
Buyer: "Found them! Let's trade outside the platform"

✅ With Anonymity:
Buyer: "I see trader 'tra_a3k9x2' has maize. Let me find their contact info"
Buyer: *Searches but finds no email/phone - only alias*
Buyer: "I can't contact them directly - I must use the platform"
```

---

### 5. Atomic Inventory Locking

**Rule**: Inventory is locked atomically on purchase.

**Implementation**:
```typescript
// In createBuyerPurchase mutation (convex/buyers.ts)
// Step 1: Lock inventory (status → "sold")
await ctx.db.patch(args.inventoryId, {
  status: "sold",
});

// Step 2: Create buyer purchase entry
await ctx.db.insert("buyerPurchases", {
  buyerId: args.buyerId,
  inventoryId: args.inventoryId,
  kilos: args.kilos,
  utid: purchaseUtid,
  // ...
});
```

**Why This Discourages Side Trading**:
- ✅ **First-come-first-served**: First buyer to purchase locks inventory
- ✅ **No double-selling**: Trader cannot sell same inventory to multiple buyers
- ✅ **Platform is the only path**: Inventory can only be purchased through platform
- ✅ **Atomic operation**: Either purchase succeeds or fails (no partial state)

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer A: "I'll buy 100kg of maize for UGX 2,200/kg outside the platform"
Trader: "OK, but I'll also list it on the platform"
Buyer B: *Purchases on platform*
Trader: "Oops, I sold it twice!"

✅ With Atomic Inventory Locking:
Buyer A: "I'll buy 100kg of maize outside the platform"
Trader: "But if I list it on the platform, the first buyer will lock it"
Buyer A: "What if I pay you first?"
Trader: "But the platform will still lock it when someone purchases"
Buyer A: "This is too risky - let's use the platform"
```

---

### 6. Pickup Deadline Enforcement

**Rule**: Buyers must pick up within 48 hours (tracked with UTID).

**Implementation**:
```typescript
pickupSLA: purchase.pickupSLA, // Deadline timestamp (48 hours after purchase)
isPastDeadline: now > purchase.pickupSLA,
hoursOverdue: isPastDeadline ? (now - purchase.pickupSLA) / hours : 0,
```

**Why This Discourages Side Trading**:
- ✅ **Accountability**: Buyers are accountable for pickup deadlines
- ✅ **Platform oversight**: Admin can monitor pickup compliance
- ✅ **UTID tracking**: All pickups tracked with UTID
- ✅ **No hidden pickups**: Side pickups cannot be tracked

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer: "Let's arrange pickup outside the platform"
Trader: "OK, but there's no pickup deadline tracking"
Buyer: "That's fine - no one will know if I'm late"

✅ With Pickup Deadline Enforcement:
Buyer: "Let's arrange pickup outside the platform"
Trader: "But there's no UTID for this pickup - admin will see I have inventory but no pickup record"
Buyer: "That's risky - we could be flagged"
Trader: "Let's use the platform - it tracks everything"
```

---

### 7. Platform as Single Source of Truth

**Rule**: Platform is the only way to purchase inventory.

**Why This Discourages Side Trading**:
- ✅ **No alternative paths**: Buyers cannot purchase outside the platform
- ✅ **Inventory only available on platform**: Inventory is only listed on platform
- ✅ **All transactions on platform**: All purchases must go through platform
- ✅ **Admin oversight**: Admin can monitor all activity

**Example Scenario**:
```
❌ Side Trading Attempt:
Buyer: "I'll buy 100kg of maize outside the platform"
Trader: "OK, but I need to remove it from the platform first"
Buyer: "Why?"
Trader: "Because if someone purchases it on the platform, it will be locked"
Buyer: "This is complicated - let's just use the platform"

✅ With Platform as Single Source of Truth:
Buyer: "I'll buy 100kg of maize outside the platform"
Trader: "But inventory is only available on the platform"
Buyer: "Can't we trade directly?"
Trader: "No - the platform is the only way to purchase"
Buyer: "OK, let's use the platform then"
```

---

## Summary: How Side Trading is Discouraged

### 1. No Price Visibility ✅
- Buyers never see prices
- Cannot negotiate outside platform
- Cannot compare prices
- Platform is the only price source

### 2. Purchase Window Control ✅
- Admin controls when purchases are allowed
- No continuous trading
- Platform is the only path
- Admin oversight

### 3. UTID Audit Trail ✅
- All transactions tracked with UTIDs
- Complete traceability
- No hidden transactions
- Accountability

### 4. Anonymity (Alias-Only) ✅
- Buyers only see trader aliases
- No direct contact possible
- Platform is the only communication channel
- Reduced trust for side trading

### 5. Atomic Inventory Locking ✅
- First-come-first-served
- No double-selling
- Platform is the only path
- Atomic operation

### 6. Pickup Deadline Enforcement ✅
- Buyers accountable for pickup deadlines
- Platform oversight
- UTID tracking
- No hidden pickups

### 7. Platform as Single Source of Truth ✅
- No alternative paths
- Inventory only available on platform
- All transactions on platform
- Admin oversight

---

## Example: Complete Side Trading Prevention Flow

### Scenario: Buyer attempts to arrange side trade

1. **Buyer views available inventory** (`getAvailableInventory`)
   - Sees 100kg of maize available
   - Sees trader alias: `"tra_a3k9x2"`
   - **Does NOT see price** (critical)
   - Cannot negotiate without price information

2. **Buyer checks purchase window** (`getPurchaseWindowStatus`)
   - Window is closed
   - Cannot purchase through platform
   - **Cannot purchase outside platform** (no price visibility)

3. **Buyer attempts to contact trader**
   - Only has trader alias: `"tra_a3k9x2"`
   - **No email/phone** (anonymity preserved)
   - Cannot contact trader directly

4. **Buyer attempts to negotiate**
   - **Does not know price** (no price visibility)
   - Cannot compare prices
   - Cannot negotiate alternative deal

5. **Buyer attempts to purchase outside platform**
   - **Inventory is locked on platform** (atomic locking)
   - Cannot purchase same inventory twice
   - **No UTID for side trade** (audit trail missing)

6. **Result**: Buyer must use platform
   - Platform is the only way to purchase
   - All transactions tracked with UTID
   - Admin oversight
   - Complete accountability

---

## Technical Implementation Details

### No Price Exposure

**In All Buyer Queries**:
```typescript
// ✅ CORRECT: No prices
return {
  produceType: inventory.produceType,
  totalKilos: inventory.totalKilos,
  traderAlias: trader?.alias || null,
  // NO pricePerKilo
  // NO totalPrice
};

// ❌ WRONG: Prices exposed
return {
  produceType: inventory.produceType,
  pricePerKilo: listing.pricePerKilo, // NEVER DO THIS
  totalPrice: listing.pricePerKilo * inventory.totalKilos, // NEVER DO THIS
};
```

**Enforcement**:
- ✅ All buyer queries explicitly exclude prices
- ✅ Schema comment: `// Buyers never see prices`
- ✅ Code comments: `// NO PRICES - buyers never see prices`
- ✅ TypeScript types: No price fields in buyer response types

---

### Anonymity Preservation

**In All Buyer Queries**:
```typescript
// ✅ CORRECT: Only alias
traderAlias: trader?.alias || null,

// ❌ WRONG: Real identity
traderEmail: trader?.email, // NEVER DO THIS
traderPhone: trader?.phone, // NEVER DO THIS
traderName: trader?.realName, // NEVER DO THIS
```

**Enforcement**:
- ✅ All buyer queries only return aliases
- ✅ No email/phone/name fields in buyer responses
- ✅ Server-side filtering ensures no cross-user data

---

### Server-Side Filtering

**In All Buyer Queries**:
```typescript
// ✅ CORRECT: Server-side filtering
const user = await ctx.db.get(args.buyerId);
if (!user || user.role !== "buyer") {
  throw new Error("User is not a buyer");
}

// ✅ CORRECT: Filter by buyerId
const purchases = await ctx.db
  .query("buyerPurchases")
  .withIndex("by_buyer", (q) => q.eq("buyerId", args.buyerId))
  .collect();
```

**Enforcement**:
- ✅ All queries verify buyer role server-side
- ✅ All queries filter by `buyerId`
- ✅ No client-side filtering
- ✅ Index-based queries prevent cross-user access

---

## Summary

### Queries Provided ✅

1. **`getAvailableInventory`**: Available inventory in 100kg blocks (no prices)
2. **`getPurchaseWindowStatus`**: Purchase window status (open/closed)
3. **`getBuyerOrders`**: All buyer's orders with pickup deadlines
4. **`getBuyerActiveOrders`**: Active orders only (pending pickup)

### Side Trading Prevention ✅

1. **No price visibility**: Buyers never see prices, cannot negotiate outside platform
2. **Purchase window control**: Admin controls when purchases are allowed
3. **UTID audit trail**: All transactions tracked with UTIDs
4. **Anonymity**: Buyers only see trader aliases, no direct contact
5. **Atomic inventory locking**: First-come-first-served, no double-selling
6. **Pickup deadline enforcement**: Buyers accountable for pickup deadlines
7. **Platform as single source of truth**: No alternative paths to purchase

### Anonymity Preserved ✅

1. **Only aliases**: Traders shown as aliases only
2. **Server-side filtering**: All queries filtered by buyerId
3. **No cross-user data**: Buyers only see their own purchases
4. **Consistent API**: Always aliases, never real identities

---

*Implementation Date: Buyer dashboard queries added*  
*Status: Read-only, buyer-specific, side trading discouraged, no price visibility*
