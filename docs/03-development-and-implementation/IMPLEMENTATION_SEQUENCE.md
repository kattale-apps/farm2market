# IMPLEMENTATION_SEQUENCE.md

**Production System Implementation Sequence**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- IMPLEMENTATION_BOUNDARIES.md defines what code is allowed
- MODULARITY_GUIDE.md defines module independence and forbidden couplings
- INVARIANTS.md defines non-negotiable guarantees
- PRODUCTION_AUTHORIZATION.md and PRODUCTION_ACTIVATION.md gate execution
- INCIDENT_AND_EMERGENCY_RESPONSE.md defines failure behavior

**Purpose**: This document defines a **strict, serial build order** that minimizes blast radius, preserves invariants at every step, allows safe stopping after each step, and never requires BLOCKED capabilities.

---

## 1. Implementation Principles

### Core Principles

**1. Serial Implementation Only**
- Only one module may be built at a time
- No parallel work is allowed
- Each module must be completed before next module begins
- Dependencies must be satisfied before dependent modules are built

**2. Minimize Blast Radius**
- Build foundational modules first
- Build independent modules before dependent modules
- Build read-only modules last
- Each step must have minimal impact if stopped

**3. Preserve Invariants at Every Step**
- All invariants must be preserved at every step
- No step may violate invariants
- Invariant guards must be implemented before dependent modules
- Invariant violations must be detected and blocked

**4. Safe Stopping Points**
- System must be safe to stop after each step
- No step may leave system in unsafe state
- Each step must be independently testable
- Each step must be independently deployable

**5. Never Require BLOCKED Capabilities**
- No step may depend on BLOCKED capabilities
- BLOCKED capabilities must be explicitly represented (not implemented)
- Steps that require BLOCKED capabilities must be deferred
- BLOCKED dependencies must be clearly marked

**6. Each Step Must Be Survivable**
- If implementation stops after any step, system must be safe
- No step may create irreversible damage
- No step may create data corruption
- No step may create security vulnerabilities

**7. Validation Required After Each Step**
- Each step must be validated before next step begins
- Validation must verify invariants are preserved
- Validation must verify dependencies are satisfied
- Validation must verify step is independently testable

**8. No Skipping Steps**
- Steps cannot be skipped
- Steps cannot be combined
- Steps cannot be reordered
- Each step must be completed before proceeding

---

## 2. What Must Be Built First (and Why)

### Foundation Modules (No Dependencies)

**Why Foundation First**:
- Foundation modules have no dependencies
- Foundation modules are required by all other modules
- Foundation modules provide core utilities (UTID generation, error handling)
- Foundation modules cannot be built in parallel (serial implementation only)

**Foundation Modules**:
1. **Utilities Module** (Step 1)
   - **Why First**: Provides UTID generation, exposure calculation, SLA calculation
   - **Dependencies**: None
   - **Required By**: All modules that generate UTIDs or calculate exposure
   - **Invariants Protected**: INVARIANT 4.1 (UTID Immutability), INVARIANT 4.2 (All Meaningful Actions Generate UTIDs), INVARIANT 6.1 (Exposure Limit Enforcement), INVARIANT 6.2 (Exposure Calculation Atomicity)

2. **Error Handling Module** (Step 2)
   - **Why Second**: Provides standardized error responses, error codes, error logging
   - **Dependencies**: None
   - **Required By**: All modules that return errors
   - **Invariants Protected**: None (error handling supports invariant enforcement)

**Why No Other Module Can Precede**:
- All other modules depend on Utilities (for UTID generation, exposure calculation)
- All other modules depend on Error Handling (for standardized errors)
- Building other modules first would violate dependency constraints
- Building other modules first would create unsafe state (missing UTID generation, missing error handling)

---

## 3. Module-by-Module Build Order

### Step 1: Utilities Module

**Module**: Utilities

**What Is Built**:
- UTID generation function
- Exposure calculation function
- SLA calculation function
- Common utilities

**Dependencies**: None

**What This Step Unlocks**:
- All modules can now generate UTIDs
- All modules can now calculate exposure
- All modules can now calculate SLAs

**What This Step MUST NOT Depend On**:
- Any other module (no dependencies)
- BLOCKED capabilities (no BLOCKED dependencies)
- Authorization (not required for utilities)
- User Management (not required for utilities)

**Validation Required**:
- UTID generation is deterministic and unique
- Exposure calculation is correct (UGX 1,000,000 maximum)
- SLA calculation is correct (6 hours for farmer delivery, 48 hours for buyer pickup)
- Utilities are independently testable

**Safe Stopping Point**: Yes (utilities are independent, no data created)

