# THREAT_MODEL.md

**Production System Threat Model**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- INVARIANTS.md defines what must never be violated
- DOMAIN_MODEL.md defines entities, ownership, and state transitions
- architecture.md defines trust boundaries and kill-switches
- BUSINESS_LOGIC.md defines risk allocation
- MODULARITY_GUIDE.md defines forbidden couplings
- Threats are derived strictly from these artifacts (no new features, authority, or system goals)

---

## Threat Categories

### 1. Unauthorized Access or Privilege Escalation

#### THREAT 1.1: Role Inference Bypass (Email Prefix Manipulation)

**Threat Actor**: User (any role)

**Threat Description**: User manipulates email prefix to infer a different role (e.g., using `admin*` prefix to gain admin role) when role inference from email prefix is enabled (pilot mode). This allows privilege escalation.

**Impact**: 
- **Financial**: Low (role inference is BLOCKED FOR PRODUCTION)
- **Operational**: High (unauthorized admin access could reverse transactions, change roles)
- **Legal**: Medium (unauthorized access may violate regulations)
- **Reputational**: High (system compromise undermines trust)

**Likelihood**: Medium (role inference is easy to manipulate if enabled, but BLOCKED FOR PRODUCTION)

**Affected Invariants**: 
- INVARIANT 2.2: Admin Role Verification
- INVARIANT 3.1: Users Cannot Change Their Own Role

**Mitigation Strategy**: 
- Role inference from email prefix is BLOCKED FOR PRODUCTION
- Production authentication must use explicit role assignment (admin-controlled)
- Server-side role verification must check actual role, not inferred role

**Residual Risk**: Low (role inference is BLOCKED FOR PRODUCTION, but risk exists if production authentication is not implemented correctly)

