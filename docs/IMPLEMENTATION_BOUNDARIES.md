# IMPLEMENTATION_BOUNDARIES.md

**Production System Implementation Boundaries**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- DOMAIN_MODEL.md defines entities and ownership
- INVARIANTS.md defines what must never be violated
- MODULARITY_GUIDE.md defines forbidden couplings
- PRODUCTION_AUTHORIZATION.md defines what may run
- PRODUCTION_OPERATION.md defines how it is operated
- INCIDENT_AND_EMERGENCY_RESPONSE.md defines emergency behavior

**Purpose**: This document translates governance into **coding constraints**. This is NOT a feature specification or implementation guide. This defines boundaries, not implementations.

---

## 1. What Code Is Allowed To Exist Right Now

### Allowed Code Categories

**Category 1: ALLOWED Capabilities (GO_LIVE_READINESS.md)**
- Code implementing ALLOWED capabilities may exist
- Code must comply with all invariants
- Code must include required guards (see Section 3)
- Code must include required audit hooks (see Section 4)

**Allowed Capabilities** (from GO_LIVE_READINESS.md):
1. Farmer Listing Creation
2. Trader Capital Deposit
3. Trader Unit Lock (Pay-to-Lock)
4. Transaction Reversal (Admin)
5. Profit Withdrawal from Ledger
6. Purchase Window Control (Admin)
7. Pilot Mode Control (Admin)
8. User Role Changes (Admin)
9. User Account Suspension/Deletion (Admin)
10. Audit Logging (Core Entities)
11. Basic Observability (Core Metrics)

**Code Constraints**:
- Code must verify authorization server-side
- Code must enforce invariants
- Code must log audit events
- Code must respect kill-switches

**BLOCKED Notes**: None (these capabilities are ALLOWED)

---

### Allowed Entity Operations

**Allowed Operations** (from DOMAIN_MODEL.md):
- User: Create, read, update (role changes by admin only), delete (by admin only)
- Listing: Create, read, update (status transitions), cancel
- ListingUnit: Create, read, update (status transitions), cancel
- WalletLedger: Create (immutable), read (no updates, no deletes)
- TraderInventory: Create, read, update (status transitions), expire
- PurchaseWindow: Read, update (open/close by admin only)
- AdminAction: Create (immutable), read (no updates, no deletes)
- SystemSettings: Read, update (pilot mode by admin only)
- Notification: Create, read, update (read status)
- RateLimitHit: Create (immutable), read (no updates, no deletes)

**Code Constraints**:
- Entity operations must respect ownership (from DOMAIN_MODEL.md)
- Entity operations must respect state transitions (from DOMAIN_MODEL.md)
- Entity operations must be auditable (from AUDIT_MODEL.md)

**BLOCKED Notes**: BuyerPurchase entity operations are BLOCKED (purchase function NOT IMPLEMENTED). StorageFeeDeduction entity operations are BLOCKED (automation status UNKNOWN).

---

### Allowed Module Boundaries

**Allowed Modules** (from MODULARITY_GUIDE.md):
- Authorization module
- User Management module
- Listing module
- Transaction module
- Wallet module
- Inventory module
- Purchase module (read-only, purchase function BLOCKED)
- Notification module
- Rate Limiting module
- System Settings module
- Dashboard module
- Utilities module
- Error Handling module
- Introspection module

**Code Constraints**:
- Modules must respect forbidden couplings (from MODULARITY_GUIDE.md)
- Modules must respect independent change boundaries (from MODULARITY_GUIDE.md)
- Modules must respect trust boundaries (from architecture.md)

**BLOCKED Notes**: Storage Fee Automation module is BLOCKED (automation status UNKNOWN). Buyer Purchase module is BLOCKED (purchase function NOT IMPLEMENTED).

---

## 2. What Code Is Explicitly Forbidden

### Forbidden Code Categories

**Category 1: BLOCKED Capabilities (GO_LIVE_READINESS.md)**
- Code implementing BLOCKED capabilities is FORBIDDEN
- Code must NOT implement BLOCKED capabilities
- Code must NOT partially implement BLOCKED capabilities
- Code must NOT enable BLOCKED capabilities

**Forbidden Capabilities** (from GO_LIVE_READINESS.md):
1. Production Authentication (BLOCKED 1)
2. Buyer Purchase Function (BLOCKED 2)
3. Delivery Verification Function (BLOCKED 3)
4. Storage Fee Automation (BLOCKED 4)
5. Pilot Mode Enforcement (BLOCKED 5 - status UNKNOWN)
6. Legal Compliance (BLOCKED 6)
7. Terms of Service and User Agreements (BLOCKED 7)
8. Backup and Restore Procedures (BLOCKED 8)
9. Health Check Endpoints (BLOCKED 9)
10. Profit Withdrawal External Transfer (BLOCKED 10)

