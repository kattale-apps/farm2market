# BLOCKED 7 — Phase 5: Consent & Acceptance Implementation Specification

**Capability**: Terms of Service and Role-Specific User Agreements  
**BLOCKED Status**: BLOCKED 7  
**Phase**: 5 — Consent & Acceptance Implementation  
**Status**: Specification only (no implementation, no code)  
**Governing Law**: Republic of Uganda  
**Date**: 10 JAN-2026

**Purpose**: This specification defines how user consent is captured, bound, stored, and proven for Terms of Service and Role-Specific User Agreements. Its purpose is to ensure that acceptance is legally enforceable under Ugandan law, technically non-repudiable, auditable, immutable, and role-scoped. This phase converts legal text into binding system obligations.

**No Implementation**: This document is a specification only. No code implementation, no UI design, no storage technology selection. Implementation will occur in later phases.

---

## 1. PURPOSE AND LEGAL FUNCTION

This specification defines how user consent is captured, bound, stored, and proven for:

* Terms of Service
* Role-Specific User Agreements

**Its purpose is to ensure that acceptance is**:

* Legally enforceable under Ugandan law
* Technically non-repudiable
* Auditable
* Immutable
* Role-scoped

**This phase converts legal text into binding system obligations.**

---

## 2. CONSENT PRINCIPLES (NON-NEGOTIABLE)

**All consent mechanisms SHALL satisfy the following principles**:

### 2.1 Explicitness

**Consent must be affirmative and unambiguous.**

* No implied consent
* No silence as consent
* No "browse-wrap" consent
* Explicit affirmative action required

### 2.2 Role-Specificity

**A User consents only to agreements corresponding to assigned roles.**

* Consent is role-scoped
* No cross-role consent
* New role assignment requires new consent
* Existing consent does not auto-extend to new roles

### 2.3 Version Binding

**Consent is tied to a specific document version.**

* Consent references document version
* Version changes require new consent
* Version is immutable in consent record

### 2.4 Temporal Certainty

**Consent includes a timestamp generated server-side.**

* Timestamp is server-generated (not client-generated)
* Timestamp is immutable
* Timestamp supports audit trail

### 2.5 Non-Repudiation

**Consent records cannot be altered or deleted.**

* Consent records are immutable
* Consent records cannot be deleted
* Consent records support non-repudiation

### 2.6 Evidentiary Sufficiency

**Consent records must be admissible as prima facie evidence.**

* Consent records support legal proceedings
* Consent records are auditable
* Consent records comply with Evidence Act (Uganda)

---

## 3. CONSENT TRIGGERS

**Consent SHALL be required at the following moments**:

### 3.1 Initial Account Activation

**User must accept**:

* Terms of Service
* All role-specific agreements assigned at creation

**Enforcement**: No account activation without acceptance of all required agreements.

### 3.2 Role Assignment or Change

**Any new role assignment requires acceptance of the corresponding agreement**

* Existing consent does not auto-extend to new roles
* New role assignment triggers consent requirement
* Access to new role functionality blocked until consent

**Enforcement**: No access to role-specific functionality without role-specific consent.

### 3.3 Material Document Update

**If Terms or Agreements change materially**:

* Re-consent is mandatory
* Access is suspended until acceptance
* Material changes require explicit definition

**Enforcement**: No access to platform functionality without acceptance of updated documents.

---

## 4. ACCEPTANCE FLOW REQUIREMENTS

### 4.1 Presentation Requirements

**The system SHALL**:

* Present documents in readable form
* Display version identifiers
* Prevent acceptance without viewing access

**Requirements**:
* Documents must be accessible before acceptance
* Version identifiers must be visible
* No acceptance without document access

### 4.2 Acceptance Action

**Acceptance SHALL require**:

* An explicit affirmative action (checkbox + confirmation)
* No pre-checked consent
* No implied or silent consent

**Requirements**:
* User must explicitly check consent checkbox
* User must confirm acceptance
* No pre-checked boxes
* No "continue" as consent

