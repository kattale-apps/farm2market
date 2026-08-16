# MODULARITY_GUIDE.md

**Production System Modularity Guide**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- DOMAIN_MODEL.md defines entities, ownership, and state machines
- architecture.md defines components, trust boundaries, and kill-switches
- This document defines how the system is allowed to evolve safely (no code, no workflows, no business logic)

---

## 1. Module Definitions

### Module: Authentication

**Responsibility**: User authentication (login, password verification, session management)

**Owned Entities**: None (authentication does not own User entity, only verifies credentials)

**Trust Boundary Classification**: **Trusted** (server-side only)

**BLOCKED**: Production authentication architecture is BLOCKED (VISION.md BLOCKED #1)

---

### Module: Authorization

**Responsibility**: Role-based access control, permission enforcement, admin verification

**Owned Entities**: None (authorization does not own entities, only enforces access rules)

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**: 
- Requires User entity (to check role)
- Required by all modules that perform user actions

**BLOCKED**: Role assignment mechanism is BLOCKED FOR PRODUCTION (role inference from email prefix)

---

### Module: User Management

**Responsibility**: User account creation, role assignment, user suspension/deletion, alias generation

**Owned Entities**: User

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify admin role for role changes)
- Requires Authentication module (for account creation)

**BLOCKED**: Role assignment via email inference is BLOCKED FOR PRODUCTION

---

### Module: Listing

**Responsibility**: Farmer listing creation, listing unit splitting, listing status management

**Owned Entities**: Listing, ListingUnit

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify farmer role)
- Requires User Management module (to verify user exists)
- Required by Transaction module (for unit locking)

**Independent Changes Allowed**:
- Listing creation logic (rate limits, validation rules)
- Unit splitting logic (unit size, splitting algorithm)
- Listing status transitions (without affecting other modules)

---

### Module: Transaction

**Responsibility**: Pay-to-lock operations, transaction reversals, atomic transaction processing

**Owned Entities**: ListingUnit (status changes), WalletLedger (entries)

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify trader role)
- Requires Listing module (to read unit availability)
- Requires Wallet module (to debit capital)
- Requires Rate Limiting module (to check rate limits)
- Requires System Settings module (to check pilot mode)

**Independent Changes Allowed**:
- Transaction processing logic (without changing atomicity guarantees)
- Reversal logic (without changing authorization requirements)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to Purchase module (transactions are independent)
- **MUST NOT** be tightly coupled to Inventory module (transactions happen before inventory creation)

---

### Module: Wallet

**Responsibility**: Capital deposits, profit credits, profit withdrawals, ledger management, balance calculations

**Owned Entities**: WalletLedger

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify trader role)
- Requires System Settings module (to check pilot mode)
- Required by Transaction module (for capital debits/credits)

**Independent Changes Allowed**:
- Ledger entry format (without breaking immutability)
- Balance calculation logic (without breaking ledger integrity)
- Profit calculation logic (without breaking ledger integrity)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to external payment processors (closed-loop system)
- **MUST NOT** be tightly coupled to Inventory module (wallet is independent of inventory)

---

### Module: Inventory

**Responsibility**: Trader inventory creation, inventory aggregation, inventory status management

**Owned Entities**: TraderInventory

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Transaction module (to read delivered units)
- Requires Authorization module (to verify admin role for delivery verification)
- **BLOCKED**: Requires Delivery Verification module (status UNKNOWN)

**Independent Changes Allowed**:
- Inventory aggregation logic (100kg block creation)
- Inventory status transitions (without affecting other modules)

**BLOCKED**: Inventory creation depends on delivery verification (status UNKNOWN)

---

### Module: Purchase

**Responsibility**: Buyer purchase creation, purchase status management, pickup SLA tracking

**Owned Entities**: BuyerPurchase

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify buyer role)
- Requires Inventory module (to read available inventory)
- Requires System Settings module (to check purchase window)
- Requires Rate Limiting module (to check rate limits)

**BLOCKED**: Purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to Transaction module (purchases are independent of pay-to-lock)
- **MUST NOT** be tightly coupled to Wallet module (buyers do not interact with wallet)

---

### Module: Admin

