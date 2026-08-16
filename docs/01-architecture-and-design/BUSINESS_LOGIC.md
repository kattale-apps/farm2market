# BUSINESS_LOGIC.md

**Production System Business Logic**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: VISION.md exists but contains unresolved BLOCKED items. This document proceeds with explicit assumptions where necessary.

---

## 1. Scope and Assumptions

### Explicit Assumptions

**ASSUMPTION 1: User Voluntary Participation**
- **Assumption**: All users (farmers, traders, buyers) voluntarily choose to use the system
- **Reason**: Required for ethical operation. System cannot verify coercion status.
- **Scope**: Applies to all user actions. If coercion is detected, system operation is BLOCKED.
- **Revocability**: If coercion is detected, system must suspend affected users immediately.

**ASSUMPTION 2: Admin Acts in Good Faith**
- **Assumption**: Admin (single human authority) acts in good faith and makes decisions based on available information
- **Reason**: System requires admin for dispute resolution. No automated verification of admin decisions exists.
- **Scope**: Applies to all admin decisions. No appeals process exists.
- **Revocability**: If admin abuse is detected, system operation is BLOCKED until admin authority is reviewed.

**ASSUMPTION 3: Physical Delivery Capability**
- **Assumption**: Farmers have physical capability to deliver produce within 6 hours after payment
- **Reason**: System defines 6-hour delivery SLA but cannot verify physical capability before listing creation.
- **Scope**: Applies to farmer listing creation. System does not verify delivery capability.
- **Revocability**: If delivery capability cannot be verified, listing creation may be BLOCKED.

**ASSUMPTION 4: Physical Pickup Capability**
- **Assumption**: Buyers have physical capability to pick up produce within 48 hours after purchase
- **Reason**: System defines 48-hour pickup SLA but cannot verify physical capability before purchase.
- **Scope**: Applies to buyer purchase actions. System does not verify pickup capability.
- **Revocability**: If pickup capability cannot be verified, purchase may be BLOCKED.

**ASSUMPTION 5: Closed-Loop Wallet Acceptance**
- **Assumption**: Traders accept that wallet funds remain within the platform (no external withdrawal to bank accounts)
- **Reason**: System is closed-loop ledger. External withdrawal mechanism status is UNKNOWN.
- **Scope**: Applies to trader capital deposits. Profit withdrawal mechanism exists but external transfer status is UNKNOWN.
- **Revocability**: If external withdrawal is required, system operation may be BLOCKED until mechanism is implemented.

**ASSUMPTION 6: Produce Quality Standards**
- **Assumption**: Farmers list produce that meets basic quality standards acceptable to traders
- **Reason**: System does not verify produce quality before listing creation.
- **Scope**: Applies to farmer listing creation. Quality disputes resolved by admin only.
- **Revocability**: If quality standards cannot be enforced, listing creation may be BLOCKED.

**ASSUMPTION 7: Uganda Jurisdiction Acceptance**
- **Assumption**: All users accept that system operates under Uganda jurisdiction and regulations
- **Reason**: VISION.md specifies Uganda but detailed legal compliance is BLOCKED.
- **Scope**: Applies to all user actions. Legal enforceability is UNKNOWN.
- **Revocability**: If legal compliance cannot be verified, system operation is BLOCKED.

### BLOCKED Areas (Depend on Unresolved VISION Items)

**BLOCKED 1: Production Authentication**
- **Blocked By**: VISION.md BLOCKED item #1 (Production Authentication NOT IMPLEMENTED)
- **Impact**: User authentication workflow cannot be fully specified for production
- **Current State**: Pilot mode uses shared password. Production authentication workflow is BLOCKED.

**BLOCKED 2: Buyer Purchase Workflow**
- **Blocked By**: VISION.md BLOCKED item #2 (Buyer Purchase Function NOT IMPLEMENTED)
- **Impact**: Complete buyer purchase workflow cannot be specified
- **Current State**: Purchase window check exists. Purchase function does not. Workflow is BLOCKED.

**BLOCKED 3: Legal Framework**
- **Blocked By**: VISION.md BLOCKED item #3 (Legal Review NOT COMPLETED)
- **Impact**: Legal enforceability of transactions, disputes, and admin decisions is UNKNOWN
- **Current State**: System operates without verified legal framework. Legal risk allocation is BLOCKED.

**BLOCKED 4: Terms of Service**
- **Blocked By**: VISION.md BLOCKED item #4 (Terms of Service & User Agreements NOT COMPLETED)
- **Impact**: User consent framework and liability allocation cannot be fully specified
- **Current State**: No explicit user agreements exist. Consent workflow is BLOCKED.

**BLOCKED 5: Delivery Verification Workflow**
- **Blocked By**: VISION.md UNKNOWN item (Delivery Verification Function implementation status UNKNOWN)
- **Impact**: Complete delivery verification workflow cannot be specified
- **Current State**: Admin can verify deliveries, but function implementation status is UNKNOWN.