**Code Constraints**:
- Code must NOT implement these capabilities
- Code must NOT enable these capabilities
- Code must NOT assume these capabilities exist
- Code must represent BLOCKED capabilities explicitly (see Section 6)

**BLOCKED Notes**: These capabilities are explicitly FORBIDDEN until unblocked.

---

### Forbidden Entity Operations

**Forbidden Operations** (from DOMAIN_MODEL.md and INVARIANTS.md):
- WalletLedger: Update, delete (FORBIDDEN - immutable)
- AdminAction: Update, delete (FORBIDDEN - immutable)
- RateLimitHit: Update, delete (FORBIDDEN - immutable)
- StorageFeeDeduction: Create (FORBIDDEN - automation BLOCKED)
- BuyerPurchase: Create (FORBIDDEN - purchase function BLOCKED)
- User: Self-role change (FORBIDDEN - INVARIANT 3.1)
- Any entity: UTID modification (FORBIDDEN - INVARIANT 4.1)
- WalletLedger: Balance overwrite (FORBIDDEN - INVARIANT 1.3)

**Code Constraints**:
- Code must NOT allow these operations
- Code must NOT bypass these restrictions
- Code must enforce these restrictions server-side

**BLOCKED Notes**: None (these operations are explicitly FORBIDDEN)

---

### Forbidden Couplings

**Forbidden Couplings** (from MODULARITY_GUIDE.md):
- **MUST NOT** tightly couple Listing module to Transaction module (listing creation must not depend on transaction logic)
- **MUST NOT** tightly couple Wallet module to Inventory module (wallet operations must not depend on inventory logic)
- **MUST NOT** tightly couple Purchase module to Transaction module (purchase operations must not depend on transaction logic)
- **MUST NOT** tightly couple Notification module to external providers (SMS, email) - v1.x is internal only
- **MUST NOT** tightly couple Storage Fee Automation module to external scheduling systems (must be self-contained)
- **MUST NOT** tightly couple Dashboard module to business logic modules (dashboard is read-only)
- **MUST NOT** tightly couple Utilities module to specific business logic modules (utilities are cross-cutting)
- **MUST NOT** tightly couple Error Handling module to specific business logic modules (error handling is cross-cutting)

**Code Constraints**:
- Code must NOT create these couplings
- Code must NOT bypass module boundaries
- Code must respect module independence

**BLOCKED Notes**: None (these couplings are explicitly FORBIDDEN)

---

### Forbidden Authorization Patterns

**Forbidden Patterns** (from INVARIANTS.md):
- **MUST NOT** perform authorization checks client-side (FORBIDDEN - INVARIANT 2.1)
- **MUST NOT** allow frontend to bypass backend authorization (FORBIDDEN - INVARIANT 2.3)
- **MUST NOT** allow users to change their own role (FORBIDDEN - INVARIANT 3.1)
- **MUST NOT** infer roles from email prefix in production (FORBIDDEN - BLOCKED FOR PRODUCTION)
- **MUST NOT** allow admin actions without role verification (FORBIDDEN - INVARIANT 2.2)

**Code Constraints**:
- Code must NOT implement these patterns
- Code must NOT bypass authorization checks
- Code must enforce authorization server-side

**BLOCKED Notes**: Role inference from email prefix is BLOCKED FOR PRODUCTION (production authentication NOT IMPLEMENTED).

---

## 3. Required Guards That Must Exist in Code

### Invariant Guards

**Guard 1: Wallet Ledger Balance Consistency (INVARIANT 1.1)**
- **Required Guard**: Code must verify balance consistency before wallet operations
- **Guard Location**: Server-side (Convex backend)
- **Guard Action**: Block wallet operations if balance inconsistency detected
- **Guard Response**: Log violation, notify operator, block operations

**Guard 2: Wallet Ledger Entry Immutability (INVARIANT 1.2)**
- **Required Guard**: Code must prevent WalletLedger entry updates/deletes
- **Guard Location**: Database constraints (Convex schema)
- **Guard Action**: Reject update/delete operations
- **Guard Response**: Log violation, notify operator, block operations

**Guard 3: No Balance Overwrites (INVARIANT 1.3)**
- **Required Guard**: Code must prevent direct balance field updates
- **Guard Location**: Server-side (Convex backend)
- **Guard Action**: Reject balance overwrite operations
- **Guard Response**: Log violation, notify operator, block operations

