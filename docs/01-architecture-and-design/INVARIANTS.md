# INVARIANTS.md

**Production System Invariants**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- BUSINESS_LOGIC.md defines irreversible actions and risk allocation
- DOMAIN_MODEL.md defines entities, ownership, and state transitions
- architecture.md defines trust boundaries and kill-switches
- MODULARITY_GUIDE.md defines forbidden couplings and re-authorization triggers
- Invariants are derived strictly from these artifacts (no new goals, features, or authority)

---

## Invariant Categories

### 1. Money Conservation (Ledger Correctness)

#### INVARIANT 1.1: Wallet Ledger Balance Consistency

**Description**: For any trader, the current capital balance must equal the sum of all `capital_deposit` entries minus the sum of all `capital_lock` entries plus the sum of all `capital_unlock` entries. The current profit balance must equal the sum of all `profit_credit` entries minus the sum of all `profit_withdrawal` entries.

**Why This Invariant Exists**: Ledger correctness is critical for financial integrity. Balance inconsistencies indicate data corruption or calculation errors.

**How Violation Is Detected**: 
- Calculate balance from ledger entries: `sum(deposits) - sum(locks) + sum(unlocks)`
- Compare calculated balance to stored `balanceAfter` in most recent ledger entry
- If mismatch, violation detected

**Mandatory System Response**: 
- **Immediate**: Block all wallet operations for affected trader
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and correct balance
- **Required**: System operator must verify ledger integrity before re-enabling wallet operations

**Authority Required**: System operator (to investigate and correct)

**Reversibility Impact**: Balance corrections may require manual ledger entries (creates new entries, does not modify existing entries)

**BLOCKED Notes**: None

---

#### INVARIANT 1.2: Wallet Ledger Entry Immutability

**Description**: Once a WalletLedger entry is created, it cannot be modified or deleted. The entry's `utid`, `type`, `amount`, `balanceAfter`, and `timestamp` fields are immutable.

**Why This Invariant Exists**: Ledger immutability is critical for auditability. Modifying or deleting ledger entries would break the audit trail.

**How Violation Is Detected**: 
- Check if any WalletLedger entry has been modified (compare current state to creation state)
- Check if any WalletLedger entry has been deleted (compare entry count to expected count)
- Database constraints should prevent modifications/deletions

**Mandatory System Response**: 
- **Immediate**: Block all wallet operations system-wide
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify ledger integrity
- **Required**: System operator must verify database constraints before re-enabling wallet operations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If ledger entries are modified or deleted, audit trail is compromised. Recovery may not be possible.

**BLOCKED Notes**: None

---

#### INVARIANT 1.3: No Balance Overwrites

**Description**: Wallet balances must never be overwritten. Balances are calculated from ledger entries only. No direct balance field updates are allowed.

**Why This Invariant Exists**: Balance overwrites would break ledger integrity. Ledger entries are the source of truth.

**How Violation Is Detected**: 
- Check if any mutation directly updates a balance field (if such fields exist)
- Check if balance calculation bypasses ledger entries
- Code review and database constraints should prevent overwrites

**Mandatory System Response**: 
- **Immediate**: Block all wallet operations system-wide
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify ledger integrity
- **Required**: System operator must verify code constraints before re-enabling wallet operations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If balances are overwritten, ledger integrity is compromised. Recovery may require manual ledger entry corrections.

**BLOCKED Notes**: None

---

### 2. Authorization Boundaries

#### INVARIANT 2.1: Server-Side Authorization Enforcement

**Description**: All authorization checks must be performed server-side (in Convex backend). Frontend cannot bypass authorization. All mutations require server-side authorization verification.

**Why This Invariant Exists**: Client-side authorization can be bypassed. Server-side enforcement is the only trusted authorization boundary.

**How Violation Is Detected**: 
- Check if any mutation lacks server-side authorization check
- Check if frontend performs authorization checks (frontend should not perform authorization)
- Code review should verify all mutations check authorization server-side

**Mandatory System Response**: 
- **Immediate**: Block affected mutations until authorization is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify authorization is added before re-enabling mutations

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If authorization is bypassed, unauthorized actions may have occurred. System operator must investigate and potentially reverse unauthorized actions.

**BLOCKED Notes**: None

---

#### INVARIANT 2.2: Admin Role Verification

**Description**: All admin actions must verify that the acting user has `role === "admin"` (verified server-side). Admin actions include: delivery verification, transaction reversal, purchase window control, pilot mode control, user role changes.