**BLOCKED 6: Storage Fee Automation**
- **Blocked By**: VISION.md UNKNOWN item (Storage Fee Automation implementation status UNKNOWN)
- **Impact**: Complete storage fee workflow cannot be specified
- **Current State**: Storage fees defined (0.5 kg/day per 100kg block) but automation status is UNKNOWN.

**BLOCKED 7: Profit Withdrawal External Transfer**
- **Blocked By**: VISION.md UNKNOWN item (Profit Withdrawal Mechanism external transfer status UNKNOWN)
- **Impact**: Complete profit withdrawal workflow cannot be specified
- **Current State**: Profit withdrawal from ledger exists. External transfer to bank account status is UNKNOWN.

---

## 2. Core Workflows

### Workflow 1: User Account Creation

**Entry Conditions**:
- User provides email address
- User provides password (pilot: shared password `Farm2Market2024`)
- User role inferred from email prefix or explicitly specified

**Process**:
1. System validates email format
2. System checks if user exists
3. If user does not exist, system creates user account
4. **TEMPORARY / BLOCKED FOR PRODUCTION**: System infers role from email prefix:
   - `admin*` → admin
   - `farmer*` → farmer
   - `trader*` → trader
   - Everything else → buyer
   - **Note**: Role inference introduces privilege escalation risk, account spoofing risk, and audit ambiguity. This workflow is acceptable for pilot mode but is BLOCKED for production. In production, roles must be explicit state, not inferred behavior.
5. System generates alias automatically
6. System stores user with role and alias

**Exit Conditions**:
- User account created with role and alias
- User can log in using email and password

**Human Authorization Points**:
- None (automated account creation)

**BLOCKED States**:
- **BLOCKED**: Production authentication not implemented. Account creation workflow for production is BLOCKED until production authentication is implemented.
- **BLOCKED FOR PRODUCTION**: Role inference from email prefix is BLOCKED for production. Production must use explicit role assignment.

**Reversibility**:
- User account creation is reversible (admin can delete user account)
- Role assignment is reversible (admin can change user role)
- Alias generation is NOT reversible (aliases are stable once created)

---

### Workflow 2: Farmer Listing Creation

**Entry Conditions**:
- User is authenticated as farmer
- Farmer has produce to list
- Farmer specifies: produce type, total quantity, price per kilo

**Process**:
1. System validates farmer role (server-side)
2. System checks rate limit (10 listings per day per farmer)
3. System creates listing record
4. System automatically splits listing into 10kg units
5. System creates unit records (one per 10kg)
6. System generates UTID for listing
7. Listing becomes visible to traders

**Exit Conditions**:
- Listing created with units available
- Traders can see and purchase units

**Human Authorization Points**:
- None (automated listing creation)

**BLOCKED States**:
- **BLOCKED**: If farmer exceeds 10 listings per day, listing creation is BLOCKED until next day
- **BLOCKED**: If farmer role cannot be verified, listing creation is BLOCKED

**Reversibility**:
- Listing creation is reversible (farmer can cancel listing if no units are locked)
- Unit splitting is NOT reversible (units cannot be merged back into original listing)
- If units are locked by traders, listing cancellation requires admin authorization

---

### Workflow 3: Trader Capital Deposit

**Entry Conditions**:
- User is authenticated as trader
- Trader has funds to deposit
- Trader specifies deposit amount

**Process**:
1. System validates trader role (server-side)
2. System validates deposit amount (must be positive)
3. System generates UTID for deposit
4. System creates ledger entry (type: `capital_deposit`)
5. System updates trader capital balance
6. Deposit is recorded in wallet ledger

**Exit Conditions**:
- Capital deposited and recorded in ledger
- Trader capital balance increased
- Trader can use capital for purchases

**Human Authorization Points**:
- None (automated deposit)

**BLOCKED States**:
- **BLOCKED**: If trader role cannot be verified, deposit is BLOCKED
- **BLOCKED**: If amount is not positive, deposit is BLOCKED

**Reversibility**:
- Capital deposit is NOT reversible (once deposited, capital cannot be withdrawn except as profit)
- **ASSUMPTION**: Traders accept that capital deposits are irreversible within the closed-loop system
- Capital can be unlocked if transactions are reversed, but capital itself cannot be withdrawn

---

### Workflow 4: Trader Unit Lock (Pay-to-Lock)

**Entry Conditions**:
- User is authenticated as trader
- Trader has sufficient capital balance
- Unit is available (not locked by another trader)
- Trader exposure does not exceed UGX 1,000,000

**Process**:
1. System validates trader role (server-side)
2. System checks unit availability (status: `available`)
3. System calculates trader exposure (capital committed + locked orders + inventory value)
4. System checks exposure limit (must be < UGX 1,000,000)
5. System calculates payment amount (unit quantity × price per kilo)
6. System checks trader capital balance (must be sufficient)
7. **Atomic Operation**: System locks unit AND debits wallet in single transaction
8. System generates UTID for lock
9. System creates wallet ledger entry (type: `capital_lock`)
10. System updates unit status to `locked`
11. System sets delivery deadline (6 hours from lock time)