**Invariants Preserved**:
- INVARIANT 4.1: UTID Immutability (UTID generation is deterministic)
- INVARIANT 4.2: All Meaningful Actions Generate UTIDs (UTID generation available)
- INVARIANT 6.1: Exposure Limit Enforcement (exposure calculation available)
- INVARIANT 6.2: Exposure Calculation Atomicity (exposure calculation available)

**BLOCKED Notes**: None

---

### Step 2: Error Handling Module

**Module**: Error Handling

**What Is Built**:
- Standardized error response format
- Error code definitions
- Error logging mechanism

**Dependencies**: None

**What This Step Unlocks**:
- All modules can now return standardized errors
- All modules can now log errors consistently
- All modules can now handle errors uniformly

**What This Step MUST NOT Depend On**:
- Any other module (no dependencies)
- BLOCKED capabilities (no BLOCKED dependencies)
- Authorization (not required for error handling)
- User Management (not required for error handling)

**Validation Required**:
- Error response format is consistent
- Error codes are defined and documented
- Error logging is functional
- Error handling is independently testable

**Safe Stopping Point**: Yes (error handling is independent, no data created)

**Invariants Preserved**: None (error handling supports invariant enforcement)

**BLOCKED Notes**: None

---

### Step 3: Authorization Module

**Module**: Authorization

**What Is Built**:
- Role-based access control
- Permission enforcement
- Admin role verification
- Server-side authorization checks

**Dependencies**: 
- Requires User entity (to check role)
- Requires Utilities (for UTID generation in authorization logs)

**What This Step Unlocks**:
- All modules can now enforce authorization
- All modules can now verify admin role
- All modules can now check permissions

**What This Step MUST NOT Depend On**:
- User Management module (can work with minimal User entity)
- Authentication module (BLOCKED - production authentication NOT IMPLEMENTED)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Authorization checks are server-side only
- Admin role verification works
- Permission enforcement works
- Authorization is independently testable

**Safe Stopping Point**: Yes (authorization is independent, no data created)

**Invariants Preserved**:
- INVARIANT 2.1: Server-Side Authorization Enforcement (authorization is server-side)
- INVARIANT 2.2: Admin Role Verification (admin role verification available)
- INVARIANT 2.3: Frontend Cannot Bypass Authorization (authorization is server-side)

**BLOCKED Notes**: Role assignment mechanism is BLOCKED FOR PRODUCTION (role inference from email prefix). Authorization module must work with explicit role assignment (not email inference).

---

### Step 4: Rate Limiting Module

**Module**: Rate Limiting

**What Is Built**:
- Rate limit enforcement
- Rate limit violation logging
- Rate limit configuration

**Dependencies**:
- Requires Utilities (for UTID generation in rate limit logs)

**What This Step Unlocks**:
- All modules can now enforce rate limits
- All modules can now log rate limit violations
- All modules can now configure rate limits

**What This Step MUST NOT Depend On**:
- User Management module (can work with minimal User entity)
- Authorization module (rate limiting is independent of authorization)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Rate limit enforcement works
- Rate limit violation logging works
- Rate limit configuration works
- Rate limiting is independently testable

**Safe Stopping Point**: Yes (rate limiting is independent, no data created)

**Invariants Preserved**: None (rate limiting supports invariant enforcement)

**BLOCKED Notes**: None

---

### Step 5: User Management Module

**Module**: User Management

**What Is Built**:
- User account creation
- Role assignment (explicit, not inferred)
- User suspension/deletion
- Alias generation