**Why This Invariant Exists**: Admin actions have significant authority. Unauthorized admin actions could harm users or compromise system integrity.

**How Violation Is Detected**: 
- Check if any admin action mutation lacks role verification
- Check if role verification is performed server-side
- Code review should verify all admin actions check role server-side

**Mandatory System Response**: 
- **Immediate**: Block affected admin actions until role verification is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify role verification is added before re-enabling admin actions

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If admin actions are performed without role verification, unauthorized actions may have occurred. System operator must investigate and potentially reverse unauthorized actions.

**BLOCKED Notes**: Delivery verification function implementation status is UNKNOWN (may not be implemented)

---

#### INVARIANT 2.3: Frontend Cannot Bypass Authorization

**Description**: Frontend (Next.js) cannot bypass backend authorization. All user actions must go through backend mutations that enforce authorization.

**Why This Invariant Exists**: Frontend is untrusted. Authorization bypass would allow unauthorized actions.

**How Violation Is Detected**: 
- Check if frontend performs authorization checks (frontend should not perform authorization)
- Check if frontend directly accesses data without going through backend (frontend should only access data via backend queries)
- Code review should verify frontend does not perform authorization

**Mandatory System Response**: 
- **Immediate**: Block affected frontend features until authorization bypass is removed
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify authorization bypass is removed before re-enabling features

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If frontend bypasses authorization, unauthorized actions may have occurred. System operator must investigate and potentially reverse unauthorized actions.

**BLOCKED Notes**: None

---

### 3. Role and Authority Separation

#### INVARIANT 3.1: Users Cannot Change Their Own Role

**Description**: Users cannot change their own role. Only admin can change user roles. Users cannot modify the `role` field of their own User entity.

**Why This Invariant Exists**: Role changes affect authorization. Users changing their own roles would allow privilege escalation.

**How Violation Is Detected**: 
- Check if any mutation allows users to change their own role
- Check if role change mutations verify that acting user is admin
- Code review should verify role changes require admin authorization

**Mandatory System Response**: 
- **Immediate**: Block affected role change mutations until admin authorization is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify admin authorization is added before re-enabling role changes

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If users change their own roles, privilege escalation may have occurred. System operator must investigate and potentially reverse role changes.

**BLOCKED Notes**: None

---

#### INVARIANT 3.2: Users Cannot Bypass Exposure Limits

**Description**: Traders cannot bypass the UGX 1,000,000 exposure limit. Exposure calculation must be enforced server-side. Exposure includes: capital committed + locked orders + inventory value.

**Why This Invariant Exists**: Exposure limits protect traders from excessive risk. Bypassing limits would expose traders to unmanaged risk.

**How Violation Is Detected**: 
- Check if exposure calculation is performed server-side
- Check if unit lock mutations verify exposure limit before locking
- Check if exposure calculation includes all components (capital committed + locked orders + inventory value)
- Code review should verify exposure limits are enforced server-side

**Mandatory System Response**: 
- **Immediate**: Block affected unit lock mutations until exposure limit enforcement is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify exposure limit enforcement is added before re-enabling unit locks

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If exposure limits are bypassed, traders may have exceeded limits. System operator must investigate and potentially reverse transactions that exceed limits.

**BLOCKED Notes**: None

---

#### INVARIANT 3.3: Admin Cannot Access User Real Identities

**Description**: Admin cannot access user real identities (email addresses are not considered real identities for this purpose). Admin can only access system-generated aliases. Anonymity must be preserved.

**Why This Invariant Exists**: Anonymity is a core system principle. Admin accessing real identities would violate user privacy.

**How Violation Is Detected**: 
- Check if admin queries return real identities (admin should only see aliases)
- Check if admin mutations accept real identities as input (admin should only work with aliases)
- Code review should verify admin cannot access real identities

**Mandatory System Response**: 
- **Immediate**: Block affected admin queries/mutations until real identity access is removed
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify real identity access is removed before re-enabling admin features

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If admin accesses real identities, user privacy is compromised. System operator must investigate and verify anonymity is restored.

**BLOCKED Notes**: None

---

### 4. UTID Immutability

#### INVARIANT 4.1: UTID Immutability

**Description**: Once a UTID is generated, it cannot be modified or deleted. UTIDs are immutable and cannot be changed.

**Why This Invariant Exists**: UTIDs are used for auditability and traceability. Modifying or deleting UTIDs would break the audit trail.

**How Violation Is Detected**: 
- Check if any UTID has been modified (compare current UTID to original UTID)
- Check if any UTID has been deleted (compare UTID count to expected count)
- Database constraints should prevent UTID modifications/deletions