**Exit Conditions**:
- Unit is locked to trader
- Trader capital is debited
- Delivery deadline is set
- Farmer must deliver within 6 hours

**Human Authorization Points**:
- None (automated pay-to-lock)

**BLOCKED States**:
- **BLOCKED**: If unit is already locked, lock is BLOCKED
- **BLOCKED**: If trader exposure exceeds UGX 1,000,000, lock is BLOCKED
- **BLOCKED**: If trader capital is insufficient, lock is BLOCKED
- **BLOCKED**: If trader role cannot be verified, lock is BLOCKED

**Reversibility**:
- Unit lock is reversible (admin can reverse if delivery fails)
- Capital debit is reversible (admin can unlock capital if delivery fails)
- Reversal requires admin authorization and delivery verification
- Reversal is atomic (unit unlock AND capital unlock in single transaction)

---

### Workflow 5: Farmer Delivery

**Entry Conditions**:
- Unit is locked by trader
- Delivery deadline has not passed (6 hours from lock time)
- Farmer delivers produce to trader

**Process**:
1. Farmer delivers produce to trader (physical action, outside system)
2. Trader receives produce (physical action, outside system)
3. **BLOCKED**: Delivery verification function implementation status is UNKNOWN
4. Admin reviews delivery (if admin verification is implemented)
5. Admin marks delivery as `delivered` or `late` (if admin verification is implemented)

**Exit Conditions**:
- **UNKNOWN**: Exit conditions depend on delivery verification implementation status

**Human Authorization Points**:
- **REQUIRED**: Admin must verify delivery (if verification function is implemented)
- **BLOCKED**: Delivery verification workflow is BLOCKED until implementation status is verified

**BLOCKED States**:
- **BLOCKED**: Delivery verification function implementation status is UNKNOWN
- **BLOCKED**: If delivery deadline passes, delivery may be marked as `late` (requires admin verification)
- **BLOCKED**: If admin verification is not implemented, delivery workflow is BLOCKED

**Reversibility**:
- Delivery verification is reversible (admin can change delivery status)
- If delivery is marked as `late`, transaction can be reversed (unit unlock + capital unlock)
- Reversal requires admin authorization

---

### Workflow 6: Trader Inventory Management

**Entry Conditions**:
- Unit delivery is verified as `delivered`
- Unit is in `locked` status

**Process**:
1. System verifies delivery status (if verification is implemented)
2. System updates unit status to `delivered` (if status tracking is implemented)
3. System creates trader inventory record (if inventory creation is implemented)
4. System aggregates units into 100kg blocks for buyers (if aggregation is implemented)
5. **BLOCKED**: Storage fee automation implementation status is UNKNOWN

**Exit Conditions**:
- **UNKNOWN**: Exit conditions depend on inventory management implementation status

**Human Authorization Points**:
- **REQUIRED**: Admin must verify delivery before inventory creation (if verification is implemented)

**BLOCKED States**:
- **BLOCKED**: Inventory management workflow is BLOCKED until implementation status is verified
- **BLOCKED**: Storage fee automation is BLOCKED (implementation status UNKNOWN)

**Reversibility**:
- Inventory creation is reversible (admin can remove inventory if delivery verification is reversed)
- Storage fee deductions are NOT reversible (fees accumulate and cannot be refunded)

---

### Workflow 7: Buyer Purchase

**Entry Conditions**:
- User is authenticated as buyer
- Purchase window is open (admin-controlled)
- Trader has inventory available in 100kg blocks
- Buyer has not exceeded rate limit (5 purchases per hour)

**Process**:
1. System validates buyer role (server-side)
2. System checks purchase window status (must be open)
3. System checks buyer rate limit (must be < 5 purchases per hour)
4. System checks inventory availability (must have 100kg blocks available)
5. **BLOCKED**: Buyer purchase function is NOT IMPLEMENTED
6. System would lock inventory for buyer (if function is implemented)
7. System would set pickup deadline (48 hours from purchase, if function is implemented)

**Exit Conditions**:
- **BLOCKED**: Workflow is BLOCKED. Buyers cannot complete purchases.

**Human Authorization Points**:
- **REQUIRED**: Admin must open purchase window before buyers can purchase
- **BLOCKED**: Purchase function requires implementation

**BLOCKED States**:
- **BLOCKED**: Buyer purchase function is NOT IMPLEMENTED. Complete workflow is BLOCKED.

**Reversibility**:
- **UNKNOWN**: Reversibility depends on purchase function implementation

---

### Workflow 8: Buyer Pickup

**Entry Conditions**:
- Buyer has purchased inventory (if purchase function is implemented)
- Pickup deadline has not passed (48 hours from purchase, if implemented)
- Buyer picks up produce from trader (physical action)