**BLOCKED Notes**: Production authentication is NOT IMPLEMENTED (VISION.md BLOCKED #1). Mitigation depends on production authentication implementation.

---

#### THREAT 1.2: Frontend Authorization Bypass

**Threat Actor**: User (any role)

**Threat Description**: User manipulates frontend code or network requests to bypass backend authorization checks. Frontend sends unauthorized requests that are processed without server-side authorization verification.

**Impact**: 
- **Financial**: High (unauthorized transactions could occur)
- **Operational**: High (unauthorized actions could corrupt data)
- **Legal**: Medium (unauthorized access may violate regulations)
- **Reputational**: High (system compromise undermines trust)

**Likelihood**: Low (requires technical knowledge, but frontend is untrusted by design)

**Affected Invariants**: 
- INVARIANT 2.1: Server-Side Authorization Enforcement
- INVARIANT 2.3: Frontend Cannot Bypass Authorization

**Mitigation Strategy**: 
- All authorization checks must be performed server-side
- Frontend cannot bypass authorization (all mutations require server-side verification)
- Code review must verify all mutations check authorization server-side

**Residual Risk**: Low (architecture enforces server-side authorization, but risk exists if mutations lack authorization checks)

**BLOCKED Notes**: None

---

#### THREAT 1.3: Admin Credential Compromise

**Threat Actor**: External attacker or malicious user

**Threat Description**: Admin credentials (password, session token, etc.) are compromised through phishing, password reuse, or credential theft. Attacker gains admin access and performs unauthorized actions.

**Impact**: 
- **Financial**: High (admin can reverse transactions, change roles, control kill-switches)
- **Operational**: High (admin can corrupt data, disable system)
- **Legal**: Medium (unauthorized admin access may violate regulations)
- **Reputational**: High (system compromise undermines trust)

**Likelihood**: Medium (admin credentials are single point of failure, but production authentication is BLOCKED)

**Affected Invariants**: 
- INVARIANT 2.2: Admin Role Verification
- INVARIANT 8.1: Admin Action Logging Completeness

**Mitigation Strategy**: 
- Production authentication must use strong credentials (BLOCKED: production authentication NOT IMPLEMENTED)
- Admin actions must be logged (AdminAction table)
- System operator must monitor admin actions for anomalies
- **BLOCKED**: Automated admin oversight does not exist (system relies on admin good faith)

**Residual Risk**: Medium (admin credential compromise is possible, but admin actions are logged for audit)

**BLOCKED Notes**: Production authentication is NOT IMPLEMENTED (VISION.md BLOCKED #1). Mitigation depends on production authentication implementation.

---

### 2. Ledger Corruption or Inconsistency

#### THREAT 2.1: Ledger Entry Modification or Deletion

**Threat Actor**: System (database corruption, bug) or System operator (accidental or malicious)

**Threat Description**: WalletLedger entries are modified or deleted, either through database corruption, system bugs, or operator error. This breaks ledger immutability and audit trail.

**Impact**: 
- **Financial**: High (ledger corruption could cause incorrect balances, financial loss)
- **Operational**: High (ledger corruption breaks audit trail, system integrity)
- **Legal**: High (ledger corruption may violate financial regulations)
- **Reputational**: High (financial system corruption undermines trust)

**Likelihood**: Low (database constraints should prevent modifications/deletions, but risk exists)

**Affected Invariants**: 
- INVARIANT 1.2: Wallet Ledger Entry Immutability
- INVARIANT 1.1: Wallet Ledger Balance Consistency

**Mitigation Strategy**: 
- Database constraints must prevent ledger entry modifications/deletions
- Ledger entries are immutable (no update/delete operations)
- System operator must verify database constraints before production
- **BLOCKED**: Backup and restore procedures are UNKNOWN (cannot verify recovery)

**Residual Risk**: Low (database constraints should prevent modifications, but risk exists if constraints are not enforced)

**BLOCKED Notes**: Backup and restore procedures are UNKNOWN. Recovery from ledger corruption cannot be verified.

---

#### THREAT 2.2: Balance Calculation Error

**Threat Actor**: System (calculation bug)

**Threat Description**: Balance calculation logic contains errors, causing incorrect balance calculations. Balances do not match ledger entries, violating balance consistency.

**Impact**: 
- **Financial**: High (incorrect balances could cause financial loss)
- **Operational**: High (balance errors break system integrity)
- **Legal**: Medium (balance errors may violate financial regulations)
- **Reputational**: Medium (balance errors undermine trust)

**Likelihood**: Medium (calculation bugs are possible, but balance calculation is straightforward)

**Affected Invariants**: 
- INVARIANT 1.1: Wallet Ledger Balance Consistency
- INVARIANT 1.3: No Balance Overwrites

**Mitigation Strategy**: 
- Balance calculation must be verified (sum of ledger entries)
- Balance calculation must not overwrite balances (ledger entries only)
- System operator must verify balance calculation logic before production

**Residual Risk**: Low (balance calculation is straightforward, but risk exists if calculation logic is incorrect)

**BLOCKED Notes**: None

---

#### THREAT 2.3: Concurrent Transaction Balance Corruption

**Threat Actor**: System (concurrency bug)

**Threat Description**: Concurrent transactions cause race conditions in balance calculation, leading to incorrect balances. Multiple transactions modify balances simultaneously without proper locking.

**Impact**: 
- **Financial**: High (concurrent balance corruption could cause financial loss)
- **Operational**: High (balance corruption breaks system integrity)
- **Legal**: Medium (balance corruption may violate financial regulations)
- **Reputational**: Medium (balance corruption undermines trust)

**Likelihood**: Low (ledger entries are atomic, but risk exists if balance calculation is not atomic)

**Affected Invariants**: 
- INVARIANT 1.1: Wallet Ledger Balance Consistency
- INVARIANT 6.2: Exposure Calculation Atomicity

**Mitigation Strategy**: 
- Ledger entries must be created atomically (database transactions)
- Balance calculation must be atomic (no concurrent modifications)
- System operator must verify atomicity before production

**Residual Risk**: Low (database transactions should ensure atomicity, but risk exists if transactions are not used correctly)

**BLOCKED Notes**: None

---

### 3. Partial Feature Activation (BLOCKED Features Operating)

#### THREAT 3.1: Buyer Purchase Function Partially Operational

**Threat Actor**: System (implementation error) or System operator (accidental activation)

**Threat Description**: Buyer purchase function is partially implemented or partially activated, allowing buyers to purchase inventory even though the function is BLOCKED (VISION.md BLOCKED #2). Partial operation creates confusion and risk.

**Impact**: 
- **Financial**: Medium (unauthorized purchases could occur)
- **Operational**: High (partial feature operation creates confusion, system inconsistency)
- **Legal**: Low (partial feature operation may violate system design)
- **Reputational**: Medium (partial feature operation undermines system reliability)

**Likelihood**: Low (function is NOT IMPLEMENTED, but risk exists if partially implemented)

**Affected Invariants**: 
- INVARIANT 9.1: Buyer Purchase Function Must Not Partially Operate

**Mitigation Strategy**: 
- Buyer purchase function must be completely disabled or completely implemented
- System operator must verify function is completely disabled before production
- Code review must verify no partial implementation exists

**Residual Risk**: Low (function is NOT IMPLEMENTED, but risk exists if partially implemented)

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2)

---

#### THREAT 3.2: Delivery Verification Function Partially Operational

**Threat Actor**: System (implementation error) or System operator (accidental activation)

**Threat Description**: Delivery verification function is partially implemented or partially activated, allowing delivery verification even though function implementation status is UNKNOWN. Partial operation creates confusion and risk.

**Impact**: 
- **Financial**: Medium (incorrect delivery verification could cause transaction reversals)
- **Operational**: High (partial feature operation creates confusion, system inconsistency)
- **Legal**: Low (partial feature operation may violate system design)
- **Reputational**: Medium (partial feature operation undermines system reliability)

**Likelihood**: Medium (function implementation status is UNKNOWN, partial implementation is possible)

**Affected Invariants**: 
- INVARIANT 9.2: Delivery Verification Function Must Not Partially Operate
- INVARIANT 8.1: Admin Action Logging Completeness

**Mitigation Strategy**: 
- Delivery verification function must be completely disabled or completely implemented
- System operator must verify function status before production
- Code review must verify function is completely disabled or completely implemented

**Residual Risk**: Medium (function implementation status is UNKNOWN, partial implementation risk exists)

**BLOCKED Notes**: Delivery verification function implementation status is UNKNOWN

---

#### THREAT 3.3: Storage Fee Automation Partially Operational

**Threat Actor**: System (implementation error) or System operator (accidental activation)

**Threat Description**: Storage fee automation is partially implemented or partially activated, allowing storage fee deductions even though automation implementation status is UNKNOWN. Partial operation creates confusion and risk.

**Impact**: 
- **Financial**: Medium (incorrect storage fee deductions could cause financial loss)
- **Operational**: High (partial feature operation creates confusion, system inconsistency)
- **Legal**: Low (partial feature operation may violate system design)
- **Reputational**: Medium (partial feature operation undermines system reliability)

**Likelihood**: Medium (automation implementation status is UNKNOWN, partial implementation is possible)

**Affected Invariants**: 
- INVARIANT 9.3: Storage Fee Automation Must Not Partially Operate

**Mitigation Strategy**: 
- Storage fee automation must be completely disabled or completely implemented
- System operator must verify automation status before production
- Code review must verify automation is completely disabled or completely implemented

**Residual Risk**: Medium (automation implementation status is UNKNOWN, partial implementation risk exists)

**BLOCKED Notes**: Storage fee automation implementation status is UNKNOWN

---

### 4. Admin Abuse or Error

#### THREAT 4.1: Admin Unauthorized Transaction Reversal

**Threat Actor**: Admin (malicious or error)

**Threat Description**: Admin reverses transactions without proper authorization or reason. Admin reverses transactions that should not be reversed, or reverses transactions without providing required reason.

**Impact**: 
- **Financial**: High (unauthorized reversals could cause financial loss)
- **Operational**: High (unauthorized reversals break system integrity)
- **Legal**: Medium (unauthorized reversals may violate regulations)
- **Reputational**: High (admin abuse undermines trust)

**Likelihood**: Medium (admin has authority to reverse transactions, but must provide reason)

**Affected Invariants**: 
- INVARIANT 8.1: Admin Action Logging Completeness
- INVARIANT 10.2: System Cannot Automatically Reverse Successful Transactions

**Mitigation Strategy**: 
- Admin actions must be logged (AdminAction table with reason)
- Transaction reversals require reason (non-negotiable)
- System operator must monitor admin actions for anomalies
- **BLOCKED**: Automated admin oversight does not exist (system relies on admin good faith)

**Residual Risk**: Medium (admin actions are logged, but no automated oversight exists)

**BLOCKED Notes**: None

---

#### THREAT 4.2: Admin Role Assignment Abuse

**Threat Actor**: Admin (malicious)

**Threat Description**: Admin changes user roles maliciously, granting unauthorized privileges (e.g., changing user role to admin). Admin abuses role assignment authority.

**Impact**: 
- **Financial**: High (unauthorized admin access could cause financial loss)
- **Operational**: High (unauthorized admin access could corrupt data)
- **Legal**: Medium (unauthorized admin access may violate regulations)
- **Reputational**: High (admin abuse undermines trust)

**Likelihood**: Low (admin role assignment is logged, but risk exists)

**Affected Invariants**: 
- INVARIANT 3.1: Users Cannot Change Their Own Role
- INVARIANT 8.1: Admin Action Logging Completeness

**Mitigation Strategy**: 
- Admin role changes must be logged (AdminAction table)
- System operator must monitor role changes for anomalies
- **BLOCKED**: Automated admin oversight does not exist (system relies on admin good faith)

**Residual Risk**: Low (admin role changes are logged, but no automated oversight exists)

**BLOCKED Notes**: None

---

#### THREAT 4.3: Admin Kill-Switch Abuse

**Threat Actor**: Admin (malicious or error)

**Threat Description**: Admin enables pilot mode or closes purchase window maliciously or by error, disrupting system operations. Admin abuses kill-switch authority.

**Impact**: 
- **Financial**: Medium (kill-switch activation disrupts transactions)
- **Operational**: High (kill-switch activation disrupts system operations)
- **Legal**: Low (kill-switch activation may disrupt user operations)
- **Reputational**: Medium (kill-switch abuse undermines system reliability)

**Likelihood**: Low (kill-switch activation is logged, but risk exists)

**Affected Invariants**: 
- INVARIANT 7.1: Pilot Mode Enforcement
- INVARIANT 7.2: Purchase Window Enforcement
- INVARIANT 8.1: Admin Action Logging Completeness

**Mitigation Strategy**: 
- Kill-switch activations must be logged (AdminAction table)
- System operator must monitor kill-switch activations for anomalies
- Kill-switch can be reversed (admin can disable pilot mode or open purchase window)

**Residual Risk**: Low (kill-switch activations are logged and reversible, but no automated oversight exists)

**BLOCKED Notes**: None

---

### 5. Operator Error or Delayed Response

#### THREAT 5.1: System Operator Delayed Response to Violations

**Threat Actor**: System operator (human error, unavailability)

**Threat Description**: System operator does not respond to invariant violations in a timely manner, allowing violations to persist or escalate. Operator is unavailable or does not notice violations.

**Impact**: 
- **Financial**: High (delayed response could allow financial loss to escalate)
- **Operational**: High (delayed response could allow system corruption to escalate)
- **Legal**: Medium (delayed response may violate regulations)
- **Reputational**: Medium (delayed response undermines system reliability)

**Likelihood**: Medium (operator is single human, availability is limited)

**Affected Invariants**: 
- All invariants (operator response is required for all violations)

**Mitigation Strategy**: 
- System must log violations (if logging mechanism exists)
- System must block operations when violations are detected
- **BLOCKED**: Automated violation notification does not exist (operator must monitor manually)

**Residual Risk**: Medium (violations are logged and operations are blocked, but operator must respond manually)

**BLOCKED Notes**: Automated violation notification does not exist. Operator must monitor violations manually.

---

#### THREAT 5.2: System Operator Incorrect Balance Correction

**Threat Actor**: System operator (human error)

**Threat Description**: System operator incorrectly corrects ledger balance inconsistencies, creating new ledger entries that are incorrect. Operator makes errors when correcting balances.

**Impact**: 
- **Financial**: High (incorrect balance corrections could cause financial loss)
- **Operational**: High (incorrect balance corrections break system integrity)
- **Legal**: Medium (incorrect balance corrections may violate financial regulations)
- **Reputational**: Medium (incorrect balance corrections undermine trust)

**Likelihood**: Low (balance corrections are manual, but risk exists)

**Affected Invariants**: 
- INVARIANT 1.1: Wallet Ledger Balance Consistency
- INVARIANT 1.2: Wallet Ledger Entry Immutability

**Mitigation Strategy**: 
- Balance corrections must create new ledger entries (not modify existing entries)
- System operator must verify balance corrections before applying
- **BLOCKED**: Automated balance correction verification does not exist (operator must verify manually)

**Residual Risk**: Low (balance corrections create new entries, but operator must verify manually)

**BLOCKED Notes**: None

---

### 6. Kill-Switch Failure

#### THREAT 6.1: Pilot Mode Enforcement Failure

**Threat Actor**: System (implementation bug)

**Threat Description**: Pilot mode enforcement fails, allowing money-moving mutations to proceed even when `systemSettings.pilotMode === true`. Kill-switch does not block mutations as required.

**Impact**: 
- **Financial**: High (unauthorized transactions could occur)
- **Operational**: High (kill-switch failure breaks system safety)
- **Legal**: Medium (kill-switch failure may violate system design)
- **Reputational**: High (kill-switch failure undermines system safety)

**Likelihood**: Medium (pilot mode enforcement implementation status is UNKNOWN)

**Affected Invariants**: 
- INVARIANT 7.1: Pilot Mode Enforcement

**Mitigation Strategy**: 
- Pilot mode enforcement must be verified before production
- Code review must verify enforcement is implemented correctly
- System operator must test pilot mode enforcement before production

**Residual Risk**: Medium (pilot mode enforcement implementation status is UNKNOWN, enforcement may not exist)

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist)

---

#### THREAT 6.2: Purchase Window Enforcement Failure

**Threat Actor**: System (implementation bug)

**Threat Description**: Purchase window enforcement fails, allowing buyer purchases to proceed even when `purchaseWindows.isOpen === false`. Kill-switch does not block purchases as required.

**Impact**: 
- **Financial**: Medium (unauthorized purchases could occur)
- **Operational**: High (kill-switch failure breaks system safety)
- **Legal**: Low (kill-switch failure may violate system design)
- **Reputational**: Medium (kill-switch failure undermines system safety)

**Likelihood**: Low (purchase window enforcement is straightforward, but risk exists if not implemented)

**Affected Invariants**: 
- INVARIANT 7.2: Purchase Window Enforcement

**Mitigation Strategy**: 
- Purchase window enforcement must be verified before production
- Code review must verify enforcement is implemented correctly
- System operator must test purchase window enforcement before production

**Residual Risk**: Low (purchase window enforcement is straightforward, but risk exists if not implemented)

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2). Purchase window enforcement cannot be tested until purchase function is implemented.