**Responsibility**: Delivery verification, transaction reversal, purchase window control, pilot mode control, user role changes, admin action logging

**Owned Entities**: AdminAction, PurchaseWindow, SystemSettings, ListingUnit (delivery status), TraderInventory (status), User (role, suspend/unsuspend)

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify admin role)
- Requires Transaction module (to reverse transactions)
- Requires Inventory module (to verify delivery status)
- Requires User Management module (to change user roles)

**Independent Changes Allowed**:
- Admin action logging format (without breaking immutability)
- Purchase window control logic (without affecting other modules)
- Pilot mode control logic (without affecting other modules)

**BLOCKED**: Delivery verification function implementation status is UNKNOWN

---

### Module: Notification

**Responsibility**: Notification creation, notification delivery, notification status management

**Owned Entities**: Notification

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify admin role for broadcast notifications)
- Requires User Management module (to read user list)

**Independent Changes Allowed**:
- Notification delivery mechanism (without breaking immutability)
- Notification format (without breaking immutability)
- Notification filtering logic (without affecting other modules)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to external notification providers (SMS, email) - v1.x is internal only

---

### Module: Rate Limiting

**Responsibility**: Rate limit enforcement, rate limit violation logging, rate limit configuration

**Owned Entities**: RateLimitHit

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Required by all modules that perform user actions (Listing, Transaction, Purchase, etc.)

**Independent Changes Allowed**:
- Rate limit thresholds (without breaking enforcement)
- Rate limit window calculation (without breaking enforcement)
- Rate limit violation logging format (without breaking immutability)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to any specific business logic module (rate limiting is cross-cutting)

---

### Module: System Settings

**Responsibility**: Pilot mode management, system configuration, system state management

**Owned Entities**: SystemSettings

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify admin role)
- Required by all modules that perform money-moving mutations (Transaction, Wallet, Purchase)

**Independent Changes Allowed**:
- System settings format (without breaking immutability)
- Pilot mode enforcement logic (without breaking kill-switch functionality)

**BLOCKED**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist)

---

### Module: Storage Fee Automation

**Responsibility**: Storage fee calculation, storage fee deduction, storage fee logging

**Owned Entities**: StorageFeeDeduction

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Inventory module (to read inventory storage time)
- Requires Wallet module (to deduct fees from trader profit)

**BLOCKED**: Storage fee automation implementation status is UNKNOWN

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to external scheduling systems (must be self-contained)
- **MUST NOT** bypass inventory expiration logic (fees must be calculated before expiration)

---

### Module: Dashboard

**Responsibility**: User interface data aggregation, dashboard queries, role-specific views

**Owned Entities**: None (dashboard does not own entities, only reads them)

**Trust Boundary Classification**: **Untrusted** (frontend) and **Trusted** (backend queries)

**Dependencies**:
- Requires all modules (to read data for display)
- Requires Authorization module (to filter data by role)

**Independent Changes Allowed**:
- Dashboard query logic (without changing data ownership)
- Dashboard view format (without changing data structure)
- Dashboard aggregation logic (without changing source data)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to business logic modules (dashboard is read-only)
- **MUST NOT** bypass authorization (dashboard must respect role-based access)

---

### Module: Utilities

**Responsibility**: UTID generation, exposure calculation, SLA calculation, common utilities

**Owned Entities**: None (utilities do not own entities)

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Required by all modules that generate UTIDs or calculate exposure

**Independent Changes Allowed**:
- UTID generation algorithm (without breaking immutability)
- Exposure calculation logic (without breaking enforcement)
- SLA calculation logic (without breaking time-based rules)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to any specific business logic module (utilities are cross-cutting)

---

### Module: Error Handling

**Responsibility**: Standardized error responses, error code definitions, error logging

**Owned Entities**: None (error handling does not own entities)

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Required by all modules that return errors

**Independent Changes Allowed**:
- Error message format (without breaking error codes)
- Error code definitions (without breaking error handling)
- Error logging format (without breaking auditability)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to any specific business logic module (error handling is cross-cutting)

---

### Module: Introspection

**Responsibility**: System introspection, UTID tracking, admin system queries

**Owned Entities**: None (introspection does not own entities, only reads them)

**Trust Boundary Classification**: **Trusted** (server-side only)