**Process**:
1. **BLOCKED**: Purchase function is NOT IMPLEMENTED. Pickup workflow is BLOCKED.

**Exit Conditions**:
- **BLOCKED**: Workflow is BLOCKED until purchase function is implemented.

**Human Authorization Points**:
- **BLOCKED**: Workflow is BLOCKED

**BLOCKED States**:
- **BLOCKED**: Complete workflow is BLOCKED until purchase function is implemented.

**Reversibility**:
- **UNKNOWN**: Reversibility depends on purchase function implementation

---

### Workflow 9: Admin Delivery Verification

**Entry Conditions**:
- Unit is locked by trader
- Delivery deadline has passed OR delivery is reported
- Admin reviews delivery status

**Process**:
1. Admin reviews delivery information
2. **BLOCKED**: Delivery verification function implementation status is UNKNOWN
3. Admin marks delivery as `delivered`, `late`, or `cancelled` (if function is implemented)
4. System logs admin action with UTID and reason (if logging is implemented)
5. If marked as `late` or `cancelled`, admin may reverse transaction (if reversal is implemented)

**Exit Conditions**:
- **UNKNOWN**: Exit conditions depend on verification function implementation status

**Human Authorization Points**:
- **REQUIRED**: Admin must explicitly verify delivery (no automated verification)
- **REQUIRED**: Admin must provide reason for verification decision

**BLOCKED States**:
- **BLOCKED**: Delivery verification function implementation status is UNKNOWN. Workflow is BLOCKED.

**Reversibility**:
- Delivery verification decision is reversible (admin can change status)
- Transaction reversal is reversible (admin can reverse a reversal, but this creates audit complexity)

---

### Workflow 10: Admin Transaction Reversal

**Entry Conditions**:
- Delivery is verified as `late` or `cancelled`
- Admin authorizes reversal
- Admin provides reason for reversal

**Process**:
1. Admin authorizes reversal
2. Admin provides reason (required)
3. System validates unit is in `locked` status
4. System validates wallet entry exists for original lock
5. **Atomic Operation**: System unlocks unit AND unlocks capital in single transaction
6. System generates UTID for reversal
7. System creates wallet ledger entry (type: `capital_unlock`)
8. System updates unit status to `available`
9. System logs admin action with UTID and reason

**Exit Conditions**:
- Unit is unlocked and available
- Trader capital is unlocked
- Transaction is reversed
- Admin action is logged

**Human Authorization Points**:
- **REQUIRED**: Admin must explicitly authorize reversal
- **REQUIRED**: Admin must provide reason (non-negotiable)

**BLOCKED States**:
- **BLOCKED**: If unit is not in `locked` status, reversal is BLOCKED
- **BLOCKED**: If wallet entry does not exist, reversal is BLOCKED
- **BLOCKED**: If admin does not provide reason, reversal is BLOCKED

**Reversibility**:
- Transaction reversal is NOT reversible (once reversed, cannot be re-locked automatically)
- Admin can create new transaction, but original reversal remains in audit trail

---

### Workflow 11: Trader Profit Withdrawal

**Entry Conditions**:
- User is authenticated as trader
- Trader has profit balance (profit ledger has positive balance)
- Trader specifies withdrawal amount

**Process**:
1. System validates trader role (server-side)
2. System checks profit balance (must be sufficient)
3. System validates withdrawal amount (must be positive and <= profit balance)
4. System generates UTID for withdrawal
5. System creates ledger entry (type: `profit_withdrawal`)
6. System updates trader profit balance
7. **BLOCKED**: External transfer to bank account status is UNKNOWN

**Exit Conditions**:
- Profit withdrawn from ledger
- Trader profit balance decreased
- **UNKNOWN**: External transfer status is UNKNOWN

**Human Authorization Points**:
- None (automated withdrawal from ledger)

**BLOCKED States**:
- **BLOCKED**: If trader role cannot be verified, withdrawal is BLOCKED
- **BLOCKED**: If profit balance is insufficient, withdrawal is BLOCKED
- **BLOCKED**: External transfer mechanism status is UNKNOWN

**Reversibility**:
- Profit withdrawal from ledger is NOT reversible (once withdrawn, cannot be automatically refunded)
- **ASSUMPTION**: Traders accept that profit withdrawals are irreversible
- Admin can manually credit profit back, but this creates new ledger entry (not a reversal)

---

### Workflow 12: Admin Purchase Window Control

**Entry Conditions**:
- User is authenticated as admin
- Admin wants to open or close purchase window

**Process**:
1. System validates admin role (server-side)
2. Admin opens or closes purchase window
3. System updates purchase window status
4. System logs admin action with UTID and reason
5. Buyers can only purchase when window is open

**Exit Conditions**:
- Purchase window status updated
- Buyers can or cannot purchase based on window status

**Human Authorization Points**:
- **REQUIRED**: Admin must explicitly open or close window
- **REQUIRED**: Admin must provide reason (if logging requires it)