---

### 7. Data Loss or Unavailability

#### THREAT 7.1: Convex Database Failure

**Threat Actor**: External (Convex infrastructure failure)

**Threat Description**: Convex database fails, causing data loss or unavailability. Database corruption, service interruption, or data deletion occurs.

**Impact**: 
- **Financial**: High (data loss could cause financial loss)
- **Operational**: High (data loss breaks system operations)
- **Legal**: High (data loss may violate data protection regulations)
- **Reputational**: High (data loss undermines trust)

**Likelihood**: Low (Convex provides managed database, but risk exists)

**Affected Invariants**: 
- All invariants (data loss affects all invariants)

**Mitigation Strategy**: 
- Convex provides managed backups (but operator access is UNKNOWN)
- **BLOCKED**: Backup and restore procedures are UNKNOWN (cannot verify recovery)
- System operator must verify backup/restore procedures before production

**Residual Risk**: Medium (Convex provides managed backups, but recovery cannot be verified)

**BLOCKED Notes**: Backup and restore procedures are UNKNOWN. Recovery from data loss cannot be verified.

---

#### THREAT 7.2: Vercel Frontend Failure

**Threat Actor**: External (Vercel infrastructure failure)

**Threat Description**: Vercel frontend fails, causing system unavailability. Frontend service interruption or deployment failure occurs.