**Mandatory System Response**: 
- **Immediate**: Block all operations that generate or use UTIDs until UTID immutability is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify UTID immutability before re-enabling operations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If UTIDs are modified or deleted, audit trail is compromised. Recovery may not be possible.

**BLOCKED Notes**: None

---

#### INVARIANT 4.2: All Meaningful Actions Generate UTIDs

**Description**: All meaningful actions must generate or reference a UTID. Meaningful actions include: listing creation, capital deposit, unit lock, transaction reversal, profit withdrawal, purchase creation, admin actions.

**Why This Invariant Exists**: UTIDs provide auditability and traceability. Actions without UTIDs cannot be audited.

**How Violation Is Detected**: 
- Check if all meaningful action mutations generate or reference UTIDs
- Check if UTID generation is performed before action completion
- Code review should verify all meaningful actions generate UTIDs

**Mandatory System Response**: 
- **Immediate**: Block affected actions until UTID generation is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify UTID generation is added before re-enabling actions

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If actions occur without UTIDs, audit trail is incomplete. System operator must investigate and potentially add UTIDs retroactively (if possible).

**BLOCKED Notes**: None

---

### 5. Ledger Immutability

#### INVARIANT 5.1: AdminAction Entry Immutability

**Description**: Once an AdminAction entry is created, it cannot be modified or deleted. The entry's `adminId`, `actionType`, `utid`, `reason`, `targetUtid`, and `timestamp` fields are immutable.

**Why This Invariant Exists**: Admin action logs are critical for auditability. Modifying or deleting admin action logs would break the audit trail.

**How Violation Is Detected**: 
- Check if any AdminAction entry has been modified (compare current state to creation state)
- Check if any AdminAction entry has been deleted (compare entry count to expected count)
- Database constraints should prevent modifications/deletions

**Mandatory System Response**: 
- **Immediate**: Block all admin actions until AdminAction immutability is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify AdminAction immutability before re-enabling admin actions

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If AdminAction entries are modified or deleted, audit trail is compromised. Recovery may not be possible.

**BLOCKED Notes**: Delivery verification actions may not be logged if function is not implemented

---

#### INVARIANT 5.2: StorageFeeDeduction Entry Immutability

**Description**: Once a StorageFeeDeduction entry is created, it cannot be modified or deleted. The entry's `inventoryId`, `traderId`, `kilosDeducted`, `ratePerDay`, `daysStored`, `deductionUtid`, and `timestamp` fields are immutable.

**Why This Invariant Exists**: Storage fee deduction logs are critical for auditability. Modifying or deleting storage fee deduction logs would break the audit trail.

**How Violation Is Detected**: 
- Check if any StorageFeeDeduction entry has been modified (compare current state to creation state)
- Check if any StorageFeeDeduction entry has been deleted (compare entry count to expected count)
- Database constraints should prevent modifications/deletions

**Mandatory System Response**: 
- **Immediate**: Block all storage fee operations until StorageFeeDeduction immutability is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify StorageFeeDeduction immutability before re-enabling storage fee operations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If StorageFeeDeduction entries are modified or deleted, audit trail is compromised. Recovery may not be possible.

**BLOCKED Notes**: Storage fee automation implementation status is UNKNOWN (entries may not be created automatically)

---

#### INVARIANT 5.3: RateLimitHit Entry Immutability

**Description**: Once a RateLimitHit entry is created, it cannot be modified or deleted. The entry's `userId`, `userRole`, `actionType`, `limitType`, `limitValue`, `attemptedAt`, `windowStart`, `windowEnd`, `currentCount`, and `metadata` fields are immutable.

**Why This Invariant Exists**: Rate limit violation logs are critical for auditability. Modifying or deleting rate limit violation logs would break the audit trail.

**How Violation Is Detected**: 
- Check if any RateLimitHit entry has been modified (compare current state to creation state)
- Check if any RateLimitHit entry has been deleted (compare entry count to expected count)
- Database constraints should prevent modifications/deletions

**Mandatory System Response**: 
- **Immediate**: Block all rate-limited operations until RateLimitHit immutability is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify RateLimitHit immutability before re-enabling rate-limited operations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If RateLimitHit entries are modified or deleted, audit trail is compromised. Recovery may not be possible.

**BLOCKED Notes**: None

---

### 6. Exposure Limits

#### INVARIANT 6.1: Trader Exposure Limit Enforcement

