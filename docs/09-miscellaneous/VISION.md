# VISION.md

**Production System Vision**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

---

## Product Purpose

This product exists to provide a clearly defined, repeatable capability to end users under controlled conditions, with explicit governance, auditability, and human oversight.

Farm2Market Uganda is a controlled, negotiation-driven agricultural trading platform that facilitates transactions between farmers, traders, and buyers through a web-based interface.

The system operates as a closed-loop ledger system. It is NOT a bank, payment processor, or financial institution.

The system is designed to operate in production environments where correctness, reversibility, and accountability are more important than speed, growth, or experimentation.

The product prioritizes safety, traceability, and controlled execution over autonomy or optimization.

---

## Intended Users

The intended users are individuals or organizations who:

* Explicitly choose to use the system
* Operate within its defined boundaries
* Accept the stated limitations and risks
* Do not require autonomous decision-making by the system

The system assumes users are acting voluntarily and are not coerced into usage.

### User Roles

The system supports four distinct user roles. Each user has exactly one role:

1. **Farmers**: Agricultural producers who list produce for sale
2. **Traders**: Intermediaries who purchase from farmers and sell to buyers
3. **Buyers**: End consumers who purchase from traders
4. **Admin**: Single human authority who controls system settings and resolves disputes

### User Category

**Primary user category**: Agricultural market participants in Uganda
- Farmers: Agricultural producers
- Traders: Agricultural intermediaries
- Buyers: End consumers of agricultural produce
- Admin: System operator (single human authority)

### Current State

System is in pilot mode. Production activation is NOT verified. Live public traffic is NOT enabled.

---

## Problem Explicitly Solved

The product solves the problem of performing a narrowly scoped set of actions or workflows in a way that is:

* Governed by explicit rules
* Auditable after the fact
* Reversible where possible
* Subject to human authorization and override

It replaces informal, opaque, or ad hoc processes with a controlled and observable system.

**The system does not claim to optimize outcomes, make decisions independently, or replace human judgment.**

### Specific Problem Solved

The system addresses the following specific problem:

**Facilitate structured agricultural trading** where:
- Farmers can list produce in standardized 10kg units
- Traders can purchase from farmers with enforced exposure limits (UGX 1,000,000 maximum)
- Buyers can purchase from traders during admin-controlled purchase windows
- All transactions are tracked with immutable UTIDs (Unique Transaction IDs)
- User identities are anonymized through system-generated aliases
- Financial movements are recorded in a closed-loop ledger (NOT a bank)

**Scope**: Web-based platform only. Uganda-focused agricultural produce trading.

---

## Problems Explicitly NOT Solved

This product does NOT:

* Make autonomous decisions on behalf of users
* Guarantee correctness, accuracy, or success of outcomes
* Replace professional, legal, financial, or technical judgment
* Eliminate risk
* Adapt its purpose dynamically without re-authorization
* Self-improve, self-expand, or self-deploy
* Operate without human oversight

Any expectation of autonomy, intelligence, or independent agency is explicitly out of scope.

### Specific Problems NOT Solved

The system does NOT address:

#### Authentication & Security (Production)
- **Current State**: Pilot mode uses shared password authentication (`Farm2Market2024`)
- **Production**: Individual user passwords, secure hashing, session management, password reset — **NOT IMPLEMENTED**
- **Status**: BLOCKED for public go-live until production authentication is implemented

#### Dispute Resolution
- **Automated dispute resolution**: NOT implemented
- **Multi-admin approval**: NOT implemented (v1.x has single admin authority)
- **Reputation systems**: NOT implemented (out of scope for v1.x)
- **Status**: Admin decisions are final. No automated processes.

#### Financial Services
- **Banking services**: System is NOT a bank
- **Payment processing**: System does NOT process external payments
- **Credit, loans, or financing**: NOT implemented (out of scope for v1.x)
- **Withdrawal mechanisms**: Profit ledger is withdrawable, but withdrawal implementation status is UNKNOWN
- **Status**: Closed-loop ledger only. No external financial integration.

#### Communication
- **SMS notifications**: NOT implemented (out of scope for v1.x)
- **USSD interface**: NOT implemented (out of scope for v1.x)
- **WhatsApp integration**: NOT implemented (out of scope for v1.x)
- **Status**: Web interface only.

#### Platform Access
- **Mobile applications**: NOT implemented (out of scope for v1.x)
- **Status**: Web-based platform only.