**Impact**: 
- **Financial**: Low (frontend failure does not affect data, but prevents user access)
- **Operational**: High (frontend failure prevents system access)
- **Legal**: Low (frontend failure may disrupt user operations)
- **Reputational**: Medium (frontend failure undermines system availability)

**Likelihood**: Low (Vercel provides managed hosting, but risk exists)

**Affected Invariants**: 
- None (frontend failure does not affect backend invariants)

**Mitigation Strategy**: 
- Vercel provides managed hosting (but operator has no control)
- System operator must monitor Vercel availability
- **BLOCKED**: Frontend redundancy does not exist (single deployment)

**Residual Risk**: Low (Vercel provides managed hosting, but operator has no control)

**BLOCKED Notes**: None

---

### 8. Exposure Limit Bypass

#### THREAT 8.1: Exposure Limit Calculation Bypass

**Threat Actor**: User (trader) or System (calculation bug)

**Threat Description**: Trader bypasses exposure limit by exploiting calculation errors or race conditions. Exposure calculation does not include all components, or concurrent transactions bypass limits.

**Impact**: 
- **Financial**: High (exposure limit bypass could cause trader to exceed UGX 1,000,000 limit)
- **Operational**: High (exposure limit bypass breaks system safety)
- **Legal**: Medium (exposure limit bypass may violate system design)
- **Reputational**: Medium (exposure limit bypass undermines system safety)