**Description**: Trader exposure must never exceed UGX 1,000,000. Exposure calculation must be performed server-side before unit lock. Unit lock mutations must fail if exposure would exceed limit.

**Why This Invariant Exists**: Exposure limits protect traders from excessive risk. Exceeding limits would expose traders to unmanaged risk.

**How Violation Is Detected**: 
- Check if exposure calculation is performed server-side before unit lock
- Check if unit lock mutations verify exposure limit before locking
- Check if exposure calculation includes all components (capital committed + locked orders + inventory value)
- Check if any trader has exposure exceeding UGX 1,000,000

**Mandatory System Response**: 
- **Immediate**: Block all unit lock mutations for affected trader until exposure is below limit
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify exposure limit enforcement before re-enabling unit locks

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If exposure limits are exceeded, traders may have unmanaged risk. System operator must investigate and potentially reverse transactions that exceed limits.

**BLOCKED Notes**: None

---

#### INVARIANT 6.2: Exposure Calculation Atomicity

**Description**: Exposure calculation must be atomic. Exposure must be calculated and verified in the same transaction as unit lock. Exposure calculation cannot be bypassed by concurrent transactions.

**Why This Invariant Exists**: Non-atomic exposure calculation could allow concurrent transactions to bypass limits. Atomicity ensures limits are enforced correctly.

**How Violation Is Detected**: 
- Check if exposure calculation and unit lock are performed in the same transaction
- Check if exposure calculation is performed before unit lock (not after)
- Code review should verify atomicity of exposure calculation and unit lock

**Mandatory System Response**: 
- **Immediate**: Block all unit lock mutations until atomicity is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify atomicity before re-enabling unit locks

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If exposure calculation is not atomic, limits may have been bypassed. System operator must investigate and potentially reverse transactions that bypass limits.

**BLOCKED Notes**: None

---

### 7. Kill-Switch Enforcement

#### INVARIANT 7.1: Pilot Mode Enforcement

**Description**: When `systemSettings.pilotMode === true`, all money-moving mutations must be blocked. Money-moving mutations include: capital deposits, capital locks, profit withdrawals, unit locks (pay-to-lock). Enforcement must be server-side.

**Why This Invariant Exists**: Pilot mode is a kill-switch. If pilot mode does not block money-moving mutations, the kill-switch is ineffective.

**How Violation Is Detected**: 
- Check if pilot mode status is checked server-side before money-moving mutations
- Check if money-moving mutations fail when pilot mode is enabled
- Check if any money-moving mutations succeed when pilot mode is enabled

**Mandatory System Response**: 
- **Immediate**: Block all money-moving mutations until pilot mode enforcement is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify pilot mode enforcement before re-enabling money-moving mutations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If pilot mode does not block money-moving mutations, unauthorized transactions may have occurred. System operator must investigate and potentially reverse unauthorized transactions.

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist)

---

#### INVARIANT 7.2: Purchase Window Enforcement

**Description**: When `purchaseWindows.isOpen === false`, all buyer purchase mutations must be blocked. Enforcement must be server-side.

**Why This Invariant Exists**: Purchase window is a kill-switch. If purchase window does not block buyer purchases, the kill-switch is ineffective.

**How Violation Is Detected**: 
- Check if purchase window status is checked server-side before buyer purchase mutations
- Check if buyer purchase mutations fail when purchase window is closed
- Check if any buyer purchase mutations succeed when purchase window is closed

**Mandatory System Response**: 
- **Immediate**: Block all buyer purchase mutations until purchase window enforcement is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify purchase window enforcement before re-enabling buyer purchases

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If purchase window does not block buyer purchases, unauthorized purchases may have occurred. System operator must investigate and potentially reverse unauthorized purchases.

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2)

---

### 8. Audit Log Completeness

#### INVARIANT 8.1: Admin Action Logging Completeness

**Description**: All admin actions must be logged in AdminAction table. Admin actions include: delivery verification, transaction reversal, purchase window control, pilot mode control, user role changes. Each log entry must include: adminId, actionType, utid, reason, targetUtid (if applicable), timestamp.

**Why This Invariant Exists**: Admin action logs are critical for auditability. Missing logs break the audit trail.

**How Violation Is Detected**: 
- Check if all admin action mutations create AdminAction log entries
- Check if AdminAction log entries include all required fields
- Check if AdminAction log entries are created before action completion

**Mandatory System Response**: 
- **Immediate**: Block affected admin actions until logging is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify logging is added before re-enabling admin actions

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If admin actions occur without logging, audit trail is incomplete. System operator must investigate and potentially add logs retroactively (if possible).

