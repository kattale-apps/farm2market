# BLOCKED 7 — Phase 1: Terms of Service & User Agreements Initiation

**BLOCKED 7: Terms of Service and User Agreements**  
**Execution Plan**: CRITICAL_CAPABILITY_EXECUTION_PLAN.md  
**Authorization Framework**: PRODUCTION_AUTHORIZATION.md  
**Status**: Phase 1 Initiation — IN EXECUTION  
**Date**: 10 JAN-2026

**Purpose**: This document formally initiates BLOCKED 7 and establishes the legal, functional, and evidentiary scope for Terms of Service (platform-level) and User Agreements (role-specific). This phase does not draft legal text and does not implement code. It defines what must exist, what must not exist, and what legal risks must be bounded before drafting begins.

**No Implementation**: This document does not implement any code, features, or changes. Only scope definition, constraints, and requirements specification.

---

## 1. Purpose of Phase 1

Phase 1 formally initiates BLOCKED 7 and establishes the legal, functional, and evidentiary scope for:

* Terms of Service (platform-level)
* User Agreements (role-specific)
* User consent framework requirements

**This phase does not draft legal text and does not implement code.**

**It defines what must exist, what must not exist, and what legal risks must be bounded before drafting begins.**

**Phase 1 Objectives**:
1. Define document scope (what must be produced)
2. Establish role-based agreement strategy
3. Define consent model constraints
4. Identify risk classes to be bounded
5. Verify legal preconditions (BLOCKED 6 completion)

---

## 2. Execution Authority

### Execution Owner

**Name**: Isaac Tom Musumba  
**Capacity**: System Operator (CEO / Engineering Lead / CTO)  
**Authority**: Final authority over all execution decisions, Terms of Service approval, and authorization handoff

**Owner Responsibilities**:
- Overall execution coordination
- Legal counsel coordination (for Terms of Service review)
- Technical implementation coordination (for user consent framework)
- Terms of Service and user agreements approval
- Authorization handoff

### Legal Counsel

**Name**: Isaac Tom Musumba  
**Capacity**: Legal Counsel (Uganda)  
**Authority**: Legal review and drafting authority

**Legal Counsel Responsibilities**:
- Terms of Service and user agreements legal review
- Compliance with Uganda contract law
- Risk mitigation through contract terms
- Legal defensibility of agreements

### Authority Basis

**Sole system operator with legal review authority**

---

## 3. Legal Preconditions (Satisfied)

### Phase 1 Authorization

**Phase 1 is authorized to proceed based on completion of BLOCKED 6**:

✅ **Legal characterization completed** (BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md)  
✅ **Regulatory non-trigger confirmed** (BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT.md)  
✅ **Data protection obligations defined** (Data Protection and Privacy Act, 2019)  
✅ **Evidentiary role of the system established** (transaction-recording and coordination platform)

### Dependency Clearance

**BLOCKED 6 — Legal Compliance is AUTHORIZED**

**Evidence**: BLOCKED6_AUTHORIZATION_HANDOFF.md (authorized 10 JAN-2026)

**Legal Basis**: Terms of Service and User Agreements require legal characterization and regulatory verification to be complete before drafting can proceed safely.

---

## 4. Scope Definition

### 4.1 Documents to Be Produced (Later Phases)

**This capability will ultimately produce**:

1. **Platform Terms of Service**
   - Platform-level agreement
   - Applies to all users
   - Defines platform nature, user responsibilities, liability boundaries

2. **Role-Specific User Agreements**, including:
   - **Farmers** — Agreement for agricultural producers
   - **Traders** — Agreement for intermediaries
   - **Buyers** — Agreement for end consumers
   - **Administrators** — Agreement for system administrators

3. **User Consent Record Model** (technical + legal)
   - Technical implementation for consent recording
   - Legal requirements for consent validity
   - Audit trail for consent records

**No drafting occurs in Phase 1.**

**Drafting will occur in later phases** (Phase 2: Terms of Service Drafting, Phase 3: User Agreements Drafting, Phase 4: Consent Framework Implementation).

---

### 4.2 What the Terms MUST Cover