**Guard 4: Server-Side Authorization Enforcement (INVARIANT 2.1)**
- **Required Guard**: Code must verify authorization server-side for all mutations
- **Guard Location**: Server-side (Convex backend, before mutation execution)
- **Guard Action**: Reject mutations without server-side authorization
- **Guard Response**: Log violation, notify operator, block mutations

**Guard 5: Admin Role Verification (INVARIANT 2.2)**
- **Required Guard**: Code must verify admin role server-side for admin actions
- **Guard Location**: Server-side (Convex backend, before admin action execution)
- **Guard Action**: Reject admin actions without role verification
- **Guard Response**: Log violation, notify operator, block admin actions

**Guard 6: Frontend Cannot Bypass Authorization (INVARIANT 2.3)**
- **Required Guard**: Code must prevent frontend from bypassing backend authorization
- **Guard Location**: Server-side (Convex backend, all mutations)
- **Guard Action**: Reject mutations that bypass authorization
- **Guard Response**: Log violation, notify operator, block mutations

**Guard 7: Users Cannot Change Their Own Role (INVARIANT 3.1)**
- **Required Guard**: Code must prevent users from changing their own role
- **Guard Location**: Server-side (Convex backend, before role change)
- **Guard Action**: Reject self-role changes
- **Guard Response**: Log violation, notify operator, block role changes

**Guard 8: UTID Immutability (INVARIANT 4.1)**
- **Required Guard**: Code must prevent UTID modifications
- **Guard Location**: Database constraints (Convex schema)
- **Guard Action**: Reject UTID update operations
- **Guard Response**: Log violation, notify operator, block operations

**Guard 9: All Meaningful Actions Generate UTIDs (INVARIANT 4.2)**
- **Required Guard**: Code must generate UTIDs for all meaningful actions
- **Guard Location**: Server-side (Convex backend, before action execution)
- **Guard Action**: Generate UTID if missing
- **Guard Response**: Log violation, notify operator, block actions without UTID

**Guard 10: Exposure Limit Enforcement (INVARIANT 6.1)**
- **Required Guard**: Code must enforce exposure limits (UGX 1,000,000 maximum)
- **Guard Location**: Server-side (Convex backend, before unit lock)
- **Guard Action**: Reject unit locks that exceed exposure limit
- **Guard Response**: Log violation, notify operator, block unit locks

**Guard 11: Exposure Calculation Atomicity (INVARIANT 6.2)**
- **Required Guard**: Code must calculate exposure atomically with unit lock
- **Guard Location**: Server-side (Convex backend, atomic transaction)
- **Guard Action**: Reject non-atomic exposure calculations
- **Guard Response**: Log violation, notify operator, block unit locks

**Guard 12: Pilot Mode Enforcement (INVARIANT 7.1)**
- **Required Guard**: Code must block money-moving mutations when pilot mode is enabled
- **Guard Location**: Server-side (Convex backend, before money-moving mutations)
- **Guard Action**: Reject money-moving mutations when pilot mode is enabled
- **Guard Response**: Log violation, notify operator, block mutations

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (BLOCKED). Guard may not exist. Code must represent this explicitly (see Section 6).

**Guard 13: Purchase Window Enforcement (INVARIANT 7.2)**
- **Required Guard**: Code must block buyer purchases when purchase window is closed
- **Guard Location**: Server-side (Convex backend, before buyer purchase)
- **Guard Action**: Reject buyer purchases when purchase window is closed
- **Guard Response**: Log violation, notify operator, block purchases

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (BLOCKED). Guard cannot be tested until purchase function is implemented.

---

### Kill-Switch Guards

**Guard 14: Pilot Mode Kill-Switch Guard**
- **Required Guard**: Code must check pilot mode status before money-moving mutations
- **Guard Location**: Server-side (Convex backend, before money-moving mutations)
- **Guard Action**: Block mutations if pilot mode is enabled
- **Guard Response**: Reject mutation, log kill-switch activation

**BLOCKED Notes**: Pilot mode enforcement status is UNKNOWN (BLOCKED). Guard may not exist.

**Guard 15: Purchase Window Kill-Switch Guard**
- **Required Guard**: Code must check purchase window status before buyer purchases
- **Guard Location**: Server-side (Convex backend, before buyer purchase)
- **Guard Action**: Block purchases if purchase window is closed
- **Guard Response**: Reject purchase, log kill-switch activation

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (BLOCKED). Guard cannot be tested until purchase function is implemented.

---

## 4. Required Audit Hooks (No Implementation, Just Contracts)

### Audit Hook Contracts

**Hook 1: Wallet Ledger Entry Creation**
- **Contract**: `auditWalletLedgerEntry(entry: WalletLedgerEntry): void`
- **Required Fields**: utid, type, amount, balanceAfter, timestamp, traderId
- **Immutability**: Entry must be immutable after creation
- **Location**: Server-side (Convex backend, after ledger entry creation)