**Dependencies**:
- Requires Authorization module (to verify admin role)
- Requires all modules (to read data for introspection)

**Independent Changes Allowed**:
- Introspection query logic (without changing data ownership)
- Introspection view format (without changing data structure)

**Forbidden Couplings**:
- **MUST NOT** be tightly coupled to business logic modules (introspection is read-only)
- **MUST NOT** bypass authorization (introspection requires admin role)

---

## 2. Independent Modules

### Modules That May Evolve Independently

**Notification Module**:
- **Allowed Changes**: Notification delivery mechanism, notification format, notification filtering
- **Re-Authorization Required**: No (changes do not affect other modules)
- **Constraint**: Must not break immutability of Notification entity

**Dashboard Module**:
- **Allowed Changes**: Dashboard query logic, dashboard view format, dashboard aggregation
- **Re-Authorization Required**: No (dashboard is read-only, does not affect business logic)
- **Constraint**: Must not bypass authorization, must not change data ownership

**Error Handling Module**:
- **Allowed Changes**: Error message format, error code definitions, error logging format
- **Re-Authorization Required**: No (error handling is cross-cutting, does not affect business logic)
- **Constraint**: Must not break error code compatibility

**Utilities Module**:
- **Allowed Changes**: UTID generation algorithm, exposure calculation logic, SLA calculation logic
- **Re-Authorization Required**: **YES** (UTID generation changes affect auditability, exposure calculation changes affect financial limits)
- **Constraint**: Must not break immutability of UTIDs, must not break exposure limit enforcement

**Rate Limiting Module**:
- **Allowed Changes**: Rate limit thresholds, rate limit window calculation, rate limit violation logging format
- **Re-Authorization Required**: **YES** (rate limit threshold changes affect system behavior)
- **Constraint**: Must not break rate limit enforcement

**Listing Module**:
- **Allowed Changes**: Listing creation logic, unit splitting logic, listing status transitions
- **Re-Authorization Required**: No (changes do not affect other modules if atomicity is preserved)
- **Constraint**: Must not break unit splitting atomicity

**Inventory Module**:
- **Allowed Changes**: Inventory aggregation logic, inventory status transitions
- **Re-Authorization Required**: No (changes do not affect other modules)
- **Constraint**: Must not break inventory creation atomicity

**User Management Module**:
- **Allowed Changes**: User account creation logic, alias generation algorithm
- **Re-Authorization Required**: **YES** (alias generation changes affect anonymity, role assignment changes affect authorization)
- **Constraint**: Must not break alias immutability, must not break role assignment authorization

---

## 3. Coupling Constraints (NON-NEGOTIABLE)

### Pairs or Groups of Modules That Must Never Be Tightly Coupled

**Transaction Module ↔ Purchase Module**:
- **Why Coupling is Dangerous**: Transactions (pay-to-lock) and purchases (buyer purchases) are independent workflows. Tight coupling would create dependencies that prevent independent evolution.
- **What Failure Would Look Like**: Changes to transaction logic would break purchase logic, or vice versa. System would become brittle and difficult to maintain.

**Wallet Module ↔ External Payment Processors**:
- **Why Coupling is Dangerous**: System is closed-loop. External payment processor coupling would violate system design and introduce third-party business integration risks.
- **What Failure Would Look Like**: System would become dependent on external services, violating closed-loop design. Financial transactions would be exposed to third-party risks.

**Wallet Module ↔ Inventory Module**:
- **Why Coupling is Dangerous**: Wallet operations (capital deposits, profit withdrawals) are independent of inventory operations. Tight coupling would create unnecessary dependencies.
- **What Failure Would Look Like**: Changes to wallet logic would break inventory logic, or vice versa. System would become difficult to maintain.

**Rate Limiting Module ↔ Business Logic Modules**:
- **Why Coupling is Dangerous**: Rate limiting is cross-cutting. Tight coupling to specific business logic modules would prevent rate limiting from being applied uniformly.
- **What Failure Would Look Like**: Rate limiting would become inconsistent across modules. Some actions would be rate-limited, others would not.