**The following must be addressed explicitly in later phases**:

1. **Nature of the platform**
   - Transaction-recording and coordination platform
   - NOT a bank, payment processor, or financial institution
   - Closed-loop ledger for accountability, not monetary storage

2. **User roles and responsibilities**
   - Farmer responsibilities (listing creation, delivery obligations)
   - Trader responsibilities (capital management, exposure limits)
   - Buyer responsibilities (purchase obligations, pickup obligations)
   - Admin responsibilities (dispute resolution, system control)

3. **Transaction evidentiary status**
   - UTID generation and immutability
   - Audit trail completeness
   - Transaction records as evidence (not guarantees)

4. **Dispute posture**
   - Record-based dispute resolution (not guarantee-based)
   - Admin-based dispute resolution (not court-based)
   - Transaction evidence supports dispute resolution

5. **Data processing and consent**
   - Data collection purposes (transaction evidence, coordination)
   - Data minimization (only necessary data)
   - User consent requirements (explicit, recorded, time-stamped)

6. **Liability boundaries and exclusions**
   - Platform does not guarantee transaction completion
   - Platform does not insure users against loss
   - Platform does not act as agent or trustee
   - Users bear commercial risk

7. **Termination and suspension conditions**
   - User account suspension (admin authority)
   - User account termination (admin authority)
   - Platform shutdown (system operator authority)

8. **Governing law**
   - Republic of Uganda
   - Uganda contract law
   - Uganda consumer protection law (where applicable)

9. **Jurisdiction and venue**
   - Uganda courts
   - Uganda legal system
   - Dispute resolution procedures

**Legal Basis**: Phase 2 Legal Characterization (BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md Section 2)

---

### 4.3 What the Terms MUST NOT Do

**The Terms and Agreements must not**:

1. ❌ **Represent the platform as a bank, wallet, or payment service**
   - Must not claim banking or payment services
   - Must not imply deposit-taking or payment processing
   - Must align with Phase 2 legal characterization

2. ❌ **Promise settlement, delivery, or payment guarantees**
   - Must not guarantee transaction completion
   - Must not guarantee delivery or payment
   - Must not create performance guarantees

3. ❌ **Create fiduciary or custodial obligations**
   - Must not create trust relationships
   - Must not create custodial obligations
   - Must not create fiduciary duties

4. ❌ **Override statutory consumer protections**
   - Must not waive consumer protection rights
   - Must not override statutory protections
   - Must comply with Consumer Protection Act

5. ❌ **Waive criminal liability**
   - Must not waive criminal liability
   - Must not limit criminal prosecution
   - Must comply with criminal law

6. ❌ **Conflict with the BLOCKED 6 legal characterization**
   - Must align with Phase 2 legal characterization
   - Must align with Phase 3 regulatory verification
   - Must not contradict legal position

**Legal Basis**: Phase 2 Legal Characterization (BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md Section 2.9: Exclusions and Explicit Limitations)

---

## 5. Role-Based Agreement Strategy

### 5.1 Separation Principle

**Agreements will be role-specific, not monolithic.**

**Reason**:
- Different legal duties (farmers, traders, buyers have different obligations)
- Different risk exposure (different roles face different risks)
- Different evidentiary reliance (different roles rely on different transaction evidence)

**This avoids cross-role liability contamination.**

**Legal Basis**: Contract law requires clear allocation of rights and obligations. Role-specific agreements provide clarity and reduce legal risk.

---

### 5.2 Roles Identified

| Role | Agreement Required | Rationale |
|------|-------------------|-----------|
| **Farmer** | ✅ Yes | Agricultural producers have listing and delivery obligations |
| **Trader** | ✅ Yes | Intermediaries have capital management and exposure limit obligations |
| **Buyer** | ✅ Yes | End consumers have purchase and pickup obligations |
| **Administrator** | ✅ Yes | System administrators have dispute resolution and system control obligations |
| **System Operator** | Internal only | System operator agreement is internal (not user-facing) |