**Hook 2: Admin Action Logging**
- **Contract**: `auditAdminAction(action: AdminAction): void`
- **Required Fields**: adminId, actionType, utid, reason, targetUtid (if applicable), timestamp
- **Immutability**: Entry must be immutable after creation
- **Location**: Server-side (Convex backend, after admin action)

**Hook 3: Rate Limit Violation Logging**
- **Contract**: `auditRateLimitHit(hit: RateLimitHit): void`
- **Required Fields**: userId, endpoint, timestamp, reason
- **Immutability**: Entry must be immutable after creation
- **Location**: Server-side (Convex backend, after rate limit violation)

**Hook 4: User Entity State Change**
- **Contract**: `auditUserStateChange(userId: string, oldState: UserState, newState: UserState, utid: string): void`
- **Required Fields**: userId, oldState, newState, utid, timestamp, actorId
- **Immutability**: Previous state must be immutable
- **Location**: Server-side (Convex backend, after user state change)

**Hook 5: Listing Entity State Change**
- **Contract**: `auditListingStateChange(listingId: string, oldState: ListingState, newState: ListingState, utid: string): void`
- **Required Fields**: listingId, oldState, newState, utid, timestamp, actorId
- **Immutability**: Previous state must be immutable
- **Location**: Server-side (Convex backend, after listing state change)

**Hook 6: ListingUnit Entity State Change**
- **Contract**: `auditListingUnitStateChange(unitId: string, oldState: ListingUnitState, newState: ListingUnitState, utid: string): void`
- **Required Fields**: unitId, oldState, newState, utid, timestamp, actorId
- **Immutability**: Previous state must be immutable
- **Location**: Server-side (Convex backend, after listing unit state change)

**Hook 7: TraderInventory Entity State Change**
- **Contract**: `auditTraderInventoryStateChange(inventoryId: string, oldState: TraderInventoryState, newState: TraderInventoryState, utid: string): void`
- **Required Fields**: inventoryId, oldState, newState, utid, timestamp, actorId
- **Immutability**: Previous state must be immutable
- **Location**: Server-side (Convex backend, after trader inventory state change)

**Hook 8: PurchaseWindow State Change**
- **Contract**: `auditPurchaseWindowStateChange(oldState: boolean, newState: boolean, utid: string, adminId: string): void`
- **Required Fields**: oldState, newState, utid, adminId, timestamp, reason
- **Immutability**: Previous state must be immutable
- **Location**: Server-side (Convex backend, after purchase window state change)

**Hook 9: SystemSettings State Change**
- **Contract**: `auditSystemSettingsStateChange(setting: string, oldValue: any, newValue: any, utid: string, adminId: string): void`
- **Required Fields**: setting, oldValue, newValue, utid, adminId, timestamp, reason
- **Immutability**: Previous state must be immutable
- **Location**: Server-side (Convex backend, after system settings state change)

**Hook 10: Invariant Violation Logging**
- **Contract**: `auditInvariantViolation(invariant: string, violation: InvariantViolation): void`
- **Required Fields**: invariant, violation, timestamp, context
- **Immutability**: Entry must be immutable after creation
- **Location**: Server-side (Convex backend, after invariant violation detection)

**BLOCKED Notes**: Some audit hooks depend on BLOCKED capabilities (delivery verification, storage fee automation). Hooks must be defined but may not be callable until capabilities are unblocked.

---

## 5. Kill-Switch Enforcement Expectations

### Pilot Mode Enforcement

**Expected Behavior**:
- When `systemSettings.pilotMode === true`, all money-moving mutations must be blocked
- Money-moving mutations include: capital deposits, capital locks, profit withdrawals, unit locks
- Enforcement must be server-side (frontend cannot bypass)
- Enforcement must be checked before mutation execution

**Code Requirements**:
- Code must check pilot mode status before money-moving mutations
- Code must reject mutations if pilot mode is enabled
- Code must log kill-switch activation
- Code must not allow frontend to bypass enforcement

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (BLOCKED). Code must represent this explicitly (see Section 6).

---

### Purchase Window Enforcement

**Expected Behavior**:
- When `purchaseWindows.isOpen === false`, all buyer purchase mutations must be blocked
- Enforcement must be server-side (frontend cannot bypass)
- Enforcement must be checked before purchase execution

**Code Requirements**:
- Code must check purchase window status before buyer purchases
- Code must reject purchases if purchase window is closed
- Code must log kill-switch activation
- Code must not allow frontend to bypass enforcement

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (BLOCKED). Enforcement cannot be tested until purchase function is implemented.