**BLOCKED States**:
- **BLOCKED**: If admin role cannot be verified, window control is BLOCKED

**Reversibility**:
- Purchase window control is reversible (admin can open and close window multiple times)
- Window status changes are logged but can be reversed

---

## 3. Value Exchange

### What Value is Provided

**To Farmers**:
- Platform to list produce for sale
- Guaranteed payment if delivery is on time (payment locked before delivery)
- Anonymity (real identity not exposed to traders)
- Structured trading process with clear deadlines

**To Traders**:
- Platform to purchase produce from farmers
- Payment protection (money locked until delivery verified)
- Exposure limit protection (UGX 1,000,000 maximum)
- Inventory management (aggregation into 100kg blocks)
- Anonymity (real identity not exposed to farmers or buyers)

**To Buyers**:
- Platform to purchase produce from traders
- Inventory availability when purchase window is open
- Anonymity (real identity not exposed to traders)
- **BLOCKED**: Complete value proposition is BLOCKED until purchase function is implemented

**To Admin**:
- System control and oversight
- Dispute resolution authority
- Transaction auditability

### What is Exchanged in Return

**From Farmers**:
- Produce (physical goods)
- Delivery within 6 hours after payment
- Produce quality meeting trader expectations
- Compliance with system rules

**From Traders**:
- Capital deposit (money locked in closed-loop system)
- Payment for produce (capital debited when locking units)
- Compliance with exposure limits (UGX 1,000,000 maximum)
- Inventory management (aggregation and storage)

**From Buyers**:
- **BLOCKED**: Exchange cannot be specified until purchase function is implemented
- **ASSUMPTION**: Buyers would exchange payment for produce (assumption, not verified)

**From Admin**:
- Time and effort for system oversight
- Decision-making authority and responsibility
- Dispute resolution

### Who Receives Value

**Farmers Receive**:
- Payment for produce (if delivery is on time)
- Access to trader market
- Payment guarantees

**Traders Receive**:
- Produce from farmers
- Inventory to sell to buyers
- Payment protection
- Exposure limit protection

**Buyers Receive**:
- **BLOCKED**: Value receipt is BLOCKED until purchase function is implemented

**Admin Receives**:
- System control
- Audit trail of all transactions

### Who Bears Cost or Risk

**Farmers Bear**:
- Risk of late delivery (transaction reversal, loss of sale)
- Risk of quality disputes (transaction reversal, loss of sale)
- Cost of produce (if delivery fails, produce may be lost or returned)
- Cost of transportation (delivery within 6 hours)

**Traders Bear**:
- Risk of capital lock (money locked until delivery verified)
- Risk of exposure limit (cannot purchase if at limit)
- Risk of storage fees (0.5 kg/day per 100kg block)
- Risk of late buyer pickup (inventory locked, potential sale loss)
- Risk of farmer non-delivery (capital locked for 6+ hours, then reversal)
- **ASSUMPTION**: Risk of closed-loop system (capital cannot be withdrawn to bank account)

**Buyers Bear**:
- **BLOCKED**: Risk allocation is BLOCKED until purchase function is implemented
- **ASSUMPTION**: Risk of late pickup (purchase cancellation, loss of purchase)

**Admin Bears**:
- Responsibility for dispute resolution
- Responsibility for system oversight
- Legal risk (if legal compliance is not verified)
- Operational risk (system failures, user disputes)

**System Operator Bears**:
- Legal risk (legal compliance status is UNKNOWN)
- Financial risk (if closed-loop ledger is not legally recognized)
- Operational risk (system failures, data loss)
- Reputation risk (admin decisions, system failures)

---

## 4. Risk Allocation

### User Risks

**Farmer Risks**:
- **Late Delivery Risk**: If farmer delivers after 6-hour deadline, transaction may be reversed. Farmer loses sale and produce may be unlocked. **Risk Owner**: Farmer. **Mitigation**: Farmer must deliver on time. No system mitigation exists.

- **Quality Dispute Risk**: If trader disputes produce quality, admin may reverse transaction. Farmer loses sale. **Risk Owner**: Farmer. **Mitigation**: Farmer must deliver quality produce. Admin resolves disputes. No automated quality verification exists.

- **Transportation Cost Risk**: Farmer bears cost of transportation to deliver within 6 hours. If delivery fails, transportation cost is lost. **Risk Owner**: Farmer. **Mitigation**: None. System does not reimburse transportation costs.

- **Listing Rate Limit Risk**: If farmer exceeds 10 listings per day, cannot create more listings. **Risk Owner**: Farmer. **Mitigation**: Farmer must plan listings. System enforces limit.

**Trader Risks**:
- **Capital Lock Risk**: Capital is locked when purchasing units. If delivery fails, capital is locked for 6+ hours before reversal. **Risk Owner**: Trader. **Mitigation**: System reverses transaction if delivery fails, but capital is locked during delay.

- **Exposure Limit Risk**: If trader reaches UGX 1,000,000 exposure, cannot purchase more units. **Risk Owner**: Trader. **Mitigation**: System enforces limit. Trader must manage exposure.