**Agreement Structure**:
- **Platform Terms of Service**: Applies to all users (common terms)
- **Role-Specific User Agreements**: Applies to specific roles (role-specific terms)
- **Combined Agreement**: User accepts both Platform Terms and Role-Specific Agreement

---

## 6. Consent Model Constraints

### 6.1 Legal Requirements

**User consent must be**:

1. ✅ **Explicit**
   - User must explicitly accept Terms of Service and User Agreement
   - No implied consent
   - No silence as consent

2. ✅ **Recorded**
   - Consent must be recorded in database
   - Consent record must be immutable
   - Consent record must be auditable

3. ✅ **Time-stamped**
   - Consent must include timestamp
   - Timestamp must be accurate
   - Timestamp must be immutable

4. ✅ **Versioned**
   - Consent must reference document version
   - Version must be recorded
   - Version changes require new consent

5. ✅ **Non-repudiable**
   - Consent must be non-repudiable
   - User cannot deny consent
   - Consent record must support non-repudiation

**Silence, continued use, or implied consent is insufficient.**

**Legal Basis**: Uganda contract law requires explicit consent. Data Protection and Privacy Act, 2019 requires explicit consent for data processing.

---

### 6.2 Technical Constraints (for Later Phases)

**Consent records must**:

1. ✅ **Be immutable**
   - Consent records cannot be modified or deleted
   - Consent records are permanent
   - Consent records support audit trail

2. ✅ **Reference document version**
   - Consent record must include Terms of Service version
   - Consent record must include User Agreement version
   - Version changes require new consent

3. ✅ **Be auditable**
   - Consent records must be queryable
   - Consent records must support audit trail
   - Consent records must support dispute resolution

4. ✅ **Survive account suspension or termination**
   - Consent records must persist after account suspension
   - Consent records must persist after account termination
   - Consent records must support historical audit

**Technical Implementation**: Consent records will be stored in database (schema to be defined in later phases).

**Legal Basis**: Audit trail requirements (AUDIT_MODEL.md), Data Protection and Privacy Act, 2019 (consent records must be maintained).

---

## 7. Risk Bounding (Phase 1)

### 7.1 Risk Identification

**Phase 1 identifies the following risk classes to be handled in later phases**:

#### Risk 1: Contractual Mischaracterization Risk

**Risk Description**: Terms of Service may mischaracterize the platform (e.g., as a bank, payment service, or financial institution)

**Risk Level**: **HIGH** (if mischaracterized, may trigger regulatory requirements)

**Mitigation Strategy** (for later phases):
- Terms must align with Phase 2 legal characterization
- Terms must explicitly exclude banking, payment, and financial services
- Terms must use precise legal language

**Legal Basis**: Phase 2 Legal Characterization (BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md)

---

#### Risk 2: Implied Financial Services Risk

**Risk Description**: Terms may create implied financial services obligations (e.g., deposit guarantees, payment guarantees)

**Risk Level**: **HIGH** (if implied, may trigger Financial Institutions Act or Payment Systems Act)

**Mitigation Strategy** (for later phases):
- Terms must explicitly disclaim financial services
- Terms must explicitly disclaim guarantees
- Terms must use clear exclusion language

**Legal Basis**: Phase 3 Regulatory Verification (BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT.md)

---

#### Risk 3: Evidence Admissibility Risk

**Risk Description**: Transaction evidence (UTID, audit trail) may not be admissible in legal proceedings

**Risk Level**: **MEDIUM** (evidence admissibility depends on Terms of Service and legal framework)

**Mitigation Strategy** (for later phases):
- Terms must establish transaction evidence as admissible
- Terms must reference Electronic Transactions Act, 2011
- Terms must establish non-repudiation framework

**Legal Basis**: Phase 2 Legal Characterization (BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md Section 2.7: Evidentiary Function and Legal Weight)

---

#### Risk 4: Data Misuse Risk

**Risk Description**: Terms may permit data misuse or violate data protection requirements

**Risk Level**: **MEDIUM** (data misuse may violate Data Protection and Privacy Act, 2019)

**Mitigation Strategy** (for later phases):
- Terms must comply with Data Protection and Privacy Act, 2019
- Terms must establish data processing purposes
- Terms must establish data minimization principles