---

### System Shutdown Enforcement

**Expected Behavior**:
- System operator can shutdown system (infrastructure-level)
- Shutdown stops all operations
- Shutdown is reversible (system operator can restart)

**Code Requirements**:
- Code must not prevent infrastructure-level shutdown
- Code must not require code changes for shutdown
- Code must preserve data during shutdown
- Code must allow restart after shutdown

**BLOCKED Notes**: System shutdown auditability is UNKNOWN (BLOCKED). Shutdown may not be auditable.

---

## 6. How BLOCKED Capabilities Must Be Represented in Code

### BLOCKED Capability Representation

**Representation Rule**: BLOCKED capabilities must be explicitly represented in code, not silently absent.

**Representation Methods**:
1. **Explicit BLOCKED Markers**: Code must include explicit markers (comments, constants, types) indicating BLOCKED status
2. **Explicit Error Responses**: Code must return explicit errors for BLOCKED capabilities (not silent failures)
3. **Explicit Status Checks**: Code must check BLOCKED status before attempting to use BLOCKED capabilities
4. **Explicit Documentation**: Code must document BLOCKED status in code comments

---

### BLOCKED Capability Examples

**Example 1: Production Authentication (BLOCKED 1)**
```typescript
// BLOCKED: Production authentication is NOT IMPLEMENTED (GO_LIVE_READINESS.md BLOCKED 1)
// Current implementation: Pilot mode uses shared password (NOT FOR PRODUCTION)
// Production authentication must be implemented before production go-live
// DO NOT USE: This code is BLOCKED FOR PRODUCTION
function authenticateUser(email: string, password: string): User | null {
  // BLOCKED: Production authentication not implemented
  // TEMPORARY: Pilot mode shared password
  if (password === "Farm2Market2024") {
    // BLOCKED FOR PRODUCTION: Role inference from email prefix
    const role = inferRoleFromEmail(email); // BLOCKED FOR PRODUCTION
    return createUser(email, role);
  }
  return null;
}
```

**Example 2: Buyer Purchase Function (BLOCKED 2)**
```typescript
// BLOCKED: Buyer purchase function is NOT IMPLEMENTED (GO_LIVE_READINESS.md BLOCKED 2)
// Purchase window check exists but purchase function does not
// DO NOT IMPLEMENT: This function is BLOCKED
function purchaseInventory(buyerId: string, inventoryId: string): BuyerPurchase | null {
  // BLOCKED: Buyer purchase function NOT IMPLEMENTED
  throw new Error("BLOCKED: Buyer purchase function is NOT IMPLEMENTED. See GO_LIVE_READINESS.md BLOCKED 2");
}
```

**Example 3: Delivery Verification Function (BLOCKED 3)**
```typescript
// BLOCKED: Delivery verification function implementation status is UNKNOWN (GO_LIVE_READINESS.md BLOCKED 3)
// Function may not be implemented or may be partially implemented
// DO NOT USE: This function status is UNKNOWN
function verifyDelivery(unitId: string, status: DeliveryStatus, adminId: string): void {
  // BLOCKED: Delivery verification function status is UNKNOWN
  // Status must be verified before use
  throw new Error("BLOCKED: Delivery verification function status is UNKNOWN. See GO_LIVE_READINESS.md BLOCKED 3");
}
```

**Example 4: Pilot Mode Enforcement (BLOCKED 5)**
```typescript
// BLOCKED: Pilot mode enforcement implementation status is UNKNOWN (GO_LIVE_READINESS.md BLOCKED 5)
// Enforcement may not be implemented
// DO NOT ASSUME: Enforcement exists
function checkPilotMode(): boolean {
  // BLOCKED: Pilot mode enforcement status is UNKNOWN
  // Enforcement must be verified before production
  const pilotMode = getSystemSettings().pilotMode;
  // WARNING: Enforcement may not be implemented
  // Code must verify enforcement exists before relying on it
  return pilotMode;
}
```

---

### BLOCKED Capability Code Requirements

**Requirements**:
- Code must include explicit BLOCKED markers
- Code must return explicit errors for BLOCKED capabilities
- Code must not silently fail for BLOCKED capabilities
- Code must document BLOCKED status in code comments
- Code must reference GO_LIVE_READINESS.md BLOCKED items

**BLOCKED Notes**: BLOCKED capabilities must be explicitly represented, not silently absent.

---

## 7. How Authorization and Activation Must Be Reflected in Code

### Authorization Reflection

**Reflection Rule**: Code must reflect authorization status, not assume authorization exists.