#### SLA Enforcement
- **Automated delivery SLA enforcement**: NOT implemented
  - Farmer delivery SLA: 6 hours after trader payment (defined, not enforced)
- **Automated pickup SLA enforcement**: NOT implemented
  - Buyer pickup SLA: 48 hours after purchase (defined, not enforced)
- **Storage fee automation**: Storage fees apply as kilo-shaving per day (implementation status UNKNOWN)
- **Status**: SLAs are defined but not automatically enforced. Admin intervention required.

#### Buyer Purchase Functionality
- **Buyer purchase function**: NOT implemented
  - Purchase window check exists but purchase function does not
- **Status**: BLOCKED — buyers cannot complete purchases until function is implemented

#### Delivery Verification
- **Admin delivery verification**: NOT implemented
- **Status**: Admin can verify deliveries, but function implementation status is UNKNOWN

#### Production Readiness
- **Production activation**: NOT verified (see `docs/architecture.md`)
- **Live traffic**: NOT enabled
- **Soft launch**: Defined, not active
- **Status**: System is in pilot mode. Public go-live is BLOCKED until production authentication and missing functions are implemented.

---

## Ethical Boundaries

The system is explicitly constrained to:

* Avoid intentional harm to users or third parties
* Avoid deceptive behavior or misrepresentation
* Avoid operating outside the user's informed consent
* Avoid obscuring responsibility or accountability

The system must not:

* Conceal errors
* Continue operation after known invariant violations
* Prioritize engagement, growth, or revenue over safety

If ethical boundaries are in conflict with business outcomes, ethical boundaries take precedence.

### Specific Ethical Boundaries

#### User Privacy
- **Anonymity**: System enforces user anonymity through system-generated aliases
- **No real names**: Real names, phone numbers, or identities are NOT exposed in the system
- **Alias stability**: Aliases are stable but non-identifying
- **Boundary**: System does NOT collect or expose personally identifiable information beyond email addresses used for login

#### Financial Transparency
- **Price visibility**: Buyers do NOT see prices paid by traders
- **Trader exposure**: Traders have enforced exposure limits (UGX 1,000,000)
- **Boundary**: System does NOT provide price transparency to buyers. This is an intentional design constraint.

#### Authority & Control
- **Admin authority**: Admin decisions are final in v1.x
- **No appeals process**: No automated appeals or multi-admin review
- **Boundary**: System does NOT provide democratic or consensus-based decision making. Single admin authority is absolute.

#### Data Integrity
- **UTID immutability**: All transactions generate immutable UTIDs
- **Ledger-only changes**: Financial state changes only through ledger entries (no balance overwrites)
- **Boundary**: System does NOT allow retroactive transaction modification. All changes are logged and immutable.

---

## Legal Boundaries

The system is designed to:

* Operate within applicable laws and regulations
* Preserve records required for audit or compliance
* Allow immediate suspension or shutdown if legal risk is identified

The system must not:

* Circumvent regulatory requirements
* Misrepresent its capabilities or guarantees
* Perform actions on behalf of users without explicit authorization

### Specific Legal Boundaries

#### Financial Regulation
- **NOT a bank**: System explicitly does NOT operate as a bank, payment processor, or financial institution
- **Closed-loop ledger**: Internal ledger only. No external financial services.
- **Boundary**: System does NOT require banking licenses. However, legal status of closed-loop ledger systems in Uganda is UNKNOWN. Legal review required before public go-live.

#### User Data
- **Data collection**: System collects email addresses and transaction data
- **Data protection**: Compliance with Uganda data protection laws is UNKNOWN
- **Boundary**: System does NOT explicitly comply with data protection regulations. Legal review required.

#### Agricultural Trading
- **Trading regulations**: Compliance with Uganda agricultural trading regulations is UNKNOWN
- **Boundary**: System does NOT explicitly comply with agricultural trading regulations. Legal review required.

#### Contract Enforcement
- **Terms of service**: Terms of service document status is UNKNOWN
- **User agreements**: User agreement document status is UNKNOWN
- **Boundary**: System does NOT have explicit legal agreements with users. Legal review required.

#### Dispute Resolution
- **Legal framework**: System provides admin-based dispute resolution only
- **Court system**: System does NOT integrate with legal or court systems
- **Boundary**: System does NOT provide legally binding dispute resolution. Admin decisions are final but legal enforceability is UNKNOWN.