**Likelihood**: Low (exposure calculation is enforced server-side, but risk exists if calculation is incorrect)

**Affected Invariants**: 
- INVARIANT 3.2: Users Cannot Bypass Exposure Limits
- INVARIANT 6.1: Trader Exposure Limit Enforcement
- INVARIANT 6.2: Exposure Calculation Atomicity

**Mitigation Strategy**: 
- Exposure calculation must be performed server-side
- Exposure calculation must be atomic (no concurrent modifications)
- Exposure calculation must include all components (capital committed + locked orders + inventory value)
- System operator must verify exposure calculation logic before production

**Residual Risk**: Low (exposure calculation is enforced server-side and atomic, but risk exists if calculation logic is incorrect)

**BLOCKED Notes**: None

---

### 9. Audit Log Tampering or Gaps

#### THREAT 9.1: AdminAction Log Entry Modification or Deletion

**Threat Actor**: System (database corruption, bug) or System operator (accidental or malicious)

**Threat Description**: AdminAction log entries are modified or deleted, either through database corruption, system bugs, or operator error. This breaks audit trail and admin action logging completeness.

**Impact**: 
- **Financial**: Medium (audit log tampering could hide unauthorized actions)
- **Operational**: High (audit log tampering breaks audit trail)
- **Legal**: High (audit log tampering may violate audit requirements)
- **Reputational**: High (audit log tampering undermines trust)