**Error Handling Module ↔ Business Logic Modules**:
- **Why Coupling is Dangerous**: Error handling is cross-cutting. Tight coupling to specific business logic modules would prevent standardized error handling.
- **What Failure Would Look Like**: Error handling would become inconsistent across modules. Some errors would be handled, others would not.

**Utilities Module ↔ Business Logic Modules**:
- **Why Coupling is Dangerous**: Utilities are cross-cutting. Tight coupling to specific business logic modules would prevent utilities from being reused.
- **What Failure Would Look Like**: Utilities would become duplicated across modules. Changes to utilities would require changes in multiple places.

**Notification Module ↔ External Notification Providers**:
- **Why Coupling is Dangerous**: v1.x is internal-only. External notification provider coupling would introduce third-party business integration risks.
- **What Failure Would Look Like**: System would become dependent on external services. Notification delivery would be exposed to third-party risks.

**Storage Fee Automation Module ↔ External Scheduling Systems**:
- **Why Coupling is Dangerous**: Storage fee automation must be self-contained. External scheduling system coupling would introduce external dependencies.
- **What Failure Would Look Like**: System would become dependent on external scheduling services. Storage fee calculation would be exposed to external risks.

**Dashboard Module ↔ Business Logic Modules**:
- **Why Coupling is Dangerous**: Dashboard is read-only. Tight coupling to business logic modules would create dependencies that prevent independent evolution.
- **What Failure Would Look Like**: Changes to dashboard logic would break business logic, or vice versa. System would become difficult to maintain.

**Introspection Module ↔ Business Logic Modules**:
- **Why Coupling is Dangerous**: Introspection is read-only. Tight coupling to business logic modules would create dependencies that prevent independent evolution.
- **What Failure Would Look Like**: Changes to introspection logic would break business logic, or vice versa. System would become difficult to maintain.

---

## 4. Re-Authorization Triggers

### Changes That REQUIRE Explicit Re-Authorization by System Operator

**Authentication Module Changes**:
- **Why Re-Authorization is Required**: Authentication is BLOCKED for production. Any changes to authentication architecture require explicit authorization.
- **What Artifact Must Be Updated**: VISION.md (to unblock production authentication), architecture.md (to update authentication architecture), MODULARITY_GUIDE.md (to update module definitions)

**Authorization Module Changes**:
- **Why Re-Authorization is Required**: Authorization affects all modules. Changes to authorization logic affect system security.
- **What Artifact Must Be Updated**: architecture.md (to update authorization architecture), MODULARITY_GUIDE.md (to update module definitions)

**Role Assignment Mechanism Changes**:
- **Why Re-Authorization is Required**: Role assignment is BLOCKED FOR PRODUCTION. Changes to role assignment mechanism require explicit authorization.
- **What Artifact Must Be Updated**: DOMAIN_MODEL.md (to update role assignment transitions), architecture.md (to update authentication architecture), MODULARITY_GUIDE.md (to update module definitions)

**UTID Generation Algorithm Changes**:
- **Why Re-Authorization is Required**: UTIDs are immutable and used for auditability. Changes to UTID generation affect audit trail.
- **What Artifact Must Be Updated**: BUSINESS_LOGIC.md (to update irreversible actions), MODULARITY_GUIDE.md (to update module definitions)

**Exposure Limit Calculation Changes**:
- **Why Re-Authorization is Required**: Exposure limits are financial constraints. Changes to exposure limit calculation affect trader risk.
- **What Artifact Must Be Updated**: BUSINESS_LOGIC.md (to update risk allocation), MODULARITY_GUIDE.md (to update module definitions)

**Rate Limit Threshold Changes**:
- **Why Re-Authorization is Required**: Rate limits affect system behavior. Changes to rate limit thresholds affect user experience.
- **What Artifact Must Be Updated**: BUSINESS_LOGIC.md (to update workflows), MODULARITY_GUIDE.md (to update module definitions)

**Pilot Mode Enforcement Changes**:
- **Why Re-Authorization is Required**: Pilot mode is a kill-switch. Changes to pilot mode enforcement affect system safety.
- **What Artifact Must Be Updated**: architecture.md (to update kill-switch design), MODULARITY_GUIDE.md (to update module definitions)