**Dependencies**:
- Requires Authorization module (to verify admin role for role changes)
- Requires Utilities (for UTID generation, alias generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- All modules can now verify users exist
- All modules can now check user roles
- All modules can now manage user accounts

**What This Step MUST NOT Depend On**:
- Authentication module (BLOCKED - production authentication NOT IMPLEMENTED)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- User account creation works
- Role assignment works (explicit, not inferred)
- User suspension/deletion works
- Alias generation works
- Users cannot change their own role (INVARIANT 3.1)
- User Management is independently testable

**Safe Stopping Point**: Yes (user management is independent, creates User entities)

**Invariants Preserved**:
- INVARIANT 3.1: Users Cannot Change Their Own Role (enforced in role change logic)
- INVARIANT 4.2: All Meaningful Actions Generate UTIDs (UTID generation for user actions)

**BLOCKED Notes**: Role assignment via email inference is BLOCKED FOR PRODUCTION. User Management must use explicit role assignment (admin-controlled).

---

### Step 6: System Settings Module

**Module**: System Settings

**What Is Built**:
- Pilot mode management
- System configuration
- System state management
- Pilot mode enforcement (if implemented)

**Dependencies**:
- Requires Authorization module (to verify admin role)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- All modules can now check pilot mode status
- All modules can now check system configuration
- All modules can now enforce pilot mode (if implemented)

**What This Step MUST NOT Depend On**:
- Wallet module (system settings are independent)
- Transaction module (system settings are independent)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Pilot mode management works
- System configuration works
- System state management works
- Pilot mode enforcement works (if implemented)
- System Settings is independently testable

**Safe Stopping Point**: Yes (system settings are independent, creates SystemSettings entity)

**Invariants Preserved**:
- INVARIANT 7.1: Pilot Mode Enforcement (pilot mode enforcement available, if implemented)

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (BLOCKED). System Settings must represent pilot mode enforcement explicitly (see IMPLEMENTATION_BOUNDARIES.md Section 6).

---

### Step 7: Wallet Module

**Module**: Wallet

**What Is Built**:
- Capital deposits
- Profit credits
- Profit withdrawals (from ledger only)
- Ledger management
- Balance calculations
- Ledger immutability enforcement

**Dependencies**:
- Requires Authorization module (to verify trader role)
- Requires System Settings module (to check pilot mode)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Transaction module can now debit/credit capital
- Traders can now deposit capital
- Traders can now withdraw profit (from ledger only)

**What This Step MUST NOT Depend On**:
- Transaction module (wallet is independent)
- Inventory module (wallet is independent)
- Purchase module (wallet is independent)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Capital deposits work
- Profit credits work
- Profit withdrawals work (from ledger only)
- Ledger immutability is enforced (INVARIANT 1.2)
- Balance calculations are correct (INVARIANT 1.1)
- No balance overwrites (INVARIANT 1.3)
- Pilot mode blocks money-moving mutations (INVARIANT 7.1, if implemented)
- Wallet is independently testable

**Safe Stopping Point**: Yes (wallet is independent, creates WalletLedger entities)

**Invariants Preserved**:
- INVARIANT 1.1: Wallet Ledger Balance Consistency (balance calculation enforced)
- INVARIANT 1.2: Wallet Ledger Entry Immutability (ledger immutability enforced)
- INVARIANT 1.3: No Balance Overwrites (balance overwrites prevented)
- INVARIANT 7.1: Pilot Mode Enforcement (pilot mode blocks money-moving mutations, if implemented)

**BLOCKED Notes**: Profit withdrawal external transfer is BLOCKED (status UNKNOWN). Wallet must only support profit withdrawal from ledger (not external transfer).

---

### Step 8: Listing Module

**Module**: Listing

**What Is Built**:
- Farmer listing creation
- Listing unit splitting (10kg units)
- Listing status management
- Rate limit enforcement

**Dependencies**:
- Requires Authorization module (to verify farmer role)
- Requires User Management module (to verify user exists)
- Requires Rate Limiting module (to check rate limits)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Transaction module can now read unit availability
- Farmers can now create listings
- Farmers can now manage listings

**What This Step MUST NOT Depend On**:
- Transaction module (listing is independent)
- Wallet module (listing is independent)
- Inventory module (listing is independent)
- Purchase module (listing is independent)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Listing creation works
- Listing unit splitting works (10kg units)
- Listing status management works
- Rate limit enforcement works (10 listings per day per farmer)
- Farmer role verification works
- Listing is independently testable

**Safe Stopping Point**: Yes (listing is independent, creates Listing and ListingUnit entities)

**Invariants Preserved**:
- INVARIANT 2.1: Server-Side Authorization Enforcement (farmer role verification is server-side)
- INVARIANT 4.2: All Meaningful Actions Generate UTIDs (UTID generation for listings)

**BLOCKED Notes**: None

---

### Step 9: Transaction Module

**Module**: Transaction

**What Is Built**:
- Pay-to-lock operations (atomic)
- Transaction reversals (admin)
- Atomic transaction processing
- Exposure limit enforcement
- Pilot mode enforcement (if implemented)

**Dependencies**:
- Requires Authorization module (to verify trader role)
- Requires Listing module (to read unit availability)
- Requires Wallet module (to debit capital)
- Requires Rate Limiting module (to check rate limits)
- Requires System Settings module (to check pilot mode)
- Requires Utilities (for UTID generation, exposure calculation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Traders can now lock units (pay-to-lock)
- Admin can now reverse transactions
- Inventory module can now read delivered units

**What This Step MUST NOT Depend On**:
- Inventory module (transactions happen before inventory creation)
- Purchase module (transactions are independent)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Pay-to-lock operations are atomic (unit lock + capital debit)
- Transaction reversals work (admin only)
- Exposure limit enforcement works (UGX 1,000,000 maximum)
- Exposure calculation is atomic (INVARIANT 6.2)
- Pilot mode blocks money-moving mutations (INVARIANT 7.1, if implemented)
- Trader role verification works
- Transaction is independently testable

**Safe Stopping Point**: Yes (transaction is independent, creates WalletLedger entries, updates ListingUnit entities)

**Invariants Preserved**:
- INVARIANT 1.1: Wallet Ledger Balance Consistency (balance calculation enforced)
- INVARIANT 1.2: Wallet Ledger Entry Immutability (ledger immutability enforced)
- INVARIANT 2.1: Server-Side Authorization Enforcement (trader role verification is server-side)
- INVARIANT 6.1: Exposure Limit Enforcement (exposure limit enforced)
- INVARIANT 6.2: Exposure Calculation Atomicity (exposure calculation is atomic)
- INVARIANT 7.1: Pilot Mode Enforcement (pilot mode blocks money-moving mutations, if implemented)

**BLOCKED Notes**: None

---

### Step 10: Admin Module

**Module**: Admin

**What Is Built**:
- Transaction reversal (admin)
- Purchase window control (admin)
- Pilot mode control (admin)
- User role changes (admin)
- Admin action logging
- Delivery verification (if implemented)

**Dependencies**:
- Requires Authorization module (to verify admin role)
- Requires Transaction module (to reverse transactions)
- Requires User Management module (to change user roles)
- Requires System Settings module (to control pilot mode, purchase window)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Admin can now reverse transactions
- Admin can now control purchase window
- Admin can now control pilot mode
- Admin can now change user roles
- Admin can now verify deliveries (if implemented)

**What This Step MUST NOT Depend On**:
- Inventory module (admin operations are independent)
- Purchase module (admin operations are independent)
- BLOCKED capabilities (delivery verification status UNKNOWN)

**Validation Required**:
- Transaction reversal works (admin only, reason required)
- Purchase window control works (admin only)
- Pilot mode control works (admin only, reason required)
- User role changes work (admin only)
- Admin action logging works (immutable)
- Admin role verification works
- Admin is independently testable

**Safe Stopping Point**: Yes (admin is independent, creates AdminAction entities, updates SystemSettings, PurchaseWindow entities)

**Invariants Preserved**:
- INVARIANT 2.1: Server-Side Authorization Enforcement (admin role verification is server-side)
- INVARIANT 2.2: Admin Role Verification (admin role verification enforced)
- INVARIANT 8.1: Admin Action Logging Completeness (admin action logging enforced)

**BLOCKED Notes**: Delivery verification function implementation status is UNKNOWN (BLOCKED). Admin module must represent delivery verification explicitly (see IMPLEMENTATION_BOUNDARIES.md Section 6).

---

### Step 11: Inventory Module

**Module**: Inventory

**What Is Built**:
- Trader inventory creation
- Inventory aggregation (100kg blocks)
- Inventory status management
- Delivery status management (if delivery verification implemented)

**Dependencies**:
- Requires Transaction module (to read delivered units)
- Requires Authorization module (to verify admin role for delivery verification)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)
- **BLOCKED**: Requires Delivery Verification module (status UNKNOWN)

**What This Step Unlocks**:
- Purchase module can now read available inventory
- Traders can now manage inventory
- Admin can now verify deliveries (if implemented)

**What This Step MUST NOT Depend On**:
- Purchase module (inventory is independent)
- Wallet module (inventory is independent)
- BLOCKED capabilities (delivery verification status UNKNOWN)

**Validation Required**:
- Inventory creation works (from delivered units)
- Inventory aggregation works (100kg blocks)
- Inventory status management works
- Delivery status management works (if delivery verification implemented)
- Inventory is independently testable

**Safe Stopping Point**: Yes (inventory is independent, creates TraderInventory entities)

**Invariants Preserved**:
- INVARIANT 4.2: All Meaningful Actions Generate UTIDs (UTID generation for inventory)

**BLOCKED Notes**: Inventory creation depends on delivery verification (status UNKNOWN). Inventory module must represent delivery verification explicitly (see IMPLEMENTATION_BOUNDARIES.md Section 6).

---

### Step 12: Notification Module

**Module**: Notification

**What Is Built**:
- Notification creation
- Notification delivery (internal only)
- Notification status management

**Dependencies**:
- Requires Authorization module (to verify admin role for broadcast notifications)
- Requires User Management module (to read user list)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- All modules can now create notifications
- Admin can now broadcast notifications
- Users can now receive notifications

**What This Step MUST NOT Depend On**:
- External notification providers (SMS, email) - v1.x is internal only
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Notification creation works
- Notification delivery works (internal only)
- Notification status management works
- Notification is independently testable

**Safe Stopping Point**: Yes (notification is independent, creates Notification entities)

**Invariants Preserved**:
- INVARIANT 4.2: All Meaningful Actions Generate UTIDs (UTID generation for notifications)

**BLOCKED Notes**: None

---

### Step 13: Purchase Module (Read-Only, Purchase Function BLOCKED)

**Module**: Purchase

**What Is Built**:
- Purchase window status checking (read-only)
- Purchase function (BLOCKED - NOT IMPLEMENTED)
- Purchase status management (if purchase function implemented)

**Dependencies**:
- Requires Authorization module (to verify buyer role)
- Requires Inventory module (to read available inventory)
- Requires System Settings module (to check purchase window)
- Requires Rate Limiting module (to check rate limits)
- Requires Utilities (for UTID generation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Buyers can now check purchase window status (read-only)
- Purchase function (BLOCKED - NOT IMPLEMENTED)

**What This Step MUST NOT Depend On**:
- Transaction module (purchases are independent)
- Wallet module (buyers do not interact with wallet)
- BLOCKED capabilities (purchase function is BLOCKED)

**Validation Required**:
- Purchase window status checking works (read-only)
- Purchase function is BLOCKED (NOT IMPLEMENTED)
- Purchase is independently testable

**Safe Stopping Point**: Yes (purchase is read-only, no data created)

**Invariants Preserved**:
- INVARIANT 7.2: Purchase Window Enforcement (purchase window checking available, enforcement BLOCKED until purchase function implemented)

**BLOCKED Notes**: Purchase function is NOT IMPLEMENTED (BLOCKED). Purchase module must represent purchase function explicitly (see IMPLEMENTATION_BOUNDARIES.md Section 6).

---

### Step 14: Dashboard Module

**Module**: Dashboard

**What Is Built**:
- User interface data aggregation
- Dashboard queries
- Role-specific views

**Dependencies**:
- Requires all modules (to read data for display)
- Requires Authorization module (to filter data by role)
- Requires Utilities (for data aggregation)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Users can now view dashboards
- Admin can now view system dashboards
- All role-specific views are available

**What This Step MUST NOT Depend On**:
- Business logic modules (dashboard is read-only)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- Dashboard queries work
- Role-specific views work
- Data aggregation works
- Authorization is enforced (role-based access)
- Dashboard is independently testable

**Safe Stopping Point**: Yes (dashboard is read-only, no data created)

**Invariants Preserved**:
- INVARIANT 2.1: Server-Side Authorization Enforcement (dashboard respects authorization)
- INVARIANT 2.3: Frontend Cannot Bypass Authorization (dashboard respects authorization)

**BLOCKED Notes**: None

---

### Step 15: Introspection Module

**Module**: Introspection

**What Is Built**:
- System introspection
- UTID tracking
- Admin system queries

**Dependencies**:
- Requires all modules (to read data for introspection)
- Requires Authorization module (to verify admin role)
- Requires Utilities (for UTID tracking)
- Requires Error Handling (for error responses)

**What This Step Unlocks**:
- Admin can now introspect system
- Admin can now track UTIDs
- Admin can now query system state

**What This Step MUST NOT Depend On**:
- Business logic modules (introspection is read-only)
- BLOCKED capabilities (no BLOCKED dependencies)

**Validation Required**:
- System introspection works
- UTID tracking works
- Admin system queries work
- Admin role verification works
- Introspection is independently testable

**Safe Stopping Point**: Yes (introspection is read-only, no data created)

**Invariants Preserved**:
- INVARIANT 2.1: Server-Side Authorization Enforcement (introspection respects authorization)
- INVARIANT 2.2: Admin Role Verification (admin role verification enforced)

**BLOCKED Notes**: None

---

### BLOCKED Modules (Cannot Be Built)

**Module: Authentication**
- **Status**: BLOCKED (VISION.md BLOCKED #1)
- **Reason**: Production authentication NOT IMPLEMENTED
- **Cannot Be Built**: Until production authentication is unblocked

**Module: Purchase Function (within Purchase Module)**
- **Status**: BLOCKED (VISION.md BLOCKED #2)
- **Reason**: Purchase function NOT IMPLEMENTED
- **Cannot Be Built**: Until purchase function is unblocked

**Module: Delivery Verification (within Admin Module)**
- **Status**: BLOCKED (VISION.md BLOCKED #3)
- **Reason**: Delivery verification function implementation status UNKNOWN
- **Cannot Be Built**: Until delivery verification is verified and implemented

**Module: Storage Fee Automation**
- **Status**: BLOCKED (VISION.md BLOCKED #4)
- **Reason**: Storage fee automation implementation status UNKNOWN
- **Cannot Be Built**: Until storage fee automation is verified and implemented

**BLOCKED Notes**: These modules cannot be built until unblocked. Code must represent BLOCKED status explicitly (see IMPLEMENTATION_BOUNDARIES.md Section 6).

---

## 4. What Each Step Unlocks

### Step 1: Utilities Module
**Unlocks**:
- All modules can generate UTIDs
- All modules can calculate exposure
- All modules can calculate SLAs

### Step 2: Error Handling Module
**Unlocks**:
- All modules can return standardized errors
- All modules can log errors consistently
- All modules can handle errors uniformly

### Step 3: Authorization Module
**Unlocks**:
- All modules can enforce authorization
- All modules can verify admin role
- All modules can check permissions

### Step 4: Rate Limiting Module
**Unlocks**:
- All modules can enforce rate limits
- All modules can log rate limit violations
- All modules can configure rate limits

### Step 5: User Management Module
**Unlocks**:
- All modules can verify users exist
- All modules can check user roles
- All modules can manage user accounts

### Step 6: System Settings Module
**Unlocks**:
- All modules can check pilot mode status
- All modules can check system configuration
- All modules can enforce pilot mode (if implemented)

### Step 7: Wallet Module
**Unlocks**:
- Transaction module can debit/credit capital
- Traders can deposit capital
- Traders can withdraw profit (from ledger only)

### Step 8: Listing Module
**Unlocks**:
- Transaction module can read unit availability
- Farmers can create listings
- Farmers can manage listings

### Step 9: Transaction Module
**Unlocks**:
- Traders can lock units (pay-to-lock)
- Admin can reverse transactions
- Inventory module can read delivered units

### Step 10: Admin Module
**Unlocks**:
- Admin can reverse transactions
- Admin can control purchase window
- Admin can control pilot mode
- Admin can change user roles
- Admin can verify deliveries (if implemented)

### Step 11: Inventory Module
**Unlocks**:
- Purchase module can read available inventory
- Traders can manage inventory
- Admin can verify deliveries (if implemented)

### Step 12: Notification Module
**Unlocks**:
- All modules can create notifications
- Admin can broadcast notifications
- Users can receive notifications

### Step 13: Purchase Module
**Unlocks**:
- Buyers can check purchase window status (read-only)
- Purchase function (BLOCKED - NOT IMPLEMENTED)

### Step 14: Dashboard Module
**Unlocks**:
- Users can view dashboards
- Admin can view system dashboards
- All role-specific views are available

### Step 15: Introspection Module
**Unlocks**:
- Admin can introspect system
- Admin can track UTIDs
- Admin can query system state

---

## 5. What Each Step MUST NOT Depend On

### Step 1: Utilities Module
**MUST NOT Depend On**:
- Any other module
- BLOCKED capabilities
- Authorization
- User Management

### Step 2: Error Handling Module
**MUST NOT Depend On**:
- Any other module
- BLOCKED capabilities
- Authorization
- User Management

### Step 3: Authorization Module
**MUST NOT Depend On**:
- User Management module (can work with minimal User entity)
- Authentication module (BLOCKED)
- BLOCKED capabilities

### Step 4: Rate Limiting Module
**MUST NOT Depend On**:
- User Management module (can work with minimal User entity)
- Authorization module (rate limiting is independent)
- BLOCKED capabilities

### Step 5: User Management Module
**MUST NOT Depend On**:
- Authentication module (BLOCKED)
- BLOCKED capabilities

### Step 6: System Settings Module
**MUST NOT Depend On**:
- Wallet module
- Transaction module
- BLOCKED capabilities

### Step 7: Wallet Module
**MUST NOT Depend On**:
- Transaction module
- Inventory module
- Purchase module
- BLOCKED capabilities

### Step 8: Listing Module
**MUST NOT Depend On**:
- Transaction module
- Wallet module
- Inventory module
- Purchase module
- BLOCKED capabilities

### Step 9: Transaction Module
**MUST NOT Depend On**:
- Inventory module
- Purchase module
- BLOCKED capabilities

### Step 10: Admin Module
**MUST NOT Depend On**:
- Inventory module (admin operations are independent)
- Purchase module (admin operations are independent)
- BLOCKED capabilities (delivery verification status UNKNOWN)

### Step 11: Inventory Module
**MUST NOT Depend On**:
- Purchase module
- Wallet module
- BLOCKED capabilities (delivery verification status UNKNOWN)

### Step 12: Notification Module
**MUST NOT Depend On**:
- External notification providers (SMS, email)
- BLOCKED capabilities

### Step 13: Purchase Module
**MUST NOT Depend On**:
- Transaction module
- Wallet module
- BLOCKED capabilities (purchase function is BLOCKED)

### Step 14: Dashboard Module
**MUST NOT Depend On**:
- Business logic modules (dashboard is read-only)
- BLOCKED capabilities

### Step 15: Introspection Module
**MUST NOT Depend On**:
- Business logic modules (introspection is read-only)
- BLOCKED capabilities

---

## 6. Validation Required After Each Step

### Validation Requirements

**After Each Step**:
1. **Invariant Preservation**: Verify all invariants are preserved
2. **Dependency Satisfaction**: Verify all dependencies are satisfied
3. **Independent Testability**: Verify step is independently testable
4. **Safe Stopping**: Verify system is safe to stop after step
5. **No BLOCKED Dependencies**: Verify step does not depend on BLOCKED capabilities

**Validation Methods**:
- Unit tests for module functionality
- Integration tests for module dependencies
- Invariant violation tests
- Authorization enforcement tests
- Code review for forbidden couplings

**Validation Authority**:
- System operator only
- No automated validation (human decision required)
- Validation must be documented

**BLOCKED Notes**: Some validation may not be possible for BLOCKED capabilities (pilot mode enforcement, delivery verification). Validation must document BLOCKED status.

---

## 7. Safe Stopping Points

### Safe Stopping Point Definition

**Safe Stopping Point**: A point after which the system can be safely stopped without:
- Creating irreversible damage
- Creating data corruption
- Creating security vulnerabilities
- Violating invariants
- Requiring rollback

**Safe Stopping Points**:
- **After Step 1 (Utilities)**: Yes (utilities are independent, no data created)
- **After Step 2 (Error Handling)**: Yes (error handling is independent, no data created)
- **After Step 3 (Authorization)**: Yes (authorization is independent, no data created)
- **After Step 4 (Rate Limiting)**: Yes (rate limiting is independent, no data created)
- **After Step 5 (User Management)**: Yes (user management is independent, creates User entities)
- **After Step 6 (System Settings)**: Yes (system settings are independent, creates SystemSettings entity)
- **After Step 7 (Wallet)**: Yes (wallet is independent, creates WalletLedger entities)
- **After Step 8 (Listing)**: Yes (listing is independent, creates Listing and ListingUnit entities)
- **After Step 9 (Transaction)**: Yes (transaction is independent, creates WalletLedger entries, updates ListingUnit entities)
- **After Step 10 (Admin)**: Yes (admin is independent, creates AdminAction entities, updates SystemSettings, PurchaseWindow entities)
- **After Step 11 (Inventory)**: Yes (inventory is independent, creates TraderInventory entities)
- **After Step 12 (Notification)**: Yes (notification is independent, creates Notification entities)
- **After Step 13 (Purchase)**: Yes (purchase is read-only, no data created)
- **After Step 14 (Dashboard)**: Yes (dashboard is read-only, no data created)
- **After Step 15 (Introspection)**: Yes (introspection is read-only, no data created)

**All Steps Are Safe Stopping Points**: Yes (every step can be safely stopped)

---

## 8. What Cannot Be Built Until Authorization

### Authorization-Gated Modules

**Modules That Require Authorization** (from PRODUCTION_AUTHORIZATION.md):
- All modules require authorization before production use
- Authorization status is NOT AUTHORIZED (see PRODUCTION_AUTHORIZATION.md)
- Code can be built, but cannot be used in production until authorized

**Authorization Requirements**:
- Code must check authorization status before operations
- Code must return explicit errors if authorization is missing
- Code must document authorization requirements

**BLOCKED Notes**: Authorization status is NOT AUTHORIZED. Code must reflect this status (see IMPLEMENTATION_BOUNDARIES.md Section 7).

---

## 9. What Cannot Be Built Until Activation

### Activation-Gated Modules

**Modules That Require Activation** (from PRODUCTION_ACTIVATION.md):
- All modules require activation before production use
- Activation status is NOT ACTIVATED (see PRODUCTION_ACTIVATION.md)
- Code can be built, but cannot be used in production until activated

**Activation Requirements**:
- Code must check activation status before operations
- Code must return explicit errors if activation is missing
- Code must document activation requirements

**BLOCKED Notes**: Activation status is NOT ACTIVATED. Code must reflect this status (see IMPLEMENTATION_BOUNDARIES.md Section 7).

---

## 10. Final Readiness Gate Before Any Live Data

### Readiness Gate Requirements

**Before Any Live Data**:
1. **All Steps Completed**: All 15 steps must be completed
2. **All Invariants Preserved**: All 25 invariants must be preserved
3. **All Guards Implemented**: All 15 required guards must be implemented
4. **All Audit Hooks Implemented**: All 10 required audit hooks must be implemented
5. **All Tests Pass**: All mandatory tests must pass
6. **Authorization Granted**: Authorization must be granted (see PRODUCTION_AUTHORIZATION.md)
7. **Activation Completed**: Activation must be completed (see PRODUCTION_ACTIVATION.md)
8. **BLOCKED Capabilities Represented**: All BLOCKED capabilities must be explicitly represented

**Readiness Gate Authority**:
- System operator only
- No automated readiness check (human decision required)
- Readiness must be documented

**BLOCKED Notes**: Some readiness gates may not be possible for BLOCKED capabilities (pilot mode enforcement, delivery verification). Readiness must document BLOCKED status.

---

## Final Check

### The First Module That May Be Implemented

**Verified**: The first module that may be implemented is **Utilities Module (Step 1)**.

**Why**:
- Utilities module has no dependencies
- Utilities module provides UTID generation (required by all modules)
- Utilities module provides exposure calculation (required by Transaction module)
- Utilities module provides SLA calculation (required by all modules)
- No other module can precede it (all other modules depend on Utilities)

---

### Why No Other Module Can Precede It

**Verified**: No other module can precede Utilities Module because:
- All other modules depend on Utilities (for UTID generation, exposure calculation, SLA calculation)
- Building other modules first would violate dependency constraints
- Building other modules first would create unsafe state (missing UTID generation, missing exposure calculation)
- Building other modules first would violate serial implementation principle

**BLOCKED Notes**: None

---

### How Invariants Are Preserved at Every Step

**Verified**: Invariants are preserved at every step:
- **Step 1 (Utilities)**: Preserves INVARIANT 4.1, 4.2, 6.1, 6.2 (UTID generation, exposure calculation)
- **Step 2 (Error Handling)**: Supports invariant enforcement
- **Step 3 (Authorization)**: Preserves INVARIANT 2.1, 2.2, 2.3 (server-side authorization)
- **Step 4 (Rate Limiting)**: Supports invariant enforcement
- **Step 5 (User Management)**: Preserves INVARIANT 3.1 (users cannot change own role)
- **Step 6 (System Settings)**: Preserves INVARIANT 7.1 (pilot mode enforcement, if implemented)
- **Step 7 (Wallet)**: Preserves INVARIANT 1.1, 1.2, 1.3, 7.1 (ledger correctness, pilot mode)
- **Step 8 (Listing)**: Preserves INVARIANT 2.1, 4.2 (authorization, UTID generation)
- **Step 9 (Transaction)**: Preserves INVARIANT 1.1, 1.2, 2.1, 6.1, 6.2, 7.1 (ledger, authorization, exposure, pilot mode)
- **Step 10 (Admin)**: Preserves INVARIANT 2.1, 2.2, 8.1 (authorization, admin action logging)
- **Step 11 (Inventory)**: Preserves INVARIANT 4.2 (UTID generation)
- **Step 12 (Notification)**: Preserves INVARIANT 4.2 (UTID generation)
- **Step 13 (Purchase)**: Preserves INVARIANT 7.2 (purchase window enforcement, if implemented)
- **Step 14 (Dashboard)**: Preserves INVARIANT 2.1, 2.3 (authorization)
- **Step 15 (Introspection)**: Preserves INVARIANT 2.1, 2.2 (authorization)

**BLOCKED Notes**: Some invariants depend on BLOCKED capabilities (pilot mode enforcement, purchase window enforcement). Invariants must be preserved as much as possible given BLOCKED constraints.

---

### Where the System Can Safely Stop

**Verified**: The system can safely stop after every step:
- All 15 steps are safe stopping points
- Each step is independently testable
- Each step is independently deployable
- No step creates irreversible damage
- No step creates data corruption
- No step creates security vulnerabilities

**BLOCKED Notes**: None

---

### Why Skipping Steps Is Forbidden

**Verified**: Skipping steps is forbidden because:
- Steps have explicit dependencies (cannot skip dependencies)
- Steps preserve invariants (skipping steps may violate invariants)
- Steps unlock capabilities (skipping steps may prevent dependent modules from working)
- Steps are independently testable (skipping steps may prevent testing)
- Steps are safe stopping points (skipping steps may create unsafe state)
- Serial implementation principle (only one module at a time)

**BLOCKED Notes**: None

---

**CURRENT IMPLEMENTATION STATUS**: **SEQUENCE DEFINED**

**Implementation sequence is defined and ready for use when code is written.**

---

*This document must be updated when module dependencies change, BLOCKED items are unblocked, or new implementation constraints are defined. No assumptions. Only truth.*