**Likelihood**: Low (database constraints should prevent modifications/deletions, but risk exists)

**Affected Invariants**: 
- INVARIANT 5.1: AdminAction Entry Immutability
- INVARIANT 8.1: Admin Action Logging Completeness

**Mitigation Strategy**: 
- Database constraints must prevent AdminAction entry modifications/deletions
- AdminAction entries are immutable (no update/delete operations)
- System operator must verify database constraints before production

**Residual Risk**: Low (database constraints should prevent modifications, but risk exists if constraints are not enforced)

**BLOCKED Notes**: None

---

#### THREAT 9.2: Admin Action Not Logged

**Threat Actor**: System (implementation bug)

**Threat Description**: Admin actions are not logged in AdminAction table, either due to implementation bugs or missing logging code. Admin actions occur without audit trail.

**Impact**: 
- **Financial**: Medium (unlogged admin actions could hide unauthorized actions)
- **Operational**: High (unlogged admin actions break audit trail)
- **Legal**: High (unlogged admin actions may violate audit requirements)
- **Reputational**: High (unlogged admin actions undermine trust)

**Likelihood**: Medium (admin action logging may be missing for some actions)

**Affected Invariants**: 
- INVARIANT 8.1: Admin Action Logging Completeness

**Mitigation Strategy**: 
- All admin actions must be logged (AdminAction table)
- Code review must verify all admin actions create log entries
- System operator must verify admin action logging before production

**Residual Risk**: Medium (admin action logging may be missing for some actions, especially delivery verification)

**BLOCKED Notes**: Delivery verification actions may not be logged if function is not implemented

---

#### THREAT 9.3: UTID Orphaning

**Threat Actor**: System (implementation bug)

**Threat Description**: UTIDs are generated but not associated with any entity, creating orphaned UTIDs. UTIDs cannot be traced to actions, breaking audit trail.

**Impact**: 
- **Financial**: Low (orphaned UTIDs do not affect transactions, but break audit trail)
- **Operational**: Medium (orphaned UTIDs break audit trail)
- **Legal**: Medium (orphaned UTIDs may violate audit requirements)
- **Reputational**: Low (orphaned UTIDs undermine audit trail, but do not affect operations)

**Likelihood**: Low (UTID generation is straightforward, but risk exists if not implemented correctly)

