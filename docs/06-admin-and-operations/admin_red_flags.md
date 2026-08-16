# Admin Red-Flag Queries

## Overview

Admin-only read-only queries that identify high-risk situations requiring immediate attention. These queries are designed for quick scanning and early intervention.

---

## Red-Flag Categories

### 1. Deliveries Past SLA But Not Yet Resolved

**Query**: `getDeliveriesPastSLA`

**What It Detects**:
- Units that are locked (payment received)
- Delivery deadline has passed (6 hours after payment)
- Delivery status is still "pending" (not yet verified by admin)

**Why This Is Highest Risk**:

#### 1.1 Capital Locked Indefinitely
- **Risk**: Trader's capital is locked in the system but delivery status is unclear
- **Impact**: Trader cannot use locked capital for other purchases
- **System Impact**: Reduces available trader capacity, potentially blocking new trades
- **Example**: Trader has UGX 500,000 locked waiting for delivery verification, cannot make new purchases

#### 1.2 Farmer Accountability Unclear
- **Risk**: Farmer may have delivered late or not at all, but status is not verified
- **Impact**: System cannot determine if delivery was successful or failed
- **System Impact**: Cannot proceed with inventory creation or reversal
- **Example**: Farmer delivered 2 hours late, but admin hasn't verified yet - system is stuck

#### 1.3 System Cannot Proceed
- **Risk**: System is waiting for admin verification to proceed
- **Impact**: No automated resolution, requires admin intervention
- **System Impact**: Blocks downstream operations (inventory creation, reversals)
- **Example**: Trader paid, farmer delivered, but admin hasn't verified - inventory cannot be created

#### 1.4 Risk of Capital Loss
- **Risk**: If delivery failed but not verified, capital remains locked
- **Impact**: Trader loses access to capital, system loses efficiency
- **System Impact**: Capital tied up in failed transactions
- **Example**: Farmer never delivered, but admin hasn't verified - capital locked indefinitely

#### 1.5 Audit Trail Gaps
- **Risk**: Missing admin verification creates gaps in audit trail
- **Impact**: Cannot trace delivery outcomes, accountability unclear
- **System Impact**: Compliance and audit issues
- **Example**: Delivery happened 3 days ago, but no admin verification - audit trail incomplete

**Priority**: **CRITICAL** - Requires immediate admin action

---

### 2. Traders Near Spend Cap (>80% Exposure)

**Query**: `getTradersNearSpendCap`

**What It Detects**:
- Traders with total exposure >= 80% of UGX 1,000,000 cap
- Exposure includes: locked capital + locked orders value + inventory value

**Why This Is Highest Risk**:

#### 2.1 System Capacity Constraints
- **Risk**: Traders approaching system-imposed exposure limit
- **Impact**: Traders may be unable to make new purchases
- **System Impact**: Reduces system trading capacity, potential trader frustration
- **Example**: Trader has UGX 850,000 exposure, only UGX 150,000 remaining - may hit cap soon

#### 2.2 Trader Unable to Trade
- **Risk**: Trader hits cap and cannot make new purchases
- **Impact**: Trader is blocked from trading, loses business opportunities
- **System Impact**: Reduces active traders, reduces system liquidity
- **Example**: Trader at 95% exposure tries to purchase 10kg unit but is blocked - lost opportunity

#### 2.3 Risk of System Overload
- **Risk**: Multiple traders hitting cap simultaneously
- **Impact**: System capacity reduced, potential bottlenecks
- **System Impact**: System-wide trading slowdown
- **Example**: 10 traders at 90% exposure - system capacity at risk

#### 2.4 Capital Allocation Issues
- **Risk**: Traders may have capital locked in low-value positions
- **Impact**: Inefficient capital allocation, reduced trading efficiency
- **System Impact**: System-wide capital inefficiency
- **Example**: Trader has UGX 800,000 locked in slow-moving inventory - inefficient allocation

#### 2.5 Risk of Trader Churn
- **Risk**: Traders frustrated by capacity constraints may leave
- **Impact**: Loss of active traders, reduced system activity
- **System Impact**: System-wide activity reduction
- **Example**: Trader hits cap, cannot trade, decides to leave platform

**Priority**: **HIGH** - Requires monitoring and potential intervention

---

### 3. Inventory Accruing High Kilo-Shaving Loss

**Query**: `getHighStorageLossInventory`

**What It Detects**:
- Inventory in storage with projected kilo loss >= 10% of total kilos OR >= 5kg
- Loss calculated based on storage time and default storage fee rate (0.5 kg/day per 100kg block)

**Why This Is Highest Risk**:

#### 3.1 Trader Value Loss
- **Risk**: Trader's inventory value is being eroded by storage fees
- **Impact**: Trader loses money as inventory sits in storage
- **System Impact**: Trader profitability reduced, potential trader dissatisfaction
- **Example**: 100kg block loses 5kg (5%) after 10 days - trader loses value