### 4.3 Blocking Enforcement

**If consent is not completed**:

* Access to protected functionality SHALL be blocked
* No transaction-recording actions permitted

**Enforcement**:
* No access to platform functionality without consent
* No transaction recording without consent
* No role-specific actions without role-specific consent

---

## 5. CONSENT RECORD DATA MODEL (MINIMUM REQUIRED FIELDS)

**Each consent record SHALL include**:

| Field | Description | Requirement |
|-------|-------------|-------------|
| **User Identifier** | Unique identifier for the user | Required, immutable |
| **Role Identifier** | Role for which consent is given | Required, immutable |
| **Document Identifier** | Terms of Service or User Agreement identifier | Required, immutable |
| **Document Version** | Version of document accepted | Required, immutable |
| **Consent Timestamp** | Server-generated timestamp | Required, immutable, server-side |
| **Consent Method** | UI acceptance, admin-facilitated, etc. | Required, immutable |
| **UTID or Equivalent Unique Identifier** | Unique identifier for consent record | Required, immutable |
| **System Version / Deployment ID** | System version at time of consent | Required, immutable |
| **Revocation Flag** | If applicable, revocation status | Optional, immutable once set |
| **Audit Hash or Integrity Marker** | Integrity verification marker | Required, immutable |

**These fields SHALL be immutable once written.**

---

## 6. STORAGE AND IMMUTABILITY REQUIREMENTS

### 6.1 Storage Location

**Consent records SHALL**:

* Be stored server-side
* Be independent of user session state
* Persist beyond account suspension or deletion

**Requirements**:
* No client-side storage of consent records
* No session-dependent consent records
* Consent records survive account suspension/termination

### 6.2 Immutability

**The system SHALL**:

* Prohibit deletion of consent records
* Prohibit modification of consent records
* Permit only additive records (new versions, new consents)

**Requirements**:
* No deletion of consent records
* No modification of consent records
* Only additive operations (new consents, new versions)

---

## 7. AUDIT AND VERIFICATION

### 7.1 Audit Visibility

**The system SHALL allow authorized audit access to**:

* Consent history per user
* Consent history per role
* Consent history per document version

**Requirements**:
* Query consent records by user
* Query consent records by role
* Query consent records by document version
* Audit access restricted to authorized administrators

### 7.2 Administrative Actions

**Any administrative override (if permitted) SHALL**:

* Be explicitly logged
* Include justification
* Be attributable to a named administrator

**Requirements**:
* All administrative actions logged
* Justification required for overrides
* Administrator identity recorded

---

## 8. LEGAL EFFECT AND EVIDENTIARY STATUS

### 8.1 Legal Effect

**Acceptance under this specification constitutes**:

* Binding contractual consent
* Acknowledgment of role-specific obligations
* Waiver of claims of non-notice

**Legal Basis**: Contract Act (Uganda), Evidence Act (Uganda)

### 8.2 Evidentiary Use

**Consent records SHALL be usable as**:

* Prima facie evidence
* Proof of notice
* Proof of agreement

**under Ugandan law.**

**Legal Basis**: Evidence Act (Uganda), Phase 2 Legal Characterization (BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md Section 2.7)

---

## 9. FAILURE MODES AND SAFE STATES

### 9.1 Consent Failure

**If consent capture fails**:

* User access SHALL be suspended
* No partial access permitted
* Failure SHALL be logged

**Requirements**:
* Fail-safe: deny access on consent failure
* Log all consent failures
* No partial access granted

### 9.2 System Failure

**If consent verification is unavailable**:

* Default state is deny access
* No transaction recording permitted

**Requirements**:
* Fail-safe: deny access on verification failure
* No transaction recording without consent verification
* System must recover to safe state

---

## 10. EXCLUSIONS AND LIMITATIONS

**This specification**:

* Does not define UI design
* Does not define storage technology
* Does not authorize bypass mechanisms
* Does not permit implied consent