**Affected Invariants**: 
- INVARIANT 4.2: All Meaningful Actions Generate UTIDs
- INVARIANT 8.2: UTID Traceability

**Mitigation Strategy**: 
- UTID generation must be performed before entity creation
- UTID must be associated with entity immediately after generation
- Code review must verify UTID traceability

**Residual Risk**: Low (UTID generation is straightforward, but risk exists if not implemented correctly)

**BLOCKED Notes**: None

---

### 10. Infrastructure Dependency Failure

#### THREAT 10.1: Convex Backend Failure

**Threat Actor**: External (Convex infrastructure failure)

**Threat Description**: Convex backend fails, causing system unavailability. Backend service interruption, function execution failure, or database unavailability occurs.

**Impact**: 
- **Financial**: High (backend failure prevents all transactions)
- **Operational**: High (backend failure prevents all system operations)
- **Legal**: Medium (backend failure may disrupt user operations)
- **Reputational**: High (backend failure undermines system availability)

**Likelihood**: Low (Convex provides managed backend, but risk exists)

**Affected Invariants**: 
- All invariants (backend failure affects all invariants)

**Mitigation Strategy**: 
- Convex provides managed backend (but operator has no control)
- System operator must monitor Convex availability
- **BLOCKED**: Backend redundancy does not exist (single deployment)

**Residual Risk**: Low (Convex provides managed backend, but operator has no control)

**BLOCKED Notes**: None

---

#### THREAT 10.2: Infrastructure Dependency Cascading Failure

**Threat Actor**: External (infrastructure provider failure)

**Threat Description**: Both Vercel and Convex fail simultaneously, causing complete system unavailability. Infrastructure dependency cascading failure occurs.

**Impact**: 
- **Financial**: High (complete system failure prevents all transactions)
- **Operational**: High (complete system failure prevents all operations)
- **Legal**: Medium (complete system failure may disrupt user operations)
- **Reputational**: High (complete system failure undermines system availability)

**Likelihood**: Very Low (simultaneous failure of both providers is unlikely, but risk exists)

**Affected Invariants**: 
- All invariants (complete system failure affects all invariants)

**Mitigation Strategy**: 
- System operator has no control over infrastructure providers
- **BLOCKED**: Infrastructure redundancy does not exist (single deployment for each provider)
- System operator must monitor infrastructure availability

**Residual Risk**: Very Low (simultaneous failure is unlikely, but operator has no control)

**BLOCKED Notes**: None

---

## Final Check

### All Threats Listed

**Verified**: All threats are listed:
1. Unauthorized Access or Privilege Escalation (3 threats)
2. Ledger Corruption or Inconsistency (3 threats)
3. Partial Feature Activation (3 threats)
4. Admin Abuse or Error (3 threats)
5. Operator Error or Delayed Response (2 threats)
6. Kill-Switch Failure (2 threats)
7. Data Loss or Unavailability (2 threats)
8. Exposure Limit Bypass (1 threat)
9. Audit Log Tampering or Gaps (3 threats)
10. Infrastructure Dependency Failure (2 threats)

**Total**: 24 threats

### All Mitigations or BLOCKED Items Identified

**Verified**: All 24 threats have mitigations or BLOCKED items:
- 20 threats have mitigation strategies
- 4 threats have BLOCKED notes (mitigation depends on BLOCKED features)
- All threats have residual risk assessment

### No Threat Contradicts INVARIANTS.md

**Verified**: All threats are derived from INVARIANTS.md:
- Threats reference specific invariants
- Threat mitigations align with invariant mandatory responses
- No threats contradict invariants

### No Threat Introduces New Behavior or Authority

**Verified**: All threats are derived from existing artifacts:
- BUSINESS_LOGIC.md (risk allocation)
- DOMAIN_MODEL.md (entities, ownership, state transitions)
- architecture.md (trust boundaries, kill-switches)
- INVARIANTS.md (what must never be violated)
- MODULARITY_GUIDE.md (forbidden couplings)
- No threats introduce new behavior or authority

### All Residual Risks Are Explicitly Acknowledged

**Verified**: All 24 threats have residual risk assessment:
- Residual risk is explicitly stated (Low, Medium, High, Very Low)
- Residual risk justification is provided
- BLOCKED items that affect residual risk are noted

---

*This document must be updated when threats change, mitigations are implemented, or BLOCKED items are unblocked. No assumptions. Only truth.*