#### 3.2 System Inefficiency
- **Risk**: Inventory not moving indicates market or operational issues
- **Impact**: System resources tied up in non-moving inventory
- **System Impact**: Reduced system efficiency, wasted capacity
- **Example**: 500kg of inventory sitting in storage for 20 days - system inefficiency

#### 3.3 Risk of Inventory Becoming Worthless
- **Risk**: High storage loss may make inventory unprofitable
- **Impact**: Trader may be unable to sell inventory profitably
- **System Impact**: Inventory may become unsellable, system losses
- **Example**: 100kg block loses 15kg (15%) after 30 days - may be unprofitable to sell

#### 3.4 Market or Operational Issues
- **Risk**: High storage loss may indicate market problems (low demand) or operational issues (buyer windows closed)
- **Impact**: System may need intervention (open buyer windows, adjust pricing)
- **System Impact**: System-wide market inefficiency
- **Example**: Multiple traders have high storage loss - indicates market problem

#### 3.5 Trader Financial Risk
- **Risk**: Traders may face financial losses from storage fees
- **Impact**: Trader profitability at risk, potential trader churn
- **System Impact**: Trader dissatisfaction, potential system reputation issues
- **Example**: Trader loses 10% of inventory value to storage fees - significant loss

**Priority**: **HIGH** - Requires monitoring and potential market intervention

---

### 4. Buyers Approaching Pickup SLA Expiry

**Query**: `getBuyersApproachingPickupSLA`

**What It Detects**:
- Purchases with status "pending_pickup"
- Pickup deadline approaching (within 12 hours) or already past (48 hours after purchase)

**Why This Is Highest Risk**:

#### 4.1 Inventory Stuck
- **Risk**: Inventory is sold but not picked up, blocking system resources
- **Impact**: Inventory cannot be used for other purposes, system capacity reduced
- **System Impact**: Inventory tied up in pending pickups, reduces available inventory
- **Example**: 200kg of inventory sold but not picked up for 2 days - stuck inventory

#### 4.2 Buyer Accountability Unclear
- **Risk**: Buyer may not pick up, but status is not yet resolved
- **Impact**: System cannot determine if pickup will happen or if purchase should expire
- **System Impact**: System waiting for resolution, cannot proceed
- **Example**: Buyer purchased 100kg 45 hours ago, deadline in 3 hours - accountability unclear

#### 4.3 System Cannot Proceed
- **Risk**: System is waiting for pickup or expiry, cannot proceed
- **Impact**: No automated resolution, requires admin intervention or time-based expiry
- **System Impact**: Blocks downstream operations (inventory release, expiry handling)
- **Example**: Buyer purchased but hasn't picked up - system waiting for resolution

#### 4.4 Risk of Inventory Loss
- **Risk**: If buyer doesn't pick up, inventory may expire or become unavailable
- **Impact**: Trader loses inventory, buyer loses purchase
- **System Impact**: System-wide inventory and transaction losses
- **Example**: Buyer purchased 100kg but never picked up - inventory lost

#### 4.5 Buyer Experience Issues
- **Risk**: Buyers may be frustrated by pickup deadlines or unclear status
- **Impact**: Buyer dissatisfaction, potential buyer churn
- **System Impact**: Reduced buyer activity, system reputation issues
- **Example**: Buyer purchased but missed pickup deadline - frustrated buyer

**Priority**: **HIGH** - Requires monitoring and potential intervention

---

## Why These Are the Highest-Risk Signals

### 1. System Blocking Issues

**All four categories can block system operations**:
- **Deliveries past SLA**: Blocks inventory creation, reversals
- **Traders near cap**: Blocks new purchases, reduces capacity
- **High storage loss**: Indicates system inefficiency, market issues
- **Buyers approaching pickup**: Blocks inventory release, reduces capacity

**Impact**: System-wide operational issues, reduced efficiency

---

### 2. Financial Risk

**All four categories involve financial risk**:
- **Deliveries past SLA**: Capital locked, potential losses
- **Traders near cap**: Capital allocation issues, potential losses
- **High storage loss**: Direct value loss, trader profitability at risk
- **Buyers approaching pickup**: Inventory stuck, potential losses

**Impact**: Financial losses for traders, buyers, and system

---

### 3. User Experience Risk

**All four categories affect user experience**:
- **Deliveries past SLA**: Trader frustration, farmer accountability unclear
- **Traders near cap**: Trader blocked from trading, frustration
- **High storage loss**: Trader value loss, dissatisfaction
- **Buyers approaching pickup**: Buyer frustration, unclear status

**Impact**: User dissatisfaction, potential churn

---

### 4. System Capacity Risk