**Reflection Methods**:
1. **Authorization Status Checks**: Code must check authorization status before executing authorized operations
2. **Authorization Errors**: Code must return explicit errors if authorization is missing
3. **Authorization Documentation**: Code must document authorization requirements
4. **Authorization Guards**: Code must include authorization guards (see Section 3)

**Code Requirements**:
- Code must not assume authorization exists
- Code must check authorization status before operations
- Code must return explicit errors if authorization is missing
- Code must document authorization requirements

**BLOCKED Notes**: Current authorization status is NOT AUTHORIZED (see PRODUCTION_AUTHORIZATION.md). Code must reflect this status.

---

### Activation Reflection

**Reflection Rule**: Code must reflect activation status, not assume activation exists.

**Reflection Methods**:
1. **Activation Status Checks**: Code must check activation status before executing activated operations
2. **Activation Errors**: Code must return explicit errors if activation is missing
3. **Activation Documentation**: Code must document activation requirements
4. **Activation Guards**: Code must include activation guards

**Code Requirements**:
- Code must not assume activation exists
- Code must check activation status before operations
- Code must return explicit errors if activation is missing
- Code must document activation requirements

**BLOCKED Notes**: Current activation status is NOT ACTIVATED (see PRODUCTION_ACTIVATION.md). Code must reflect this status.

---

### Authorization and Activation Code Examples

**Example 1: Authorization Check**
```typescript
// Authorization status: NOT AUTHORIZED (see PRODUCTION_AUTHORIZATION.md)
// Code must check authorization before executing operations
function executeAuthorizedOperation(operation: string): void {
  // Check authorization status
  const authorizationStatus = getAuthorizationStatus();
  if (authorizationStatus !== "AUTHORIZED" && authorizationStatus !== "CONDITIONALLY_AUTHORIZED") {
    throw new Error("BLOCKED: Operation not authorized. See PRODUCTION_AUTHORIZATION.md");
  }
  // Execute operation only if authorized
  // ...
}
```

**Example 2: Activation Check**
```typescript
// Activation status: NOT ACTIVATED (see PRODUCTION_ACTIVATION.md)
// Code must check activation before executing operations
function executeActivatedOperation(operation: string): void {
  // Check activation status
  const activationStatus = getActivationStatus();
  if (activationStatus !== "ACTIVATED") {
    throw new Error("BLOCKED: Operation not activated. See PRODUCTION_ACTIVATION.md");
  }
  // Execute operation only if activated
  // ...
}
```

---

## 8. What Refactors Require Re-Authorization

### Re-Authorization Triggers

