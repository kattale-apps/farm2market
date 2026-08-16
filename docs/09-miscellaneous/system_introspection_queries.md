# System State Introspection Queries

## Overview

Admin-only read-only queries for comprehensive system auditing. These queries provide admins with complete visibility into system state without modifying any data.

---

## Queries

### 1. `getAllActiveUTIDs`

**Purpose**: View all active UTIDs and their current state across the entire system.

**Returns**:
- All UTIDs from all tables (wallet, listings, units, inventory, purchases, admin actions)
- Grouped by UTID with all associated entities
- Sorted by timestamp (most recent first)

**How It Helps Admins**:
- ✅ **Complete UTID audit**: See every UTID in the system
- ✅ **Transaction tracing**: Follow a UTID across multiple tables
- ✅ **Orphan detection**: Find UTIDs that reference missing entities
- ✅ **System health**: Identify unusual UTID patterns or missing references
- ✅ **Compliance**: Verify all transactions have proper UTID tracking

**Example Use Cases**:
- "Show me all UTIDs created today"
- "Find all entities related to UTID X"
- "Verify all wallet transactions have UTIDs"
- "Check for UTIDs without corresponding entities"

---

### 2. `getWalletLedgerByUTID`

**Purpose**: View wallet ledger entries grouped by UTID.

**Returns**:
- All wallet entries, optionally filtered by specific UTID
- Grouped by UTID showing complete transaction history
- User aliases (anonymity preserved)
- Timestamps and amounts

**How It Helps Admins**:
- ✅ **Financial audit**: Trace all wallet activity by UTID
- ✅ **Transaction verification**: Verify wallet entries match transactions
- ✅ **Balance reconciliation**: Check ledger entries for specific UTIDs
- ✅ **Anomaly detection**: Find unusual wallet patterns
- ✅ **Dispute resolution**: Review complete transaction history

**Example Use Cases**:
- "Show all wallet entries for UTID X"
- "Find all capital_lock entries and their UTIDs"
- "Verify wallet entries match unit locks"
- "Check for missing wallet entries for known UTIDs"

---

### 3. `getInventoryUnitsByStatus`

**Purpose**: View all inventory units grouped by status.

**Returns**:
- Units grouped by status: available, locked, delivered, cancelled
- Enriched with listing and user information (aliases only)
- Totals for each status
- Optionally filter by specific status

**How It Helps Admins**:
- ✅ **Inventory monitoring**: See distribution of unit statuses
- ✅ **Lock tracking**: Monitor which units are locked and by whom
- ✅ **Availability audit**: Verify available units match expectations
- ✅ **Status verification**: Check for units in unexpected states
- ✅ **Capacity planning**: Understand system utilization

**Example Use Cases**:
- "How many units are currently locked?"
- "Show all available units for a specific listing"
- "Find all units locked by trader X"
- "Check for units stuck in unexpected states"

---

### 4. `getDeliverySLAStatusSummary`

**Purpose**: View delivery SLA status for all locked units.

**Returns**:
- Units grouped by deliveryStatus: pending, delivered, late, cancelled
- Server-calculated time information (hours remaining, hours overdue)
- Sorted by deadline (earliest first)
- Totals for each status

**How It Helps Admins**:
- ✅ **SLA monitoring**: Track delivery compliance
- ✅ **Late delivery detection**: Identify units past deadline
- ✅ **Verification tracking**: See which deliveries are verified
- ✅ **Performance metrics**: Measure delivery success rates
- ✅ **Intervention planning**: Identify units needing admin action

**Example Use Cases**:
- "Show all units with late delivery status"
- "How many deliveries are pending verification?"
- "Which units are approaching their deadline?"
- "What's the average delivery time?"

---

### 5. `getBuyerPickupDeadlines`

**Purpose**: View buyer pickup deadlines and SLA status.

**Returns**:
- All buyer purchases with pickup SLA information
- Server-calculated time (hours remaining, hours overdue)
- Grouped by status: pending_pickup, picked_up, expired
- Enriched with buyer and trader aliases