**BLOCKED Notes**: Delivery verification actions may not be logged if function is not implemented

---

#### INVARIANT 8.2: UTID Traceability

**Description**: All UTIDs must be traceable. Every UTID must be associated with at least one entity (WalletLedger entry, Listing, ListingUnit, TraderInventory, BuyerPurchase, AdminAction, etc.). UTIDs cannot be orphaned.

**Why This Invariant Exists**: UTID traceability is critical for auditability. Orphaned UTIDs break the audit trail.

**How Violation Is Detected**: 
- Check if all UTIDs are associated with at least one entity
- Check if UTID references are valid (no broken references)
- Check if UTID generation is performed before entity creation

**Mandatory System Response**: 
- **Immediate**: Block affected operations until UTID traceability is verified
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must investigate and verify UTID traceability before re-enabling operations

**Authority Required**: System operator (to investigate and verify)

**Reversibility Impact**: If UTIDs are orphaned, audit trail is incomplete. System operator must investigate and potentially associate UTIDs retroactively (if possible).

**BLOCKED Notes**: None

---

### 9. BLOCKED Feature Enforcement

#### INVARIANT 9.1: Buyer Purchase Function Must Not Partially Operate

**Description**: Buyer purchase function is BLOCKED (VISION.md BLOCKED #2). The function must not be partially implemented or partially operational. If any buyer purchase functionality exists, it must be completely disabled or completely implemented.

**Why This Invariant Exists**: Partially implemented features create confusion and risk. BLOCKED features must not operate at all.

**How Violation Is Detected**: 
- Check if buyer purchase mutations exist (they should not exist or should be completely disabled)
- Check if buyer purchase mutations are callable (they should not be callable)
- Check if buyer purchase UI exists (it should not exist or should be completely disabled)

**Mandatory System Response**: 
- **Immediate**: Block all buyer purchase functionality until it is completely disabled or completely implemented
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify buyer purchase functionality is completely disabled or completely implemented before re-enabling

**Authority Required**: System operator (to verify and authorize)

**Reversibility Impact**: If buyer purchase function is partially operational, unauthorized purchases may have occurred. System operator must investigate and potentially reverse unauthorized purchases.

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2)

---

#### INVARIANT 9.2: Delivery Verification Function Must Not Partially Operate

**Description**: Delivery verification function implementation status is UNKNOWN. If the function exists, it must be completely implemented or completely disabled. The function must not be partially operational.

**Why This Invariant Exists**: Partially implemented features create confusion and risk. UNKNOWN features must be verified before operation.

**How Violation Is Detected**: 
- Check if delivery verification mutations exist (they should not exist or should be completely implemented)
- Check if delivery verification mutations are callable (they should not be callable or should be completely implemented)
- Check if delivery verification UI exists (it should not exist or should be completely implemented)

**Mandatory System Response**: 
- **Immediate**: Block all delivery verification functionality until it is completely disabled or completely implemented
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify delivery verification functionality is completely disabled or completely implemented before re-enabling

**Authority Required**: System operator (to verify and authorize)

**Reversibility Impact**: If delivery verification function is partially operational, unauthorized verifications may have occurred. System operator must investigate and potentially reverse unauthorized verifications.

**BLOCKED Notes**: Delivery verification function implementation status is UNKNOWN

---

#### INVARIANT 9.3: Storage Fee Automation Must Not Partially Operate

**Description**: Storage fee automation implementation status is UNKNOWN. If automation exists, it must be completely implemented or completely disabled. Automation must not be partially operational.

**Why This Invariant Exists**: Partially implemented features create confusion and risk. UNKNOWN features must be verified before operation.

**How Violation Is Detected**: 
- Check if storage fee automation exists (it should not exist or should be completely implemented)
- Check if storage fee automation is active (it should not be active or should be completely implemented)
- Check if storage fee automation creates StorageFeeDeduction entries (it should not create entries or should create entries correctly)

**Mandatory System Response**: 
- **Immediate**: Block all storage fee automation until it is completely disabled or completely implemented
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify storage fee automation is completely disabled or completely implemented before re-enabling

**Authority Required**: System operator (to verify and authorize)

**Reversibility Impact**: If storage fee automation is partially operational, incorrect fees may have been deducted. System operator must investigate and potentially reverse incorrect deductions.

**BLOCKED Notes**: Storage fee automation implementation status is UNKNOWN

---