**Trigger 1: Forbidden Coupling Introduction**
- **Trigger**: Code introduces forbidden coupling (from MODULARITY_GUIDE.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: Forbidden couplings violate modularity boundaries

**Trigger 2: Invariant Guard Removal**
- **Trigger**: Code removes or modifies invariant guards (from INVARIANTS.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: Invariant guards are non-negotiable

**Trigger 3: Audit Hook Removal**
- **Trigger**: Code removes or modifies audit hooks (from AUDIT_MODEL.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: Audit hooks are required for forensic guarantees

**Trigger 4: Kill-Switch Modification**
- **Trigger**: Code modifies kill-switch enforcement (from architecture.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: Kill-switches are critical safety mechanisms

**Trigger 5: Authorization Boundary Change**
- **Trigger**: Code changes authorization boundaries (from INVARIANTS.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: Authorization boundaries are non-negotiable

**Trigger 6: Entity Ownership Change**
- **Trigger**: Code changes entity ownership (from DOMAIN_MODEL.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: Entity ownership defines trust boundaries

**Trigger 7: State Transition Change**
- **Trigger**: Code changes state transitions (from DOMAIN_MODEL.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: State transitions define system behavior

**Trigger 8: BLOCKED Capability Implementation**
- **Trigger**: Code implements BLOCKED capability (from GO_LIVE_READINESS.md)
- **Requirement**: Re-authorization required before deployment
- **Reason**: BLOCKED capabilities require explicit unblocking

**Code Requirements**:
- Code must document re-authorization triggers
- Code must not introduce re-authorization triggers without explicit approval
- Code must reference governance documents when introducing triggers

**BLOCKED Notes**: None (re-authorization triggers are explicit)

---

## 9. What Tests Are Mandatory Before Any Activation

### Mandatory Test Categories

**Category 1: Invariant Violation Tests**
- **Requirement**: Tests must verify all invariants are not violated
- **Coverage**: All 25 invariants from INVARIANTS.md
- **Location**: Server-side tests (Convex backend)
- **Failure Criteria**: Any invariant violation must fail tests

**Category 2: Authorization Enforcement Tests**
- **Requirement**: Tests must verify authorization is enforced server-side
- **Coverage**: All authorization boundaries from INVARIANTS.md
- **Location**: Server-side tests (Convex backend)
- **Failure Criteria**: Any authorization bypass must fail tests

**Category 3: Kill-Switch Tests**
- **Requirement**: Tests must verify kill-switches work correctly
- **Coverage**: All kill-switches from architecture.md
- **Location**: Server-side tests (Convex backend)
- **Failure Criteria**: Any kill-switch failure must fail tests

**BLOCKED Notes**: Pilot mode enforcement tests may not be possible (enforcement status UNKNOWN). Buyer purchase tests may not be possible (purchase function NOT IMPLEMENTED).

---

### Mandatory Test Examples

**Example 1: Invariant Violation Test**
```typescript
// MANDATORY: Test must verify INVARIANT 1.1 (Wallet Ledger Balance Consistency)
test("INVARIANT 1.1: Wallet ledger balance consistency", () => {
  // Test that balance calculation matches stored balance
  // Test that balance inconsistencies are detected
  // Test that violations block operations
  // Test must fail if invariant is violated
});
```

**Example 2: Authorization Enforcement Test**
```typescript
// MANDATORY: Test must verify INVARIANT 2.1 (Server-Side Authorization Enforcement)
test("INVARIANT 2.1: Server-side authorization enforcement", () => {
  // Test that mutations require server-side authorization
  // Test that frontend cannot bypass authorization
  // Test that unauthorized mutations are rejected
  // Test must fail if authorization is bypassed
});
```

**Example 3: Kill-Switch Test**
```typescript
// MANDATORY: Test must verify INVARIANT 7.1 (Pilot Mode Enforcement)
test("INVARIANT 7.1: Pilot mode enforcement", () => {
  // Test that pilot mode blocks money-moving mutations
  // Test that enforcement is server-side
  // Test that frontend cannot bypass enforcement
  // Test must fail if enforcement does not work
  // BLOCKED: Enforcement status is UNKNOWN
});
```

---

### Test Requirements

**Requirements**:
- Tests must cover all invariants
- Tests must cover all authorization boundaries
- Tests must cover all kill-switches
- Tests must fail if invariants are violated
- Tests must fail if authorization is bypassed
- Tests must fail if kill-switches do not work

**BLOCKED Notes**: Some tests may not be possible for BLOCKED capabilities. Tests must document BLOCKED status.

---

## 10. What the Codebase Must NEVER Assume

### Forbidden Assumptions

**Assumption 1: Authorization Exists**
- **Forbidden**: Code must NOT assume authorization exists
- **Required**: Code must check authorization status
- **Reason**: Authorization status is NOT AUTHORIZED (see PRODUCTION_AUTHORIZATION.md)

**Assumption 2: Activation Exists**
- **Forbidden**: Code must NOT assume activation exists
- **Required**: Code must check activation status
- **Reason**: Activation status is NOT ACTIVATED (see PRODUCTION_ACTIVATION.md)

**Assumption 3: BLOCKED Capabilities Exist**
- **Forbidden**: Code must NOT assume BLOCKED capabilities exist
- **Required**: Code must check BLOCKED status
- **Reason**: BLOCKED capabilities are NOT IMPLEMENTED (see GO_LIVE_READINESS.md)

**Assumption 4: Invariants Are Not Violated**
- **Forbidden**: Code must NOT assume invariants are not violated
- **Required**: Code must verify invariants
- **Reason**: Invariants must be actively enforced

**Assumption 5: Authorization Is Enforced**
- **Forbidden**: Code must NOT assume authorization is enforced
- **Required**: Code must enforce authorization
- **Reason**: Authorization must be actively enforced

**Assumption 6: Kill-Switches Work**
- **Forbidden**: Code must NOT assume kill-switches work
- **Required**: Code must verify kill-switches work
- **Reason**: Kill-switch enforcement status is UNKNOWN (BLOCKED)

**Assumption 7: Systems Are Responsive**
- **Forbidden**: Code must NOT assume systems are responsive
- **Required**: Code must handle system unresponsiveness
- **Reason**: Systems may not be responsive during emergencies (see INCIDENT_AND_EMERGENCY_RESPONSE.md)

**Assumption 8: Observability Is Complete**
- **Forbidden**: Code must NOT assume observability is complete
- **Required**: Code must handle partial observability
- **Reason**: Observability may be partial (see OBSERVABILITY_MODEL.md)

**Assumption 9: Operator Is Available**
- **Forbidden**: Code must NOT assume operator is available
- **Required**: Code must fail safe if operator is unavailable
- **Reason**: Operator is single human, may be unavailable (see PRODUCTION_OPERATION.md)

**Assumption 10: Working Code Means Authorized Code**
- **Forbidden**: Code must NOT assume working code means authorized code
- **Required**: Code must check authorization status
- **Reason**: Authorization and functionality are separate (see PRODUCTION_AUTHORIZATION.md)

---

### Assumption Code Examples

**Example 1: Forbidden Authorization Assumption**
```typescript
// FORBIDDEN: Code must NOT assume authorization exists
// WRONG:
function executeOperation(): void {
  // Assumes authorization exists (FORBIDDEN)
  executeAuthorizedOperation();
}

// CORRECT:
function executeOperation(): void {
  // Checks authorization status (REQUIRED)
  const authorizationStatus = getAuthorizationStatus();
  if (authorizationStatus !== "AUTHORIZED") {
    throw new Error("BLOCKED: Operation not authorized");
  }
  executeAuthorizedOperation();
}
```

**Example 2: Forbidden BLOCKED Capability Assumption**
```typescript
// FORBIDDEN: Code must NOT assume BLOCKED capabilities exist
// WRONG:
function purchaseInventory(): void {
  // Assumes buyer purchase function exists (FORBIDDEN)
  buyerPurchase(inventoryId);
}

// CORRECT:
function purchaseInventory(): void {
  // Checks BLOCKED status (REQUIRED)
  if (isBlocked("BUYER_PURCHASE_FUNCTION")) {
    throw new Error("BLOCKED: Buyer purchase function is NOT IMPLEMENTED. See GO_LIVE_READINESS.md BLOCKED 2");
  }
  buyerPurchase(inventoryId);
}
```

---

## Final Check

### What Developers Are Allowed to Write

**Verified**: Developers are allowed to write:
- Code implementing ALLOWED capabilities (11 capabilities from GO_LIVE_READINESS.md)
- Code implementing allowed entity operations (from DOMAIN_MODEL.md)
- Code implementing allowed module boundaries (from MODULARITY_GUIDE.md)
- Code that includes required guards (15 guards from Section 3)
- Code that includes required audit hooks (10 hooks from Section 4)
- Code that respects forbidden couplings (from MODULARITY_GUIDE.md)

**BLOCKED Notes**: Developers are NOT allowed to write code implementing BLOCKED capabilities (10 capabilities from GO_LIVE_READINESS.md).

---

### What They Are Forbidden to Write

**Verified**: Developers are forbidden to write:
- Code implementing BLOCKED capabilities (10 capabilities from GO_LIVE_READINESS.md)
- Code implementing forbidden entity operations (from DOMAIN_MODEL.md and INVARIANTS.md)
- Code creating forbidden couplings (from MODULARITY_GUIDE.md)
- Code implementing forbidden authorization patterns (from INVARIANTS.md)
- Code that assumes authorization exists
- Code that assumes activation exists
- Code that assumes BLOCKED capabilities exist

**BLOCKED Notes**: Forbidden code is explicitly listed and must not be written.

---

### How Invariants Are Protected in Code

**Verified**: Invariants are protected in code:
- 15 required guards must exist in code (Section 3)
- Guards must be server-side (Convex backend)
- Guards must block operations if invariants are violated
- Guards must log violations and notify operator
- Guards must be tested (Section 9)

**BLOCKED Notes**: Some guards may not exist for BLOCKED capabilities (pilot mode enforcement, purchase window enforcement).

---

### How Emergency Behavior Constrains Implementation

**Verified**: Emergency behavior constrains implementation:
- Code must not prevent kill-switch activation
- Code must not prevent system shutdown
- Code must fail safe if operator is unavailable
- Code must handle system unresponsiveness
- Code must handle partial observability
- Code must default to STOP on ambiguity

**BLOCKED Notes**: Emergency behavior constraints are explicit and must be respected.

---

### Why "Working Code" Does Not Mean "Authorized Code"

**Verified**: "Working code" does not mean "authorized code":
- Authorization status is NOT AUTHORIZED (see PRODUCTION_AUTHORIZATION.md)
- Activation status is NOT ACTIVATED (see PRODUCTION_ACTIVATION.md)
- Code must check authorization status before operations
- Code must check activation status before operations
- Code must return explicit errors if authorization/activation is missing
- Working code without authorization is FORBIDDEN

**BLOCKED Notes**: Code must never assume authorization or activation exists.

---

**CURRENT IMPLEMENTATION STATUS**: **BOUNDARIES DEFINED**

**Implementation boundaries are defined and ready for use when code is written.**

---

*This document must be updated when governance changes, BLOCKED items are unblocked, or new implementation boundaries are defined. No assumptions. Only truth.*