**How It Helps Admins**:
- ✅ **Pickup monitoring**: Track buyer pickup compliance
- ✅ **Overdue detection**: Identify purchases past 48-hour deadline
- ✅ **Status tracking**: Monitor pickup completion rates
- ✅ **Performance metrics**: Measure pickup success rates
- ✅ **Intervention planning**: Identify purchases needing follow-up

**Example Use Cases**:
- "Show all purchases past pickup deadline"
- "How many buyers have pending pickups?"
- "Which purchases are approaching their deadline?"
- "What's the average pickup time?"

---

## How These Queries Help Admins Audit the System

### 1. Complete Transaction Visibility

**Problem**: Admins need to verify all transactions are properly tracked.

**Solution**: `getAllActiveUTIDs` provides complete UTID inventory.

**Audit Capabilities**:
- ✅ Verify every transaction has a UTID
- ✅ Trace UTID across multiple tables
- ✅ Identify missing or orphaned UTIDs
- ✅ Verify UTID chain integrity

**Example Audit**:
```
Admin: "Show me all UTIDs from today"
Query: getAllActiveUTIDs(adminId)
Result: Complete list of all UTIDs with their entities
Admin: Verifies each UTID has proper references
```

---

### 2. Financial Audit Trail

**Problem**: Admins need to verify wallet transactions match business logic.

**Solution**: `getWalletLedgerByUTID` groups all wallet entries by UTID.

**Audit Capabilities**:
- ✅ Verify wallet entries match unit locks
- ✅ Check for missing or duplicate entries
- ✅ Verify balance calculations
- ✅ Trace capital flow by UTID

**Example Audit**:
```
Admin: "Show wallet entries for lockUtid X"
Query: getWalletLedgerByUTID(adminId, "20240215-143022-tra-a3k9x2")
Result: All wallet entries for that UTID
Admin: Verifies capital_lock entry exists and matches unit lock
```

---

### 3. Inventory State Verification

**Problem**: Admins need to verify inventory is in expected states.

**Solution**: `getInventoryUnitsByStatus` shows all units grouped by status.

**Audit Capabilities**:
- ✅ Verify unit status distribution
- ✅ Check for units in unexpected states
- ✅ Monitor lock/unlock patterns
- ✅ Verify status transitions are valid

**Example Audit**:
```
Admin: "Show all locked units"
Query: getInventoryUnitsByStatus(adminId, "locked")
Result: All locked units with trader and farmer aliases
Admin: Verifies each locked unit has corresponding wallet entry
```

---

### 4. SLA Compliance Monitoring

**Problem**: Admins need to monitor delivery and pickup SLAs.

**Solution**: `getDeliverySLAStatusSummary` and `getBuyerPickupDeadlines` track SLAs.

**Audit Capabilities**:
- ✅ Monitor delivery compliance (6-hour SLA)
- ✅ Monitor pickup compliance (48-hour SLA)
- ✅ Identify overdue transactions
- ✅ Track verification status

**Example Audit**:
```
Admin: "Show all late deliveries"
Query: getDeliverySLAStatusSummary(adminId)
Result: Units grouped by deliveryStatus, with time calculations
Admin: Reviews late deliveries and takes action
```

---

### 5. Anomaly Detection

**Problem**: Admins need to identify unusual patterns or errors.

**Solution**: All queries provide comprehensive views for pattern analysis.

**Audit Capabilities**:
- ✅ Find UTIDs without corresponding entities
- ✅ Identify transactions in unexpected states
- ✅ Detect missing wallet entries
- ✅ Find units stuck in intermediate states

**Example Audit**:
```
Admin: "Find all UTIDs with wallet entries but no unit locks"
Query: getAllActiveUTIDs(adminId)
Result: Complete UTID map
Admin: Compares wallet UTIDs with unit lockUtids, finds discrepancies
```

---

### 6. Dispute Resolution

**Problem**: Admins need complete transaction history for disputes.

**Solution**: Queries provide full transaction context.

**Audit Capabilities**:
- ✅ Trace complete transaction lifecycle
- ✅ View all related entities by UTID
- ✅ Verify transaction state at any point
- ✅ Review admin actions related to transaction