- **Storage Fee Risk**: Inventory loses 0.5 kg/day per 100kg block. Trader loses value over time. **Risk Owner**: Trader. **Mitigation**: Trader must sell inventory quickly. System applies fees automatically (if automation is implemented).

- **Buyer Pickup Risk**: If buyer does not pick up within 48 hours, purchase may be cancelled. Inventory is locked during delay. **Risk Owner**: Trader. **Mitigation**: Admin may cancel purchase. System does not automatically cancel.

- **Closed-Loop System Risk**: Capital cannot be withdrawn to bank account. Money remains in platform. **Risk Owner**: Trader. **Mitigation**: None. System is closed-loop by design.

- **Farmer Non-Delivery Risk**: If farmer does not deliver, trader capital is locked for 6+ hours before reversal. **Risk Owner**: Trader. **Mitigation**: System reverses transaction, but delay exists.

**Buyer Risks**:
- **BLOCKED**: Buyer risk allocation is BLOCKED until purchase function is implemented.

- **ASSUMPTION - Late Pickup Risk**: If buyer does not pick up within 48 hours, purchase may be cancelled. **Risk Owner**: Buyer (assumed). **Mitigation**: Buyer must pick up on time. System does not automatically cancel.

**Admin Risks**:
- **Decision Authority Risk**: Admin decisions are final. No appeals process. Admin bears responsibility for all decisions. **Risk Owner**: Admin. **Mitigation**: None. System provides no appeals mechanism.

- **Dispute Resolution Risk**: Admin must resolve disputes fairly. Unfair decisions may harm users. **Risk Owner**: Admin. **Mitigation**: None. System provides no automated dispute resolution.

### Operator Risks

**System Operator Risks**:
- **Legal Compliance Risk**: Legal compliance status is UNKNOWN. System may violate Uganda regulations. **Risk Owner**: System operator. **Mitigation**: Legal review required (BLOCKED).

- **Financial Regulation Risk**: Closed-loop ledger legal status is UNKNOWN. System may require banking licenses. **Risk Owner**: System operator. **Mitigation**: Legal review required (BLOCKED).

- **Data Protection Risk**: Data protection compliance is UNKNOWN. System may violate Uganda data protection laws. **Risk Owner**: System operator. **Mitigation**: Legal review required (BLOCKED).

- **System Failure Risk**: System failures may cause data loss, transaction errors, or service interruption. **Risk Owner**: System operator. **Mitigation**: System provides audit trail and reversibility where possible.

- **Admin Abuse Risk**: If admin abuses authority, users may be harmed. System provides no automated oversight of admin. **Risk Owner**: System operator. **Mitigation**: None. System relies on admin good faith (ASSUMPTION).

### Third-Party Risks

**No Third-Party Business Integration**:
- System does not integrate with external business services (banks, payment processors, SMS providers)
- No third-party business integration risks exist (by design)

**Infrastructure Dependencies**:
- **Vercel Risk**: Frontend hosting provider (infrastructure dependency). Service interruption may affect system availability. **Risk Owner**: System operator. **Mitigation**: None. System depends on Vercel availability.

- **Convex Risk**: Backend hosting provider (infrastructure dependency). Service interruption may affect system availability and data integrity. **Risk Owner**: System operator. **Mitigation**: None. System depends on Convex availability and data integrity guarantees.

**Note**: Infrastructure dependencies (Vercel, Convex) are external dependencies, not business integrations. They are correctly listed as risks but do not represent third-party business logic integration.

### Risk Ownership Summary

| Risk | Owner | Mitigation | Status |
|------|-------|------------|--------|
| Late delivery | Farmer | None (farmer must deliver on time) | Active |
| Quality dispute | Farmer | Admin resolution only | Active |
| Capital lock | Trader | System reversal (with delay) | Active |
| Exposure limit | Trader | System enforcement | Active |
| Storage fees | Trader | Trader must sell quickly | Active (if automation implemented) |
| Buyer pickup delay | Trader | Admin may cancel | Active (if purchase implemented) |
| Closed-loop system | Trader | None (by design) | Active |
| Admin decision authority | Admin | None (no appeals) | Active |
| Legal compliance | Operator | BLOCKED (legal review required) | BLOCKED |
| Financial regulation | Operator | BLOCKED (legal review required) | BLOCKED |
| Data protection | Operator | BLOCKED (legal review required) | BLOCKED |
| System failure | Operator | Audit trail, reversibility | Active |
| Admin abuse | Operator | None (relies on ASSUMPTION) | Active |

---

## 5. Authority and Control

### Decisions Requiring Human Authorization

**Admin-Only Decisions**:

1. **Delivery Verification**
   - **Decision**: Mark delivery as `delivered`, `late`, or `cancelled`
   - **Authority**: Admin only
   - **Required Input**: Reason (non-negotiable)
   - **Reversibility**: Reversible (admin can change status)
   - **BLOCKED**: Function implementation status is UNKNOWN