**Transaction Atomicity Changes**:
- **Why Re-Authorization is Required**: Transaction atomicity is critical for financial correctness. Changes to atomicity affect system integrity.
- **What Artifact Must Be Updated**: BUSINESS_LOGIC.md (to update workflows), architecture.md (to update component breakdown), MODULARITY_GUIDE.md (to update module definitions)

**Wallet Ledger Immutability Changes**:
- **Why Re-Authorization is Required**: Wallet ledger immutability is critical for auditability. Changes to immutability affect audit trail.
- **What Artifact Must Be Updated**: BUSINESS_LOGIC.md (to update irreversible actions), architecture.md (to update data layer architecture), MODULARITY_GUIDE.md (to update module definitions)

**Admin Action Logging Changes**:
- **Why Re-Authorization is Required**: Admin action logging is critical for auditability. Changes to logging affect audit trail.
- **What Artifact Must Be Updated**: BUSINESS_LOGIC.md (to update authority and control), architecture.md (to update single-human authority model), MODULARITY_GUIDE.md (to update module definitions)

---

## 5. Safe Extension Points

### Where New Functionality May Be Added Safely

**Notification Module Extensions**:
- **Allowed Extensions**: New notification types, new notification delivery mechanisms (internal only)
- **Explicit Constraints**: Must not break immutability of Notification entity, must not introduce external notification providers (v1.x is internal only)
- **Forbidden Extensions**: External notification providers (SMS, email) - would introduce third-party business integration risks

**Dashboard Module Extensions**:
- **Allowed Extensions**: New dashboard views, new dashboard queries, new dashboard aggregations
- **Explicit Constraints**: Must not bypass authorization, must not change data ownership, must remain read-only
- **Forbidden Extensions**: Dashboard mutations (dashboard must remain read-only)

**Error Handling Module Extensions**:
- **Allowed Extensions**: New error codes, new error message formats, new error logging mechanisms
- **Explicit Constraints**: Must not break error code compatibility, must not break error handling consistency
- **Forbidden Extensions**: Error handling that bypasses authorization, error handling that exposes sensitive data

**Introspection Module Extensions**:
- **Allowed Extensions**: New introspection queries, new introspection views, new introspection aggregations
- **Explicit Constraints**: Must not bypass authorization (requires admin role), must remain read-only
- **Forbidden Extensions**: Introspection mutations (introspection must remain read-only)

**Utilities Module Extensions**:
- **Allowed Extensions**: New utility functions, new calculation algorithms (without breaking immutability or enforcement)
- **Explicit Constraints**: Must not break UTID immutability, must not break exposure limit enforcement, must not break SLA calculation
- **Forbidden Extensions**: Utilities that bypass authorization, utilities that break immutability guarantees

**Rate Limiting Module Extensions**:
- **Allowed Extensions**: New rate limit types, new rate limit configurations (without breaking enforcement)
- **Explicit Constraints**: Must not break rate limit enforcement, must remain cross-cutting
- **Forbidden Extensions**: Rate limiting that bypasses authorization, rate limiting that is tightly coupled to specific business logic

---

## 6. BLOCKED MODULARITY RISKS

### Areas Where Modularity Cannot Be Guaranteed Yet

**BLOCKED 1: Authentication Module Modularity**:
- **Blocked By**: VISION.md BLOCKED item #1 (Production Authentication NOT IMPLEMENTED)
- **Why Modularity Cannot Be Guaranteed**: Authentication architecture is BLOCKED. Module boundaries cannot be fully specified until authentication is implemented.
- **What Would Unblock**: Implementation of production authentication mechanism

**BLOCKED 2: Role Assignment Module Modularity**:
- **Blocked By**: Role inference from email prefix is BLOCKED FOR PRODUCTION
- **Why Modularity Cannot Be Guaranteed**: Role assignment mechanism is BLOCKED FOR PRODUCTION. Module boundaries cannot be fully specified until explicit role assignment is implemented.
- **What Would Unblock**: Implementation of explicit admin-controlled role assignment

**BLOCKED 3: Delivery Verification Module Modularity**:
- **Blocked By**: VISION.md UNKNOWN item (Delivery Verification Function implementation status UNKNOWN)
- **Why Modularity Cannot Be Guaranteed**: Delivery verification function implementation status is UNKNOWN. Module boundaries cannot be fully specified until implementation is verified.
- **What Would Unblock**: Verification and implementation of delivery verification function