**Example Audit**:
```
Dispute: "Trader claims unit was never delivered"
Admin: 
  1. getAllActiveUTIDs(adminId) → Find lockUtid
  2. getWalletLedgerByUTID(adminId, lockUtid) → Verify payment
  3. getDeliverySLAStatusSummary(adminId) → Check delivery status
  4. Review admin actions for that UTID
Result: Complete transaction history for dispute resolution
```

---

### 7. System Health Monitoring

**Problem**: Admins need to monitor overall system health.

**Solution**: Queries provide aggregated views of system state.

**Audit Capabilities**:
- ✅ Monitor transaction volumes
- ✅ Track status distributions
- ✅ Identify bottlenecks
- ✅ Measure system performance

**Example Audit**:
```
Admin: "What's the current system state?"
Queries:
  - getInventoryUnitsByStatus(adminId) → Unit distribution
  - getDeliverySLAStatusSummary(adminId) → Delivery status
  - getBuyerPickupDeadlines(adminId) → Pickup status
Result: Complete system health snapshot
```

---

## Key Benefits

### 1. Read-Only Safety

**All queries are read-only**:
- ✅ No mutations - cannot modify system state
- ✅ Safe for exploration and auditing
- ✅ No risk of accidental changes
- ✅ Can be called repeatedly without side effects

### 2. Admin-Only Access

**All queries verify admin role**:
- ✅ Server-side role verification
- ✅ Prevents unauthorized access
- ✅ Maintains audit trail (admin actions logged separately)
- ✅ Protects sensitive system information

### 3. Comprehensive Coverage

**Queries cover all system aspects**:
- ✅ UTIDs across all tables
- ✅ Financial transactions
- ✅ Inventory state
- ✅ Delivery SLAs
- ✅ Pickup SLAs

### 4. Server-Side Time Calculations

**All time calculations done server-side**:
- ✅ No client-side time manipulation
- ✅ Accurate deadline calculations
- ✅ Consistent time across all queries
- ✅ Prevents timezone issues

### 5. Anonymity Preserved

**User identities protected**:
- ✅ Only aliases returned (never real names/emails)
- ✅ Anonymity rules enforced
- ✅ Admin can audit without exposing identities
- ✅ Compliance with anonymity requirements

---

## Example Audit Workflow

### Scenario: Verify a specific transaction

1. **Get UTID overview**
   ```typescript
   getAllActiveUTIDs(adminId)
   // Find the UTID in question
   ```

2. **Check wallet entries**
   ```typescript
   getWalletLedgerByUTID(adminId, "20240215-143022-tra-a3k9x2")
   // Verify wallet entry exists and is correct
   ```

3. **Check unit status**
   ```typescript
   getInventoryUnitsByStatus(adminId, "locked")
   // Find unit with matching lockUtid
   ```

4. **Check delivery status**
   ```typescript
   getDeliverySLAStatusSummary(adminId)
   // Verify delivery status and deadline
   ```

5. **Review admin actions**
   ```typescript
   getAllActiveUTIDs(adminId)
   // Find admin action UTIDs related to transaction
   ```

**Result**: Complete transaction audit trail

---

## Summary

### Queries Provided ✅

1. **`getAllActiveUTIDs`**: Complete UTID inventory
2. **`getWalletLedgerByUTID`**: Financial transaction audit
3. **`getInventoryUnitsByStatus`**: Inventory state monitoring
4. **`getDeliverySLAStatusSummary`**: Delivery SLA tracking
5. **`getBuyerPickupDeadlines`**: Pickup SLA tracking

### Audit Capabilities ✅

1. **Transaction visibility**: Complete UTID tracking
2. **Financial audit**: Wallet transaction verification
3. **State verification**: Inventory status monitoring
4. **SLA compliance**: Delivery and pickup tracking
5. **Anomaly detection**: Pattern analysis
6. **Dispute resolution**: Complete transaction history
7. **System health**: Overall system monitoring

### Safety Features ✅

1. **Read-only**: No mutations, safe for exploration
2. **Admin-only**: Server-side role verification
3. **Anonymity**: Only aliases returned
4. **Server-side time**: Accurate calculations
5. **Comprehensive**: Covers all system aspects

---

*Implementation Date: System introspection queries added*  
*Status: Read-only admin queries - no business logic changes*