2. **Transaction Reversal**
   - **Decision**: Reverse transaction (unlock unit + unlock capital)
   - **Authority**: Admin only
   - **Required Input**: Reason (non-negotiable)
   - **Reversibility**: NOT reversible (once reversed, cannot be re-locked automatically)
   - **Precondition**: Delivery must be verified as `late` or `cancelled`

3. **Purchase Window Control**
   - **Decision**: Open or close purchase window for buyers
   - **Authority**: Admin only
   - **Required Input**: Reason (if logging requires it)
   - **Reversibility**: Reversible (admin can open and close multiple times)

4. **Pilot Mode Control**
   - **Decision**: Enable or disable pilot mode (blocks all money-moving mutations)
   - **Authority**: Admin only
   - **Required Input**: Reason (non-negotiable)
   - **Reversibility**: Reversible (admin can enable and disable)

5. **User Role Changes**
   - **Decision**: Change user role (farmer, trader, buyer, admin)
   - **Authority**: Admin only (if function exists)
   - **Required Input**: Reason (if logging requires it)
   - **Reversibility**: Reversible (admin can change role back)

**System Operator-Only Decisions**:

1. **Production Activation**
   - **Decision**: Activate system for public go-live
   - **Authority**: System operator (CEO / Engineering Lead / CTO)
   - **Required Input**: Explicit authorization and verification
   - **Reversibility**: Reversible (system can be deactivated)
   - **BLOCKED**: Production activation is NOT verified (see `docs/architecture.md`)

2. **System Shutdown**
   - **Decision**: Shutdown system (emergency or planned)
   - **Authority**: System operator only
   - **Required Input**: Reason (for audit)
   - **Reversibility**: Reversible (system can be restarted)

### Decisions Explicitly Forbidden

**Forbidden to Users**:
- **Forbidden**: Users cannot reverse their own transactions
- **Forbidden**: Users cannot modify transaction records
- **Forbidden**: Users cannot change their own role
- **Forbidden**: Users cannot bypass exposure limits
- **Forbidden**: Users cannot modify UTIDs
- **Forbidden**: Users cannot access other users' data (beyond what system exposes)

**Forbidden to System**:
- **Forbidden**: System cannot make autonomous decisions without human authorization
- **Forbidden**: System cannot automatically reverse successful transactions
- **Forbidden**: System cannot modify UTIDs after creation
- **Forbidden**: System cannot overwrite ledger balances (ledger entries only)
- **Forbidden**: System cannot proceed without explicit authorization gates

**Forbidden to Admin**:
- **Forbidden**: Admin cannot reverse transactions without reason
- **Forbidden**: Admin cannot modify UTIDs
- **Forbidden**: Admin cannot bypass exposure limits for traders
- **Forbidden**: Admin cannot access user real identities (anonymity must be preserved)

### Emergency Authority

**System Operator Emergency Authority**:
- **Authority**: System operator can shutdown system immediately
- **Trigger**: Legal risk, security breach, system failure, or other emergency
- **Process**: System operator shuts down system, logs reason, notifies users if possible
- **Reversibility**: System can be restarted after emergency is resolved
- **Limitation**: Shutdown does not reverse transactions. Transactions remain in audit trail.

**Admin Emergency Authority**:
- **Authority**: Admin can enable pilot mode immediately (blocks all money-moving mutations)
- **Trigger**: System issues, disputes, or other concerns
- **Process**: Admin enables pilot mode, provides reason, system blocks mutations
- **Reversibility**: Admin can disable pilot mode after issues are resolved
- **Limitation**: Pilot mode does not reverse existing transactions. Existing transactions remain.

**No Other Emergency Authority**:
- Users have no emergency authority
- System has no autonomous emergency authority
- All emergency actions require human authorization

---

## 6. Irreversible Actions

### Explicit List of Irreversible Actions

**1. UTID Generation**
- **Action**: System generates UTID for transaction
- **Precondition**: Transaction validation passes
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: NOT available. UTIDs are immutable once created.
- **Impact**: UTID cannot be changed or deleted. Audit trail depends on UTID immutability.

**2. Capital Deposit**
- **Action**: Trader deposits capital into wallet
- **Precondition**: Trader role verified, amount is positive
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: NOT available. Capital cannot be withdrawn except as profit (and profit withdrawal external transfer status is UNKNOWN).
- **Impact**: Capital remains in closed-loop system. Cannot be withdrawn to bank account.

**3. Unit Lock (Pay-to-Lock)**
- **Action**: Trader locks unit and capital is debited
- **Precondition**: Unit available, exposure limit not exceeded, capital sufficient
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: Available (admin can reverse if delivery fails)
- **Impact**: Unit is locked and capital is debited. Reversal requires admin authorization.

