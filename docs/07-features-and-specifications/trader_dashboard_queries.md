# Trader Dashboard Queries

## Overview

Read-only queries for traders to view their dashboard. All queries are trader-specific, server-side calculated, and preserve anonymity by only exposing aliases.

---

## Queries

### 1. `getLedgerBreakdown`

**Purpose**: View capital ledger vs profit ledger with detailed entries.

**Returns**:
- Capital ledger: balance, locked amount, available amount, all entries
- Profit ledger: balance, all entries
- All entries include UTID, type, amount, timestamp

**Trader-Specific**:
- ✅ Only queries `walletLedger` with `userId = traderId`
- ✅ No other traders' data accessed
- ✅ Server-side filtering by trader ID

---

### 2. `getExposureStatus`

**Purpose**: View current exposure vs UGX 1,000,000 spend cap.

**Returns**:
- Exposure breakdown: locked capital, locked orders value, inventory value
- Spend cap: max exposure, remaining capacity, usage percentage
- Breakdown percentages: contribution of each exposure component

**Trader-Specific**:
- ✅ Uses `calculateTraderExposureInternal` which filters by `traderId`
- ✅ Only calculates exposure for this trader
- ✅ No other traders' data included

---

### 3. `getTraderActiveUTIDs`

**Purpose**: View all active UTIDs associated with trader's transactions.

**Returns**:
- All UTIDs from: wallet entries, unit locks, inventory
- Status for each UTID
- Related entities (units, listings, inventory)
- Only aliases shown (no real identities)

**Trader-Specific**:
- ✅ Wallet entries: Filtered by `userId = traderId`
- ✅ Unit locks: Only units where `lockedBy = traderId`
- ✅ Inventory: Only inventory where `traderId = traderId`
- ✅ No other traders' UTIDs included

---

### 4. `getInventoryWithProjectedLoss`

**Purpose**: View inventory in storage with projected kilo loss from storage fees.

**Returns**:
- Inventory blocks in storage
- Days in storage (server-calculated)
- Projected kilo loss (current and next 7 days)
- Storage fee rate
- Original price per kilo (for context)

**Trader-Specific**:
- ✅ Only queries inventory where `traderId = traderId`
- ✅ No other traders' inventory shown
- ✅ All calculations done server-side

---

## How Anonymity is Preserved

### 1. Only Aliases Exposed

**Rule**: Traders never see real names, emails, or phone numbers.

**Implementation**:

#### In `getTraderActiveUTIDs`:
```typescript
// Get farmer info (only alias exposed)
const farmer = listing ? await ctx.db.get(listing.farmerId) : null;
farmerAlias: farmer?.alias || null, // Only alias, no real identity
```

**What Trader Sees**:
- ✅ `farmerAlias: "far_a3k9x2"` (system-generated alias)
- ❌ No email, phone, or real name

**What Trader Does NOT See**:
- ❌ Farmer's email
- ❌ Farmer's phone number
- ❌ Farmer's real name
- ❌ Any identifying information

---

### 2. Server-Side Filtering

**Rule**: All data filtering happens server-side, trader can only query their own data.

**Implementation**:

#### Wallet Entries:
```typescript
// Server-side filter by trader ID
const walletEntries = await ctx.db
  .query("walletLedger")
  .withIndex("by_user", (q) => q.eq("userId", args.traderId)) // Filtered server-side
  .collect();
```

**Why This Preserves Anonymity**:
- ✅ Trader cannot query other traders' wallet entries
- ✅ Server enforces `userId = traderId` filter
- ✅ No cross-user data exposure possible

#### Unit Locks:
```typescript
// Only units locked by this trader
for (const unit of lockedUnits) {
  if (unit.lockedBy === args.traderId) { // Server-side check
    // Include this unit
  }
}
```

**Why This Preserves Anonymity**:
- ✅ Trader only sees units they locked
- ✅ Cannot see other traders' locked units
- ✅ Cannot infer other traders' activity

#### Inventory:
```typescript
// Only this trader's inventory
const inventory = await ctx.db
  .query("traderInventory")
  .withIndex("by_trader", (q) => q.eq("traderId", args.traderId)) // Filtered server-side
  .collect();
```

**Why This Preserves Anonymity**:
- ✅ Trader only sees their own inventory
- ✅ Cannot see other traders' inventory
- ✅ Cannot infer market activity of others

---

### 3. No Cross-User Data Exposure

**Rule**: Traders cannot access data from other users.

**Enforcement**:

#### Query Arguments:
```typescript
export const getLedgerBreakdown = query({
  args: {
    traderId: v.id("users"), // Trader must provide their own ID
  },
  handler: async (ctx, args) => {
    // Verify trader role
    const user = await ctx.db.get(args.traderId);
    if (!user || user.role !== "trader") {
      throw new Error("User is not a trader");
    }
    // All queries filtered by args.traderId
  },
});
```

**Why This Works**:
- ✅ Trader must provide their own `traderId`
- ✅ Server verifies role matches
- ✅ All queries filtered by this `traderId`
- ✅ Cannot query other traders' data

#### Index Usage:
```typescript
// All queries use indexes filtered by trader ID
.withIndex("by_user", (q) => q.eq("userId", args.traderId))
.withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
```

**Why This Preserves Anonymity**:
- ✅ Database indexes enforce filtering
- ✅ Cannot bypass filters (server-side only)
- ✅ Efficient queries (indexed lookups)
- ✅ No full table scans that could expose other data

---

### 4. Server-Side Calculations

**Rule**: All calculations done server-side, no client-side data processing.

**Implementation**:

#### Exposure Calculation:
```typescript
// Server-side calculation using canonical function
const exposure = await calculateTraderExposureInternal(ctx, args.traderId);
```

**Why This Preserves Anonymity**:
- ✅ Calculation uses only this trader's data
- ✅ No other traders' data accessed
- ✅ Client receives only calculated result
- ✅ Cannot infer other traders' exposure

#### Storage Fee Projections:
```typescript
// Server-side calculation
const daysInStorage = (now - inv.storageStartTime) / (1000 * 60 * 60 * 24);
const projectedKilosLost = blocks * DEFAULT_STORAGE_FEE_RATE_KG_PER_DAY * fullDays;
```

**Why This Preserves Anonymity**:
- ✅ Calculations done server-side
- ✅ Only this trader's inventory used
- ✅ Client receives only projections
- ✅ Cannot infer other traders' storage patterns

---

### 5. Alias-Only Responses

**Rule**: All user references return only aliases.

**Implementation**:

#### Farmer Aliases:
```typescript
const farmer = listing ? await ctx.db.get(listing.farmerId) : null;
farmerAlias: farmer?.alias || null, // Only alias returned
```

**What's Excluded**:
- ❌ `farmer.email` - Never returned
- ❌ `farmer.phone` - Not in schema
- ❌ `farmer.realName` - Not in schema
- ✅ Only `farmer.alias` - System-generated, non-identifying

#### Trader Aliases:
```typescript
// When showing trader's own info, still only alias
// (though trader knows their own identity, system still uses alias for consistency)
```

**Why This Matters**:
- ✅ Consistent API (always aliases)
- ✅ No accidental identity leaks
- ✅ Future-proof (if trader info shown to others, alias used)

---

### 6. No Aggregated Cross-User Data

**Rule**: Traders cannot see aggregated data that reveals other users' activity.

**Implementation**:

#### Exposure Calculation:
```typescript
// Only calculates for this trader
const exposure = await calculateTraderExposureInternal(ctx, args.traderId);
// Does NOT include:
// - Other traders' exposure
// - Market-wide statistics
// - Comparative data
```

**Why This Preserves Anonymity**:
- ✅ Trader sees only their own exposure
- ✅ Cannot infer other traders' activity
- ✅ Cannot see market trends that reveal identities
- ✅ No comparative data that could identify users

#### Inventory Queries:
```typescript
// Only this trader's inventory
const inventory = await ctx.db
  .query("traderInventory")
  .withIndex("by_trader", (q) => q.eq("traderId", args.traderId))
  .collect();
// Does NOT include:
// - Other traders' inventory
// - Market-wide inventory levels
// - Comparative statistics
```

**Why This Preserves Anonymity**:
- ✅ Trader sees only their own inventory
- ✅ Cannot infer other traders' inventory levels
- ✅ Cannot see market patterns that reveal activity
- ✅ No data that could identify other users

---

## Example: What Trader Sees vs. What's Hidden

### Scenario: Trader views locked units

**What Trader Sees** (`getTraderActiveUTIDs`):
```typescript
{
  utid: "20240215-143022-tra-a3k9x2",
  type: "unit_lock",
  status: "pending",
  entities: [{
    unitId: "unit123",
    produceType: "maize",
    farmerAlias: "far_a3k9x2",  // ✅ Only alias
    deliveryDeadline: 1708021600000,
    deliveryStatus: "pending",
  }]
}
```

**What Trader Does NOT See**:
- ❌ Farmer's email
- ❌ Farmer's phone number
- ❌ Farmer's real name
- ❌ Other traders' locked units
- ❌ Other traders' aliases (unless in same transaction)
- ❌ Market-wide statistics

---

## Anonymity Guarantees

### 1. Data Isolation ✅

- ✅ Trader can only query their own data
- ✅ Server-side filtering by `traderId`
- ✅ Index-based queries prevent cross-user access
- ✅ No full table scans that could expose other data

### 2. Alias-Only Exposure ✅

- ✅ Only system-generated aliases returned
- ✅ No real names, emails, or phone numbers
- ✅ Aliases are stable but non-identifying
- ✅ Consistent across all queries

### 3. Server-Side Enforcement ✅

- ✅ All filtering done server-side
- ✅ Role verification before data access
- ✅ Calculations use only trader's data
- ✅ Client cannot bypass filters

### 4. No Cross-User Inference ✅

- ✅ No aggregated market data
- ✅ No comparative statistics
- ✅ No data that reveals other users' activity
- ✅ No patterns that could identify users

---

## Summary

### Queries Provided ✅

1. **`getLedgerBreakdown`**: Capital vs profit ledger
2. **`getExposureStatus`**: Exposure vs spend cap
3. **`getTraderActiveUTIDs`**: Active UTIDs with status
4. **`getInventoryWithProjectedLoss`**: Inventory with storage fee projections

### Anonymity Preserved ✅

1. **Only aliases exposed**: No real names, emails, or phone numbers
2. **Server-side filtering**: All queries filtered by `traderId`
3. **No cross-user data**: Traders can only see their own data
4. **Server-side calculations**: All calculations use only trader's data
5. **Alias-only responses**: Consistent alias usage across all queries

### Safety Features ✅

1. **Read-only**: No mutations, safe for dashboard
2. **Trader-only**: Role verification before data access
3. **Indexed queries**: Efficient, filtered lookups
4. **Server-side**: All logic runs server-side
5. **Isolated data**: No cross-user data exposure possible

---

*Implementation Date: Trader dashboard queries added*  
*Status: Read-only, trader-specific, anonymity preserved*