**All four categories affect system capacity**:
- **Deliveries past SLA**: Capital locked, reduces available capacity
- **Traders near cap**: System capacity constraints, reduced trading
- **High storage loss**: Inventory tied up, reduces available inventory
- **Buyers approaching pickup**: Inventory stuck, reduces available inventory

**Impact**: System-wide capacity reduction, reduced efficiency

---

### 5. Audit and Compliance Risk

**All four categories create audit trail gaps**:
- **Deliveries past SLA**: Missing admin verification, incomplete audit trail
- **Traders near cap**: Capacity issues may indicate system problems
- **High storage loss**: May indicate operational or market issues
- **Buyers approaching pickup**: Unclear accountability, incomplete audit trail

**Impact**: Compliance issues, audit trail gaps

---

## Query Design for Quick Scanning

### 1. Sorted by Risk

**All queries sort results by highest risk first**:
- **Deliveries past SLA**: Most overdue first
- **Traders near cap**: Highest exposure first
- **High storage loss**: Highest loss percentage first
- **Buyers approaching pickup**: Overdue first, then closest to deadline

**Why**: Admin can quickly see most critical issues first

---

### 2. Limited Results

**All queries support limit parameter**:
- Default limit: 50 results
- Configurable per query
- `hasMore` flag indicates if more results exist

**Why**: Quick scanning without overwhelming admin with too many results

---

### 3. Clear Indicators

**All queries provide clear risk indicators**:
- **Deliveries past SLA**: `hoursOverdue`, `unitPrice` (locked capital)
- **Traders near cap**: `exposurePercent`, `remainingCapacity`
- **High storage loss**: `lossPercent`, `valueLost`, `daysInStorage`
- **Buyers approaching pickup**: `isPastDeadline`, `hoursRemaining`, `hoursOverdue`

**Why**: Admin can quickly assess risk level

---

### 4. Summary Totals

**All queries provide summary totals**:
- Total count
- Aggregated metrics (average, max, totals)
- Risk indicators

**Why**: Admin can quickly see overall system health

---

### 5. Summary Query

**`getRedFlagsSummary` provides quick overview**:
- Counts for all four categories
- Total red flags
- Timestamp

**Why**: Admin can quickly see overall system risk level

---

## Usage Examples

### Example 1: Daily Monitoring

```typescript
// Admin checks red flags summary
const summary = await getRedFlagsSummary({ adminId });

if (summary.total > 0) {
  // Investigate each category
  const deliveries = await getDeliveriesPastSLA({ adminId, limit: 10 });
  const traders = await getTradersNearSpendCap({ adminId, limit: 10 });
  const inventory = await getHighStorageLossInventory({ adminId, limit: 10 });
  const buyers = await getBuyersApproachingPickupSLA({ adminId, limit: 10 });
}
```

---

### Example 2: Critical Alert

```typescript
// Admin checks for critical issues
const deliveries = await getDeliveriesPastSLA({ adminId, limit: 5 });

if (deliveries.totals.maxHoursOverdue > 24) {
  // Critical: Deliveries overdue by more than 24 hours
  // Immediate action required
}
```

---

### Example 3: Capacity Monitoring

```typescript
// Admin monitors system capacity
const traders = await getTradersNearSpendCap({ adminId, threshold: 0.9 });

if (traders.totals.total > 5) {
  // Warning: Multiple traders near cap
  // May need to increase cap or optimize capital allocation
}
```

---

## Priority Matrix

| Category | Priority | Frequency | Action Required |
|----------|----------|-----------|-----------------|
| Deliveries Past SLA | **CRITICAL** | Daily | Immediate admin verification |
| Traders Near Cap | **HIGH** | Daily | Monitor, potential cap adjustment |
| High Storage Loss | **HIGH** | Daily | Monitor, potential market intervention |
| Buyers Approaching Pickup | **HIGH** | Daily | Monitor, potential buyer notification |

---

## Summary

### Red-Flag Categories ✅

1. **Deliveries Past SLA**: Capital locked, farmer accountability unclear, system blocked
2. **Traders Near Cap**: System capacity constraints, trader unable to trade
3. **High Storage Loss**: Trader value loss, system inefficiency, market issues
4. **Buyers Approaching Pickup**: Inventory stuck, buyer accountability unclear

### Why Highest Risk ✅

1. **System Blocking**: All categories can block system operations
2. **Financial Risk**: All categories involve financial risk
3. **User Experience**: All categories affect user experience
4. **System Capacity**: All categories affect system capacity
5. **Audit Trail**: All categories create audit trail gaps

### Query Design ✅

1. **Sorted by Risk**: Highest risk first
2. **Limited Results**: Quick scanning without overwhelm
3. **Clear Indicators**: Easy risk assessment
4. **Summary Totals**: Overall system health
5. **Summary Query**: Quick overview

---

*Implementation Date: Admin red-flag queries added*  
*Status: Read-only, admin-only, designed for quick scanning*