**4. Profit Withdrawal from Ledger**
- **Action**: Trader withdraws profit from ledger
- **Precondition**: Trader role verified, profit balance sufficient
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: NOT available. Profit withdrawal cannot be automatically refunded.
- **Impact**: Profit balance decreased. Admin can manually credit profit back, but this creates new ledger entry (not a reversal).

**5. Transaction Reversal**
- **Action**: Admin reverses transaction (unlocks unit + unlocks capital)
- **Precondition**: Delivery verified as `late` or `cancelled`, admin authorization, reason provided
- **Required Authorization**: Admin only
- **Recovery/Rollback**: NOT available. Once reversed, cannot be automatically re-locked.
- **Impact**: Unit is unlocked and capital is unlocked. Admin can create new transaction, but original reversal remains in audit trail.

**6. Alias Generation**
- **Action**: System generates alias for user
- **Precondition**: User account creation
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: NOT available. Aliases are stable once created.
- **Impact**: Alias cannot be changed. Anonymity depends on alias stability.

**7. Ledger Entry Creation**
- **Action**: System creates ledger entry
- **Precondition**: Transaction validation passes, UTID generated
- **Required Authorization**: None (automated for deposits, locks, withdrawals)
- **Recovery/Rollback**: NOT available. Ledger entries are immutable.
- **Impact**: Ledger entry cannot be deleted or modified. Audit trail depends on ledger immutability.

**8. Storage Fee Deduction**
- **Action**: System deducts storage fees (0.5 kg/day per 100kg block)
- **Precondition**: Inventory in storage, time passes
- **Required Authorization**: None (automated, if automation is implemented)
- **Recovery/Rollback**: NOT available. Storage fees cannot be refunded.
- **Impact**: Inventory quantity decreases. Fees accumulate and cannot be reversed.
- **BLOCKED**: Automation implementation status is UNKNOWN.

**9. Listing Unit Splitting**
- **Action**: System splits listing into 10kg units
- **Precondition**: Listing created with total quantity
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: NOT available. Units cannot be merged back into original listing.
- **Impact**: Listing is split into units. If units are locked, listing cannot be cancelled without admin authorization.

**10. User Account Creation**
- **Action**: System creates user account with role and alias
- **Precondition**: Email provided, role inferred or specified
- **Required Authorization**: None (automated)
- **Recovery/Rollback**: Available (admin can delete user account, but alias cannot be reused)
- **Impact**: User account created. Role and alias are assigned. Alias is stable.

### Irreversible Actions Requiring Explicit Acknowledgment

**Before Production Go-Live, System Operator Must Acknowledge**:
- Capital deposits are irreversible within closed-loop system
- Profit withdrawals from ledger are irreversible (external transfer status is UNKNOWN)
- UTID generation is irreversible (audit trail depends on immutability)
- Ledger entries are irreversible (audit trail depends on immutability)
- Storage fees are irreversible (fees cannot be refunded)
- Transaction reversals are irreversible (once reversed, cannot be automatically re-locked)

**Acknowledgment Status**: **NOT COMPLETED**. System operator has not explicitly acknowledged irreversible actions.

---

## Final Check

### All Assumptions Made

1. **ASSUMPTION 1**: User Voluntary Participation
2. **ASSUMPTION 2**: Admin Acts in Good Faith
3. **ASSUMPTION 3**: Physical Delivery Capability
4. **ASSUMPTION 4**: Physical Pickup Capability
5. **ASSUMPTION 5**: Closed-Loop Wallet Acceptance
6. **ASSUMPTION 6**: Produce Quality Standards
7. **ASSUMPTION 7**: Uganda Jurisdiction Acceptance

All assumptions are explicitly labeled, narrow in scope, non-optimistic, non-expansive, and easy to revoke.

### All BLOCKED Areas

1. **BLOCKED 1**: Production Authentication (VISION.md BLOCKED item #1)
2. **BLOCKED 2**: Buyer Purchase Workflow (VISION.md BLOCKED item #2)
3. **BLOCKED 3**: Legal Framework (VISION.md BLOCKED item #3)
4. **BLOCKED 4**: Terms of Service (VISION.md BLOCKED item #4)
5. **BLOCKED 5**: Delivery Verification Workflow (VISION.md UNKNOWN item)
6. **BLOCKED 6**: Storage Fee Automation (VISION.md UNKNOWN item)
7. **BLOCKED 7**: Profit Withdrawal External Transfer (VISION.md UNKNOWN item)

All BLOCKED areas are explicitly marked and linked to VISION.md items.

### Confirmation: No Silent Assumptions

**Verified**: No assumptions were silently embedded. All assumptions are:
- Explicitly labeled as "ASSUMPTION"
- Linked to why they exist
- Narrow in scope
- Non-optimistic
- Non-expansive
- Easy to revoke

**Verified**: No assumptions:
- Expand system purpose
- Introduce new user categories
- Introduce automation or autonomy
- Introduce irreversible behavior without flagging it

---

*This document must be updated when system state changes, assumptions are resolved, or BLOCKED items are unblocked. No assumptions. Only truth.*