**Scope Limitations**:
* UI design is implementation detail (later phase)
* Storage technology is implementation detail (later phase)
* No bypass mechanisms authorized
* No implied consent permitted

---

## 11. PHASE COMPLETION CRITERIA

**Phase 5 is considered COMPLETE when**:

1. ✅ **Consent principles are fully specified**
   - Explicitness ✅
   - Role-Specificity ✅
   - Version Binding ✅
   - Temporal Certainty ✅
   - Non-Repudiation ✅
   - Evidentiary Sufficiency ✅

2. ✅ **Acceptance flows are defined**
   - Presentation requirements ✅
   - Acceptance action requirements ✅
   - Blocking enforcement ✅

3. ✅ **Data model requirements are defined**
   - Minimum required fields specified ✅
   - Immutability requirements specified ✅
   - Storage requirements specified ✅

4. ✅ **Audit and evidentiary requirements are defined**
   - Audit visibility requirements ✅
   - Administrative action logging ✅
   - Evidentiary status defined ✅

5. ✅ **Failure handling is defined**
   - Consent failure handling ✅
   - System failure handling ✅
   - Safe states defined ✅

---

## 12. PHASE STATUS

**BLOCKED 7 — Phase 5: Consent & Acceptance Implementation**

**Status**: ✅ **COMPLETE (SPECIFICATION LOCKED)**

**Completion Date**: 10 JAN-2026

**Deliverable**: This document (BLOCKED7_PHASE5_CONSENT_AND_ACCEPTANCE_IMPLEMENTATION_SPEC.md)

**Next Phase**: Phase 6 — User Consent Framework Implementation (ready to commence)

---

## 13. Legal Counsel Attestation

### Phase 5 Specification Attestation

I, **Isaac Tom Musumba**, acting in my capacity as **Legal Counsel**, hereby attest that:

1. Consent and acceptance implementation specification is legally sound and sufficient
2. Specification ensures legally enforceable consent under Ugandan law
3. Specification ensures non-repudiable consent records
4. Specification ensures evidentiary sufficiency for legal proceedings
5. Specification aligns with Contract Act, Evidence Act, and Data Protection and Privacy Act, 2019

**Name**: Isaac Tom Musumba  
**Capacity**: Legal Counsel  
**Date**: **10 JAN-2026**

---

## 14. System Operator Attestation

### Phase 5 Approval Attestation

I, **Isaac Tom Musumba**, acting in my capacity as **System Operator (CEO / Engineering Lead / CTO)**, hereby formally attest that:

1. Consent and acceptance implementation specification is complete and approved
2. Specification ensures technical non-repudiation
3. Specification ensures auditability and immutability
4. Specification ensures role-scoped consent
5. Phase 5 is complete and ready for Phase 6

**Name**: Isaac Tom Musumba  
**Authority Basis**: Sole System Operator  
**Date**: **10 JAN-2026**

---

## 15. Next Steps

### Phase 6: User Consent Framework Implementation

**Status**: ⏳ **READY TO COMMENCE**

**Prerequisites**:
- ✅ Phase 1 complete (Initiation and Scope)
- ✅ Phase 2 complete (Clause Scaffolding)
- ✅ Phase 3 complete (Terms of Service Drafting)
- ✅ Phase 4 complete (User Agreements Drafting)
- ✅ Phase 5 complete (Consent & Acceptance Implementation Specification)
- ✅ Legal preconditions satisfied (BLOCKED 6)

**Phase 6 Objectives**:
- Implement user consent framework (backend)
- Implement consent record storage
- Implement consent verification
- Implement consent audit queries
- Test consent framework

**Phase 6 Deliverable**: User consent framework implementation (backend code)

---

*This document is Phase 5 of BLOCKED 7 execution — Consent & Acceptance Implementation Specification complete. Specification is locked and ready for implementation. Phase 6 (User Consent Framework Implementation) will follow.*