**BLOCKED 4: Storage Fee Automation Module Modularity**:
- **Blocked By**: VISION.md UNKNOWN item (Storage Fee Automation implementation status UNKNOWN)
- **Why Modularity Cannot Be Guaranteed**: Storage fee automation implementation status is UNKNOWN. Module boundaries cannot be fully specified until implementation is verified.
- **What Would Unblock**: Verification and implementation of storage fee automation

**BLOCKED 5: Purchase Module Modularity**:
- **Blocked By**: VISION.md BLOCKED item #2 (Buyer Purchase Function NOT IMPLEMENTED)
- **Why Modularity Cannot Be Guaranteed**: Purchase function is NOT IMPLEMENTED. Module boundaries cannot be fully specified until purchase function is implemented.
- **What Would Unblock**: Implementation of buyer purchase function

**BLOCKED 6: Pilot Mode Enforcement Module Modularity**:
- **Blocked By**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist)
- **Why Modularity Cannot Be Guaranteed**: Pilot mode enforcement implementation status is UNKNOWN. Module boundaries cannot be fully specified until implementation is verified.
- **What Would Unblock**: Verification of pilot mode enforcement implementation

**BLOCKED 7: Inventory Module Dependencies**:
- **Blocked By**: Inventory creation depends on delivery verification (status UNKNOWN)
- **Why Modularity Cannot Be Guaranteed**: Inventory module cannot be fully modular until delivery verification dependencies are resolved.
- **What Would Unblock**: Verification and implementation of delivery verification function

---

## Final Check

### All Modules Defined

**Verified**: All modules are defined:
1. Authentication Module
2. Authorization Module
3. User Management Module
4. Listing Module
5. Transaction Module
6. Wallet Module
7. Inventory Module
8. Purchase Module
9. Admin Module
10. Notification Module
11. Rate Limiting Module
12. System Settings Module
13. Storage Fee Automation Module
14. Dashboard Module
15. Utilities Module
16. Error Handling Module
17. Introspection Module

### All Forbidden Couplings Listed

**Verified**: All forbidden couplings are listed:
1. Transaction Module ↔ Purchase Module
2. Wallet Module ↔ External Payment Processors
3. Wallet Module ↔ Inventory Module
4. Rate Limiting Module ↔ Business Logic Modules
5. Error Handling Module ↔ Business Logic Modules
6. Utilities Module ↔ Business Logic Modules
7. Notification Module ↔ External Notification Providers
8. Storage Fee Automation Module ↔ External Scheduling Systems
9. Dashboard Module ↔ Business Logic Modules
10. Introspection Module ↔ Business Logic Modules

### All Re-Authorization Triggers Identified

**Verified**: All re-authorization triggers are identified:
1. Authentication Module Changes
2. Authorization Module Changes
3. Role Assignment Mechanism Changes
4. UTID Generation Algorithm Changes
5. Exposure Limit Calculation Changes
6. Rate Limit Threshold Changes
7. Pilot Mode Enforcement Changes
8. Transaction Atomicity Changes
9. Wallet Ledger Immutability Changes
10. Admin Action Logging Changes

### All Safe Extension Points Constrained

**Verified**: All safe extension points are constrained:
1. Notification Module Extensions (internal only, no external providers)
2. Dashboard Module Extensions (read-only, no mutations)
3. Error Handling Module Extensions (must not bypass authorization)
4. Introspection Module Extensions (read-only, admin-only)
5. Utilities Module Extensions (must not break immutability or enforcement)
6. Rate Limiting Module Extensions (must remain cross-cutting)

### Confirmation: No New Authority, Entities, or Behaviors Introduced

**Verified**: No new authority, entities, or behaviors were introduced:
- All modules are derived from DOMAIN_MODEL.md entities and architecture.md components
- All authority is from BUSINESS_LOGIC.md (Admin authority, System Operator authority)
- All entities are from DOMAIN_MODEL.md (12 entities)
- No new modules, entities, roles, or authority were introduced

---

*This document must be updated when modules change, BLOCKED items are unblocked, or new modules are introduced. No assumptions. Only truth.*