**Legal Basis**: Phase 3 Regulatory Verification (BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT.md Section 8: Data Protection and Privacy Act)

---

#### Risk 5: Unfair Contract Terms Risk

**Risk Description**: Terms may contain unfair contract terms (e.g., excessive liability exclusions, unfair dispute resolution)

**Risk Level**: **MEDIUM** (unfair terms may be unenforceable under Uganda contract law)

**Mitigation Strategy** (for later phases):
- Terms must comply with Uganda contract law
- Terms must not contain unfair exclusions
- Terms must provide reasonable dispute resolution

**Legal Basis**: Uganda contract law, Consumer Protection Act

---

### 7.2 Risk Bounding Summary

**No mitigation is implemented in Phase 1.**

**Only identification and scoping.**

**Risk mitigation will occur in later phases** (Phase 2: Terms of Service Drafting, Phase 3: User Agreements Drafting).

---

## 8. Phase 1 Completion Criteria

### 8.1 Completion Criteria

**Phase 1 is considered COMPLETE when**:

1. ✅ **Document scope is locked**
   - Platform Terms of Service scope defined
   - Role-specific User Agreements scope defined
   - User Consent Record Model scope defined

2. ✅ **Role separation is approved**
   - Role-based agreement strategy approved
   - Role-specific agreements identified
   - Agreement structure defined

3. ✅ **Consent constraints are defined**
   - Legal requirements for consent defined
   - Technical constraints for consent defined
   - Consent record model requirements defined

4. ✅ **Drafting constraints are agreed**
   - What Terms MUST cover (defined)
   - What Terms MUST NOT do (defined)
   - Risk classes identified and bounded

5. ✅ **Dependencies are verified satisfied**
   - BLOCKED 6 completion verified ✅
   - Legal characterization available ✅
   - Regulatory verification available ✅

---

### 8.2 Phase 1 Status

**BLOCKED 7 — Phase 1 Status**: ✅ **COMPLETE**

**Completion Date**: 10 JAN-2026

**Deliverable**: This document (BLOCKED7_PHASE1_INITIATION_AND_SCOPE.md)

**Next Phase**: Phase 2 — Terms of Service Drafting (ready to commence)

---

## 9. Legal Counsel Attestation

### Phase 1 Scope Attestation

I, **Isaac Tom Musumba**, acting in my capacity as **Legal Counsel**, hereby attest that:

1. Phase 1 scope is legally sound and sufficient for Terms of Service and User Agreements drafting
2. Legal preconditions are satisfied (BLOCKED 6 completion verified)
3. Risk classes are identified and bounded
4. Drafting constraints are defined and approved
5. Phase 1 completion criteria are met

**Name**: Isaac Tom Musumba  
**Capacity**: Legal Counsel  
**Date**: **10 JAN-2026**

---

## 10. System Operator Attestation

### Phase 1 Approval Attestation

I, **Isaac Tom Musumba**, acting in my capacity as **System Operator (CEO / Engineering Lead / CTO)**, hereby formally attest that:

1. Phase 1 scope is approved and sufficient for Terms of Service and User Agreements drafting
2. Role-based agreement strategy is approved
3. Consent model constraints are approved
4. Drafting constraints are approved
5. Phase 1 is complete and ready for Phase 2

**Name**: Isaac Tom Musumba  
**Authority Basis**: Sole System Operator  
**Date**: **10 JAN-2026**

---

## 11. Next Steps

### Phase 2: Terms of Service Drafting

**Status**: ⏳ **READY TO COMMENCE**

**Prerequisites**:
- ✅ Phase 1 complete
- ✅ Legal preconditions satisfied (BLOCKED 6)
- ✅ Scope defined and approved

**Phase 2 Objectives**:
- Draft Platform Terms of Service
- Legal review of Terms of Service
- Terms of Service approval

**Phase 2 Deliverable**: Terms of Service document (legal text)

---

*This document is Phase 1 of BLOCKED 7 execution — initiation and scope definition only. No legal text drafting, no code implementation. Phase 2 (Terms of Service Drafting) will follow.*