### 10. No Autonomous Irreversible Actions

#### INVARIANT 10.1: System Cannot Make Autonomous Decisions Without Human Authorization

**Description**: System cannot make autonomous decisions without human authorization. All decisions require explicit human authorization. System cannot proceed without explicit authorization gates.

**Why This Invariant Exists**: Autonomous decisions without human authorization violate the single-human authority model. System must always require human authorization for decisions.

**How Violation Is Detected**: 
- Check if any mutations make autonomous decisions without human authorization
- Check if any mutations proceed without explicit authorization gates
- Code review should verify all decisions require human authorization

**Mandatory System Response**: 
- **Immediate**: Block affected mutations until human authorization is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify human authorization is added before re-enabling mutations

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If system makes autonomous decisions, unauthorized actions may have occurred. System operator must investigate and potentially reverse unauthorized actions.

**BLOCKED Notes**: None

---

#### INVARIANT 10.2: System Cannot Automatically Reverse Successful Transactions

**Description**: System cannot automatically reverse successful transactions. Transaction reversals require admin authorization. System cannot reverse transactions without admin authorization.

**Why This Invariant Exists**: Transaction reversals are irreversible actions. Automatic reversals would violate the single-human authority model.

**How Violation Is Detected**: 
- Check if any mutations automatically reverse successful transactions
- Check if transaction reversals require admin authorization
- Code review should verify reversals require admin authorization

**Mandatory System Response**: 
- **Immediate**: Block affected reversal mutations until admin authorization is added
- **Immediate**: Log violation in system (if logging mechanism exists)
- **Required**: System operator must be notified
- **Required**: System operator must verify admin authorization is added before re-enabling reversals

**Authority Required**: System operator (to verify and authorize fixes)

**Reversibility Impact**: If system automatically reverses transactions, unauthorized reversals may have occurred. System operator must investigate and potentially reverse unauthorized reversals (if possible).

**BLOCKED Notes**: None

---

## Final Check

### All Invariants Listed

**Verified**: All invariants are listed:
1. Money Conservation (3 invariants)
2. Authorization Boundaries (3 invariants)
3. Role and Authority Separation (3 invariants)
4. UTID Immutability (2 invariants)
5. Ledger Immutability (3 invariants)
6. Exposure Limits (2 invariants)
7. Kill-Switch Enforcement (2 invariants)
8. Audit Log Completeness (2 invariants)
9. BLOCKED Feature Enforcement (3 invariants)
10. No Autonomous Irreversible Actions (2 invariants)

**Total**: 25 invariants

### No Invariant Contradicts DOMAIN_MODEL.md

**Verified**: All invariants are derived from DOMAIN_MODEL.md:
- Entity ownership matches DOMAIN_MODEL.md
- State transitions match DOMAIN_MODEL.md
- Entity immutability matches DOMAIN_MODEL.md
- No invariants contradict DOMAIN_MODEL.md

### No Invariant Introduces New Behavior

**Verified**: All invariants are derived from existing artifacts:
- BUSINESS_LOGIC.md (irreversible actions, risk allocation)
- DOMAIN_MODEL.md (entities, ownership, state transitions)
- architecture.md (trust boundaries, kill-switches)
- MODULARITY_GUIDE.md (forbidden couplings, re-authorization triggers)
- No invariants introduce new behavior

### All Violations Have Mandatory Responses

**Verified**: All 25 invariants have mandatory system responses:
- Immediate actions (block operations, log violations)
- Required actions (system operator notification, investigation, verification)
- Authority requirements specified
- Reversibility impact specified

### All BLOCKED Invariants Are Explicitly Marked

**Verified**: All BLOCKED invariants are explicitly marked:
1. INVARIANT 2.2: Delivery verification function implementation status is UNKNOWN
2. INVARIANT 5.1: Delivery verification actions may not be logged if function is not implemented
3. INVARIANT 5.2: Storage fee automation implementation status is UNKNOWN
4. INVARIANT 7.1: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist)
5. INVARIANT 7.2: Buyer purchase function is NOT IMPLEMENTED
6. INVARIANT 8.1: Delivery verification actions may not be logged if function is not implemented
7. INVARIANT 9.1: Buyer purchase function is NOT IMPLEMENTED
8. INVARIANT 9.2: Delivery verification function implementation status is UNKNOWN
9. INVARIANT 9.3: Storage fee automation implementation status is UNKNOWN

---

*This document must be updated when invariants change, BLOCKED items are unblocked, or new invariants are discovered. No assumptions. Only truth.*