### Jurisdictional Scope

**High-level jurisdictional scope**: Uganda

**BLOCKED**: Detailed legal compliance review for Uganda-specific regulations has not been completed. Applicable regulatory regimes require specification before public go-live.

---

## Explicit Non-Goals

The following are explicitly NOT goals of this product:

* Rapid scaling
* Viral growth
* Autonomous operation
* Full automation of human decisions
* Optimization without constraints
* "Set and forget" usage patterns
* Self-improving or adaptive systems
* Revenue maximization over safety
* User engagement optimization
* Growth metrics as primary success indicators

The absence of these goals is intentional and permanent unless explicitly re-authorized.

---

## Current System Constraints

### Technical Constraints
- **Backend**: Convex ONLY. Supabase is FORBIDDEN and permanently dormant.
- **Deployment**: Vercel-compatible. Two deployment modes: pilot and dev.
- **Database**: Separate databases for pilot and dev deployments.
- **Atomic operations**: Critical paths (pay-to-lock) require atomic operations. Non-atomic alternatives are NOT acceptable.

### Operational Constraints
- **Single authority**: One human (CEO / Engineering Lead / CTO) has all approval authority
- **No auto-advancement**: System phases do NOT auto-advance. Explicit authorization required.
- **Reversibility**: All operations must be reversible unless explicitly acknowledged as irreversible
- **Auditability**: All actions must be logged with UTIDs, reasons, and timestamps

### Business Logic Constraints
- **Role enforcement**: Server-side only. Client-side role checks are NOT trusted.
- **Spend cap**: Trader exposure maximum UGX 1,000,000. Enforced atomically before payment.
- **Unit locking**: Pay-to-lock is atomic. First successful payment wins. Race conditions are impossible.
- **Inventory aggregation**: Trader inventory aggregates into 100kg blocks for buyers. Buyers purchase in blocks, not individual units.

---

## Production Readiness Status

### BLOCKED Items (Must be resolved before public go-live)

1. **Production Authentication**
   - Current: Shared password pilot authentication
   - Required: Individual passwords, secure hashing, session management
   - Status: NOT IMPLEMENTED

2. **Buyer Purchase Function**
   - Current: Purchase window check exists, purchase function does not
   - Required: Function to create buyer purchases
   - Status: NOT IMPLEMENTED

3. **Legal Review**
   - Current: Legal compliance status UNKNOWN
   - Required: Review of financial regulations, data protection, agricultural trading laws
   - Status: NOT COMPLETED

4. **Terms of Service & User Agreements**
   - Current: Document status UNKNOWN
   - Required: Legal agreements with users
   - Status: NOT COMPLETED

5. **Production Activation Authorization**
   - Current: Production activation NOT verified (see `docs/architecture.md`)
   - Required: Explicit authorization and verification
   - Status: NOT COMPLETED

6. **Detailed Legal Compliance Specification**
   - Current: High-level jurisdiction (Uganda) defined, detailed regulatory regimes UNKNOWN
   - Required: Specification of applicable regulatory frameworks
   - Status: NOT COMPLETED

### Unknown Status Items (Require verification)

1. **Delivery Verification Function**: Implementation status UNKNOWN
2. **Storage Fee Automation**: Implementation status UNKNOWN
3. **Profit Withdrawal Mechanism**: Implementation status UNKNOWN
4. **SLA Enforcement Automation**: Implementation status UNKNOWN

---

## Explicit Non-Assumptions

This document makes NO assumptions about:
- System readiness for production
- User adoption or success
- Financial viability
- Legal compliance
- Technical stability
- Feature completeness
- Authorization status
- Market demand
- Competitive positioning
- Future capabilities

All statuses are explicitly marked as:
- ✅ Verified and working
- ⚠️ Implemented but status unknown
- ❌ NOT implemented
- BLOCKED: Cannot proceed without resolution
- UNKNOWN: Status requires verification

---

## Document Authority

This document reflects the current system state as of the last update. It does NOT represent:
- Future plans or roadmaps
- Marketing claims
- Optimistic projections
- Inferred capabilities
- Assumed readiness
- Implied authorization

All statements are verifiable against the codebase and documentation in this repository.

**If information is missing or unclear, the system status is marked as BLOCKED or UNKNOWN until verified.**

---

*This document must be updated when system state changes. No assumptions. Only truth.*
