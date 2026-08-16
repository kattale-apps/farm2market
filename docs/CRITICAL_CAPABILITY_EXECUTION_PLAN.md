# CRITICAL_CAPABILITY_EXECUTION_PLAN.md

**Critical Capability Execution Plan**

**Step**: 9 (IMPLEMENTATION_SEQUENCE.md Step 9)  
**Status**: Execution plan only (no implementation, no code)  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- GO_LIVE_BLOCKER_RESOLUTION_PLAN.md identifies 5 critical BLOCKED capabilities
- SYSTEM_ACTIVATION_AND_GO_LIVE_CONTROLS.md enumerates activation decisions
- PRODUCTION_AUTHORIZATION.md defines authorization framework
- This document covers execution planning for critical capabilities only

**Purpose**: This document defines for each CRITICAL BLOCKED capability:
- (a) Execution owner
- (b) Execution phases
- (c) Parallelizable vs sequential tasks
- (d) Verification artifacts required to mark ALLOWED
- (e) Explicit handoff to authorization

**No Implementation**: This plan does not implement any code, features, or changes. Only enumeration of execution planning, phases, tasks, verification artifacts, and authorization handoff.

---

## 1. BLOCKED 1: Production Authentication

### (a) Execution Owner

**Primary Owner**: System operator (CEO / Engineering Lead / CTO)

**Owner Responsibilities**:
- Overall execution coordination
- Code activation decisions
- Testing verification
- Security review approval
- Authorization handoff

**Supporting Roles**:
- Developer (if system operator is not the developer): Code implementation and testing
- Email service provider (if email delivery is required): Email service setup and configuration
- Legal counsel (if required): Terms of Service review for authentication-related clauses

**Owner Authority**: System operator has final authority over all execution decisions, testing verification, and authorization handoff.

---

### (b) Execution Phases

**Phase 1: Email Delivery Resolution**
- **Objective**: Resolve email delivery for password reset (or implement alternative)
- **Duration**: 1-3 days
- **Deliverable**: Email delivery mechanism implemented and tested (or alternative mechanism)

**Phase 2: Role Inference Removal**
- **Objective**: Remove email prefix inference from pilot mode (if still present)
- **Duration**: 1 day
- **Deliverable**: Role inference removed, explicit role assignment only

**Phase 3: Frontend Integration**
- **Objective**: Update frontend to use production authentication (if frontend exists)
- **Duration**: 2-5 days
- **Deliverable**: Frontend updated to use production authentication, tested

**Phase 4: Testing and Verification**
- **Objective**: Test production authentication end-to-end
- **Duration**: 2-3 days
- **Deliverable**: Production authentication tested, test results documented

**Phase 5: Security Review**
- **Objective**: Complete security review of authentication implementation
- **Duration**: 1-2 days
- **Deliverable**: Security review completed, security review report

**Phase 6: Activation**
- **Objective**: Activate production authentication (remove pilot mode shared password)
- **Duration**: 1 day
- **Deliverable**: Production authentication activated, pilot mode shared password removed

**Phase 7: Documentation**
- **Objective**: Document authentication flow, password reset flow, session management
- **Duration**: 1-2 days
- **Deliverable**: Authentication documentation completed, user documentation updated

**Total Estimated Duration**: 9-17 days (depending on email delivery complexity and frontend existence)

---

### (c) Parallelizable vs Sequential Tasks

**Sequential Tasks** (Must be completed in order):
1. **Email Delivery Resolution** → **Role Inference Removal** → **Frontend Integration** → **Testing** → **Security Review** → **Activation** → **Documentation**
   - **Reason**: Each phase depends on previous phase completion
   - **Dependency Chain**: Email delivery must be resolved before testing, role inference must be removed before activation, frontend must be updated before testing, testing must be completed before security review, security review must be completed before activation, activation must be completed before documentation

**Parallelizable Tasks** (Can be completed in parallel):
1. **Email Delivery Resolution** || **Role Inference Removal**
   - **Reason**: These are independent (email delivery does not depend on role inference removal)
   - **Constraint**: Both must be completed before Frontend Integration

2. **Documentation** || **Testing** (partial parallelization)
   - **Reason**: Documentation can begin during testing (document as tests are run)
   - **Constraint**: Final documentation must be completed after testing

**Task Dependencies**:
- Email Delivery Resolution: No dependencies
- Role Inference Removal: No dependencies
- Frontend Integration: Depends on Email Delivery Resolution and Role Inference Removal
- Testing: Depends on Frontend Integration
- Security Review: Depends on Testing
- Activation: Depends on Security Review
- Documentation: Depends on Activation (final documentation)

---

### (d) Verification Artifacts Required to Mark ALLOWED

**Artifact 1: Code Verification**
- **Artifact**: Code review report
- **Content**: 
  - Authentication module code exists (`convex/authentication/index.ts`)
  - Password hashing is secure (bcrypt, 10+ rounds)
  - Session management is implemented (stateful, database-backed)
  - Password reset token generation is implemented
  - Password reset delivery mechanism is implemented (email or alternative)
  - Email prefix inference is removed (explicit role assignment only)
  - Role assignment is admin-controlled only (via User Management module)
- **Format**: Written report or code review checklist
- **Owner**: System operator or designated developer

**Artifact 2: Testing Results**
- **Artifact**: Testing results report
- **Content**:
  - Production authentication tested with multiple users (at least 3 users)
  - Password reset flow tested end-to-end (token generation, delivery, reset completion)
  - Session management tested (creation, validation, expiration, invalidation)
  - Frontend integration tested (if frontend exists)
  - Error handling tested (invalid credentials, expired sessions, invalid tokens)
- **Format**: Test execution report with pass/fail results
- **Owner**: System operator or designated tester

**Artifact 3: Security Review Report**
- **Artifact**: Security review report
- **Content**:
  - Password hashing security verified (bcrypt implementation, rounds verification)
  - Session security verified (token generation, validation, expiration)
  - Password reset security verified (token generation, expiration, single-use)
  - Role assignment security verified (admin-controlled only, no inference)
  - Authentication error handling verified (indistinguishable errors, no user-state leakage)
- **Format**: Written security review report
- **Owner**: System operator or designated security reviewer

**Artifact 4: Activation Verification**
- **Artifact**: Activation verification report
- **Content**:
  - Production authentication activated (pilot mode shared password removed)
  - Frontend updated to use production authentication (if frontend exists)
  - Pilot mode authentication disabled (shared password no longer works)
  - Production authentication enabled (individual passwords work)
- **Format**: Activation checklist with verification results
- **Owner**: System operator

**Artifact 5: Documentation**
- **Artifact**: Authentication documentation
- **Content**:
  - Authentication flow documented
  - Password reset flow documented
  - Session management documented
  - User documentation updated (if user documentation exists)
- **Format**: Documentation files (markdown, PDF, or equivalent)
- **Owner**: System operator or designated technical writer

**All Artifacts Required**: All 5 artifacts must be completed and verified before marking ALLOWED.

---

### (e) Explicit Handoff to Authorization

**Handoff Trigger**: All verification artifacts completed and verified

**Handoff Process**:
1. **Artifact Compilation**: System operator compiles all verification artifacts
2. **Verification Summary**: System operator creates verification summary document
3. **Authorization Request**: System operator requests authorization for BLOCKED 1 resolution
4. **Authorization Review**: System operator reviews artifacts against acceptance criteria
5. **Authorization Decision**: System operator makes authorization decision (Authorized or Not Authorized)
6. **Authorization Record**: System operator creates authorization record in PRODUCTION_AUTHORIZATION.md
7. **GO_LIVE_READINESS.md Update**: System operator updates GO_LIVE_READINESS.md to mark BLOCKED 1 as ALLOWED

**Handoff Artifacts** (Must be provided to authorization):
- Code verification report
- Testing results report
- Security review report
- Activation verification report
- Documentation

**Handoff Criteria**:
- ✅ All 5 verification artifacts completed
- ✅ All acceptance criteria met (from GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)
- ✅ System operator verified all artifacts
- ✅ System operator ready to make authorization decision

**Authorization Decision Authority**: System operator (CEO / Engineering Lead / CTO) only

**Authorization Record Format**: 
- Authorization ID: `AUTH-BLOCKED1-YYYYMMDD-HHMMSS`
- Authorization State: Authorized or Not Authorized
- Evidence Artifacts: List of 5 verification artifacts
- Authorization Date: Date of authorization decision
- Operator Signature: System operator signature or equivalent formal record

**Post-Authorization**: 
- If Authorized: Update GO_LIVE_READINESS.md to mark BLOCKED 1 as ALLOWED
- If Not Authorized: Document reasons, update execution plan, re-execute if needed

---

## 2. BLOCKED 5: Pilot Mode Enforcement

### (a) Execution Owner

**Primary Owner**: System operator (CEO / Engineering Lead / CTO)

**Owner Responsibilities**:
- Overall execution coordination
- Code verification
- Testing execution
- Observability verification
- Audit logging verification
- Authorization handoff

**Supporting Roles**:
- Developer (if system operator is not the developer): Code fixes (if enforcement is missing), testing support
- Tester (if available): Testing execution support

**Owner Authority**: System operator has final authority over all execution decisions, verification, and authorization handoff.

---

### (b) Execution Phases

**Phase 1: Code Verification**
- **Objective**: Verify pilot mode enforcement exists in ALL money-moving mutations
- **Duration**: 1 day
- **Deliverable**: Code verification report listing all money-moving mutations and enforcement status

**Phase 2: Enforcement Implementation** (if missing)
- **Objective**: Implement pilot mode enforcement in any missing mutations
- **Duration**: 1-2 days (if enforcement is missing)
- **Deliverable**: Pilot mode enforcement implemented in all money-moving mutations

**Phase 3: Testing**
- **Objective**: Test pilot mode enforcement (enable pilot mode, attempt mutations, verify blocking)
- **Duration**: 1-2 days
- **Deliverable**: Testing results report with pass/fail results

**Phase 4: Observability Verification**
- **Objective**: Verify pilot mode enforcement observability (violations logged, metrics measurable)
- **Duration**: 1 day
- **Deliverable**: Observability verification report

**Phase 5: Audit Logging Verification**
- **Objective**: Verify pilot mode enforcement audit logging (violations logged in audit trail)
- **Duration**: 1 day
- **Deliverable**: Audit logging verification report

**Phase 6: Documentation**
- **Objective**: Update PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT.md with final status
- **Duration**: 1 day
- **Deliverable**: PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT.md updated with PASS status

**Total Estimated Duration**: 5-8 days (depending on whether enforcement is missing)

---

### (c) Parallelizable vs Sequential Tasks

**Sequential Tasks** (Must be completed in order):
1. **Code Verification** → **Enforcement Implementation** (if missing) → **Testing** → **Observability Verification** → **Audit Logging Verification** → **Documentation**
   - **Reason**: Each phase depends on previous phase completion
   - **Dependency Chain**: Code verification must identify missing enforcement, enforcement must be implemented before testing, testing must be completed before observability verification, observability verification must be completed before audit logging verification, audit logging verification must be completed before documentation

**Parallelizable Tasks** (Can be completed in parallel):
1. **Observability Verification** || **Audit Logging Verification**
   - **Reason**: These are independent (observability does not depend on audit logging verification)
   - **Constraint**: Both must be completed before Documentation

**Task Dependencies**:
- Code Verification: No dependencies
- Enforcement Implementation: Depends on Code Verification (only if enforcement is missing)
- Testing: Depends on Enforcement Implementation (or Code Verification if enforcement exists)
- Observability Verification: Depends on Testing
- Audit Logging Verification: Depends on Testing
- Documentation: Depends on Observability Verification and Audit Logging Verification

---

### (d) Verification Artifacts Required to Mark ALLOWED

**Artifact 1: Code Verification Report**
- **Artifact**: Code verification report
- **Content**:
  - All money-moving mutations enumerated
  - Pilot mode enforcement verified in ALL money-moving mutations
  - Enforcement is server-side (not client-side)
  - Enforcement cannot be bypassed
  - Code references for each mutation with enforcement
- **Format**: Written report with code references
- **Owner**: System operator or designated developer

**Artifact 2: Testing Results Report**
- **Artifact**: Testing results report
- **Content**:
  - Pilot mode enforcement tested (mutations blocked when enabled)
  - Testing performed for each money-moving mutation
  - Testing performed with different user roles
  - Testing performed with admin actions (should still work)
  - Testing performed with read-only queries (should still work)
- **Format**: Test execution report with pass/fail results
- **Owner**: System operator or designated tester

**Artifact 3: Observability Verification Report**
- **Artifact**: Observability verification report
- **Content**:
  - Pilot mode enforcement violations are logged
  - Pilot mode enforcement metrics can be measured
  - Pilot mode status is observable
  - Observability dashboards can display pilot mode status
- **Format**: Written report with observability evidence
- **Owner**: System operator

**Artifact 4: Audit Logging Verification Report**
- **Artifact**: Audit logging verification report
- **Content**:
  - Pilot mode enforcement violations are logged in audit trail
  - Pilot mode status changes are logged (AdminAction entries)
  - Audit trail is immutable (violations cannot be deleted)
  - Audit trail is queryable (violations can be retrieved)
- **Format**: Written report with audit logging evidence
- **Owner**: System operator

**Artifact 5: Updated Verification Report**
- **Artifact**: PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT.md updated
- **Content**:
  - All money-moving mutations verified to have enforcement
  - Final declaration: BLOCKED 5 Status: PASS
  - Evidence provided for each mutation
- **Format**: Updated markdown document
- **Owner**: System operator

**All Artifacts Required**: All 5 artifacts must be completed and verified before marking ALLOWED.

---

### (e) Explicit Handoff to Authorization

**Handoff Trigger**: All verification artifacts completed and verified

**Handoff Process**:
1. **Artifact Compilation**: System operator compiles all verification artifacts
2. **Verification Summary**: System operator creates verification summary document
3. **Authorization Request**: System operator requests authorization for BLOCKED 5 resolution
4. **Authorization Review**: System operator reviews artifacts against acceptance criteria
5. **Authorization Decision**: System operator makes authorization decision (Authorized or Not Authorized)
6. **Authorization Record**: System operator creates authorization record in PRODUCTION_AUTHORIZATION.md
7. **GO_LIVE_READINESS.md Update**: System operator updates GO_LIVE_READINESS.md to mark BLOCKED 5 as ALLOWED

**Handoff Artifacts** (Must be provided to authorization):
- Code verification report
- Testing results report
- Observability verification report
- Audit logging verification report
- Updated PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT.md

**Handoff Criteria**:
- ✅ All 5 verification artifacts completed
- ✅ All acceptance criteria met (from GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)
- ✅ System operator verified all artifacts
- ✅ System operator ready to make authorization decision

**Authorization Decision Authority**: System operator (CEO / Engineering Lead / CTO) only

**Authorization Record Format**: 
- Authorization ID: `AUTH-BLOCKED5-YYYYMMDD-HHMMSS`
- Authorization State: Authorized or Not Authorized
- Evidence Artifacts: List of 5 verification artifacts
- Authorization Date: Date of authorization decision
- Operator Signature: System operator signature or equivalent formal record

**Post-Authorization**: 
- If Authorized: Update GO_LIVE_READINESS.md to mark BLOCKED 5 as ALLOWED
- If Not Authorized: Document reasons, update execution plan, re-execute if needed

---

## 3. BLOCKED 6: Legal Compliance

### (a) Execution Owner

**Primary Owner**: System operator (CEO / Engineering Lead / CTO)

**Owner Responsibilities**:
- Overall execution coordination
- Legal counsel engagement
- Legal review coordination
- Regulatory verification coordination
- Legal compliance documentation
- Authorization handoff

**Supporting Roles**:
- Legal counsel (qualified, Uganda-based or familiar with Uganda regulations): Legal review, regulatory verification, legal documentation
- Regulatory expert (if required): Regulatory compliance verification

**Owner Authority**: System operator has final authority over all execution decisions, legal compliance approval, and authorization handoff.

---

### (b) Execution Phases

**Phase 1: Legal Counsel Engagement**
- **Objective**: Engage qualified legal counsel (Uganda-based or familiar with Uganda regulations)
- **Duration**: 1-3 days
- **Deliverable**: Legal counsel engaged, engagement agreement signed

**Phase 2: Legal Review**
- **Objective**: Legal counsel reviews system architecture, business model, and operations
- **Duration**: 1-2 weeks
- **Deliverable**: Legal review completed, legal review report

**Phase 3: Regulatory Verification**
- **Objective**: Verify legal framework compliance (Uganda regulations, financial regulation, data protection)
- **Duration**: 1-2 weeks
- **Deliverable**: Regulatory verification completed, regulatory compliance report

**Phase 4: Legal Documentation**
- **Objective**: Document legal compliance status, risks, and mitigation strategies
- **Duration**: 3-5 days
- **Deliverable**: Legal compliance report

**Phase 5: Legal Approval**
- **Objective**: System operator reviews and approves legal compliance (with legal counsel)
- **Duration**: 1-2 days
- **Deliverable**: Legal compliance approved, approval documented

**Phase 6: Documentation Update**
- **Objective**: Update PRODUCTION_AUTHORIZATION.md with legal compliance evidence
- **Duration**: 1 day
- **Deliverable**: PRODUCTION_AUTHORIZATION.md updated with legal compliance evidence

**Total Estimated Duration**: 3-5 weeks (depending on legal counsel availability and review complexity)

---

### (c) Parallelizable vs Sequential Tasks

**Sequential Tasks** (Must be completed in order):
1. **Legal Counsel Engagement** → **Legal Review** → **Regulatory Verification** → **Legal Documentation** → **Legal Approval** → **Documentation Update**
   - **Reason**: Each phase depends on previous phase completion
   - **Dependency Chain**: Legal counsel must be engaged before legal review, legal review must be completed before regulatory verification, regulatory verification must be completed before legal documentation, legal documentation must be completed before legal approval, legal approval must be completed before documentation update

**Parallelizable Tasks** (Can be completed in parallel):
1. **Legal Review** || **Regulatory Verification** (partial parallelization)
   - **Reason**: Legal review and regulatory verification can proceed in parallel (legal counsel can review while regulatory expert verifies)
   - **Constraint**: Both must be completed before Legal Documentation

**Task Dependencies**:
- Legal Counsel Engagement: No dependencies
- Legal Review: Depends on Legal Counsel Engagement
- Regulatory Verification: Depends on Legal Counsel Engagement (can proceed in parallel with Legal Review)
- Legal Documentation: Depends on Legal Review and Regulatory Verification
- Legal Approval: Depends on Legal Documentation
- Documentation Update: Depends on Legal Approval

---

### (d) Verification Artifacts Required to Mark ALLOWED

**Artifact 1: Legal Counsel Engagement Record**
- **Artifact**: Legal counsel engagement record
- **Content**:
  - Legal counsel name and qualifications
  - Engagement agreement signed
  - Legal counsel contact information
  - Engagement scope defined
- **Format**: Written record or engagement agreement
- **Owner**: System operator

**Artifact 2: Legal Review Report**
- **Artifact**: Legal review report
- **Content**:
  - System architecture reviewed
  - Business model reviewed
  - Operations reviewed
  - Legal requirements identified
  - Legal risks identified
  - Mitigation strategies identified
- **Format**: Written legal review report
- **Owner**: Legal counsel

**Artifact 3: Regulatory Compliance Report**
- **Artifact**: Regulatory compliance report
- **Content**:
  - Legal framework compliance verified (Uganda regulations)
  - Financial regulation compliance verified (closed-loop ledger legal status)
  - Data protection compliance verified (Uganda data protection laws)
  - Any other applicable regulations verified
  - Compliance measures documented
- **Format**: Written regulatory compliance report
- **Owner**: Legal counsel or regulatory expert

**Artifact 4: Legal Compliance Report**
- **Artifact**: Legal compliance report
- **Content**:
  - Legal compliance status documented
  - Legal risks documented
  - Mitigation strategies documented
  - Regulatory requirements documented
  - Compliance measures documented
- **Format**: Written legal compliance report
- **Owner**: System operator (with legal counsel input)

**Artifact 5: Legal Approval Record**
- **Artifact**: Legal approval record
- **Content**:
  - Legal compliance reviewed by system operator
  - Legal compliance approved by system operator (with legal counsel)
  - Approval date documented
  - Approval rationale documented (if required)
- **Format**: Written approval record or signature
- **Owner**: System operator

**All Artifacts Required**: All 5 artifacts must be completed and verified before marking ALLOWED.

---

### (e) Explicit Handoff to Authorization

**Handoff Trigger**: All verification artifacts completed and verified

**Handoff Process**:
1. **Artifact Compilation**: System operator compiles all verification artifacts
2. **Verification Summary**: System operator creates verification summary document
3. **Authorization Request**: System operator requests authorization for BLOCKED 6 resolution
4. **Authorization Review**: System operator reviews artifacts against acceptance criteria
5. **Authorization Decision**: System operator makes authorization decision (Authorized or Not Authorized)
6. **Authorization Record**: System operator creates authorization record in PRODUCTION_AUTHORIZATION.md
7. **GO_LIVE_READINESS.md Update**: System operator updates GO_LIVE_READINESS.md to mark BLOCKED 6 as ALLOWED

**Handoff Artifacts** (Must be provided to authorization):
- Legal counsel engagement record
- Legal review report
- Regulatory compliance report
- Legal compliance report
- Legal approval record

**Handoff Criteria**:
- ✅ All 5 verification artifacts completed
- ✅ All acceptance criteria met (from GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)
- ✅ System operator verified all artifacts
- ✅ System operator ready to make authorization decision

**Authorization Decision Authority**: System operator (CEO / Engineering Lead / CTO) only

**Authorization Record Format**: 
- Authorization ID: `AUTH-BLOCKED6-YYYYMMDD-HHMMSS`
- Authorization State: Authorized or Not Authorized
- Evidence Artifacts: List of 5 verification artifacts
- Authorization Date: Date of authorization decision
- Operator Signature: System operator signature or equivalent formal record

**Post-Authorization**: 
- If Authorized: Update GO_LIVE_READINESS.md to mark BLOCKED 6 as ALLOWED
- If Not Authorized: Document reasons, update execution plan, re-execute if needed

---

## 4. BLOCKED 7: Terms of Service and User Agreements

### (a) Execution Owner

**Primary Owner**: System operator (CEO / Engineering Lead / CTO)

**Owner Responsibilities**:
- Overall execution coordination
- Legal counsel coordination (for Terms of Service review)
- Technical implementation coordination (for user consent framework)
- Terms of Service and user agreements approval
- Authorization handoff

**Supporting Roles**:
- Legal counsel: Terms of Service and user agreements review
- Developer (if system operator is not the developer): User consent framework implementation
- Technical writer (if available): Terms of Service and user agreements drafting support

**Owner Authority**: System operator has final authority over all execution decisions, Terms of Service approval, and authorization handoff.

---

### (b) Execution Phases

**Phase 1: Terms of Service Drafting**
- **Objective**: Draft Terms of Service document
- **Duration**: 3-5 days
- **Deliverable**: Terms of Service document drafted

**Phase 2: User Agreements Drafting**
- **Objective**: Draft user agreements document
- **Duration**: 2-3 days
- **Deliverable**: User agreements document drafted

**Phase 3: Liability Allocation Specification**
- **Objective**: Specify liability allocation in Terms of Service and user agreements
- **Duration**: 1-2 days
- **Deliverable**: Liability allocation specified

**Phase 4: Legal Review**
- **Objective**: Legal counsel reviews Terms of Service and user agreements
- **Duration**: 1 week
- **Deliverable**: Terms of Service and user agreements reviewed, legal review report

**Phase 5: User Consent Framework Implementation**
- **Objective**: Implement user consent framework (frontend and backend)
- **Duration**: 3-5 days
- **Deliverable**: User consent framework implemented, tested

**Phase 6: Terms of Service Acceptance Flow Implementation**
- **Objective**: Implement Terms of Service acceptance flow
- **Duration**: 2-3 days
- **Deliverable**: Terms of Service acceptance flow implemented, tested

**Phase 7: User Agreement Acceptance Flow Implementation**
- **Objective**: Implement user agreement acceptance flow
- **Duration**: 2-3 days
- **Deliverable**: User agreement acceptance flow implemented, tested

**Phase 8: Testing and Verification**
- **Objective**: Test user consent flow end-to-end
- **Duration**: 2-3 days
- **Deliverable**: Testing results report

**Phase 9: Approval**
- **Objective**: System operator reviews and approves Terms of Service and user agreements (with legal counsel)
- **Duration**: 1-2 days
- **Deliverable**: Terms of Service and user agreements approved, approval documented

**Phase 10: Documentation**
- **Objective**: Document Terms of Service and user agreements, user consent framework
- **Duration**: 1-2 days
- **Deliverable**: Terms of Service and user agreements documented, user consent framework documented

**Total Estimated Duration**: 3-4 weeks (depending on legal review complexity and implementation complexity)

---

### (c) Parallelizable vs Sequential Tasks

**Sequential Tasks** (Must be completed in order):
1. **Terms of Service Drafting** → **User Agreements Drafting** → **Liability Allocation Specification** → **Legal Review** → **User Consent Framework Implementation** → **Terms of Service Acceptance Flow** → **User Agreement Acceptance Flow** → **Testing** → **Approval** → **Documentation**
   - **Reason**: Each phase depends on previous phase completion
   - **Dependency Chain**: Terms of Service must be drafted before legal review, user agreements must be drafted before legal review, liability allocation must be specified before legal review, legal review must be completed before implementation, user consent framework must be implemented before acceptance flows, acceptance flows must be implemented before testing, testing must be completed before approval, approval must be completed before documentation

**Parallelizable Tasks** (Can be completed in parallel):
1. **Terms of Service Drafting** || **User Agreements Drafting**
   - **Reason**: These are independent (Terms of Service does not depend on user agreements drafting)
   - **Constraint**: Both must be completed before Liability Allocation Specification

2. **Terms of Service Acceptance Flow Implementation** || **User Agreement Acceptance Flow Implementation**
   - **Reason**: These are independent (Terms of Service acceptance does not depend on user agreement acceptance)
   - **Constraint**: Both must be completed before Testing

**Task Dependencies**:
- Terms of Service Drafting: No dependencies
- User Agreements Drafting: No dependencies
- Liability Allocation Specification: Depends on Terms of Service Drafting and User Agreements Drafting
- Legal Review: Depends on Terms of Service Drafting, User Agreements Drafting, and Liability Allocation Specification
- User Consent Framework Implementation: Depends on Legal Review
- Terms of Service Acceptance Flow Implementation: Depends on User Consent Framework Implementation
- User Agreement Acceptance Flow Implementation: Depends on User Consent Framework Implementation
- Testing: Depends on Terms of Service Acceptance Flow Implementation and User Agreement Acceptance Flow Implementation
- Approval: Depends on Testing
- Documentation: Depends on Approval

---

### (d) Verification Artifacts Required to Mark ALLOWED

**Artifact 1: Terms of Service Document**
- **Artifact**: Terms of Service document
- **Content**:
  - Terms of Service drafted
  - Terms of Service reviewed by legal counsel
  - Terms of Service approved by system operator
  - Liability allocation specified
- **Format**: Written document (PDF, markdown, or equivalent)
- **Owner**: System operator (with legal counsel review)

**Artifact 2: User Agreements Document**
- **Artifact**: User agreements document
- **Content**:
  - User agreements drafted
  - User agreements reviewed by legal counsel
  - User agreements approved by system operator
  - Liability allocation specified
- **Format**: Written document (PDF, markdown, or equivalent)
- **Owner**: System operator (with legal counsel review)

**Artifact 3: User Consent Framework Implementation**
- **Artifact**: Code verification and testing results
- **Content**:
  - User consent framework implemented (frontend and backend)
  - User consent stored in database (auditable)
  - User consent framework tested
  - User consent storage verified (consent is stored and auditable)
- **Format**: Code review report and testing results
- **Owner**: System operator or designated developer

**Artifact 4: Acceptance Flow Implementation**
- **Artifact**: Code verification and testing results
- **Content**:
  - Terms of Service acceptance flow implemented
  - User agreement acceptance flow implemented
  - Acceptance flows tested end-to-end
  - Acceptance flows verified (users can accept Terms of Service and user agreements)
- **Format**: Code review report and testing results
- **Owner**: System operator or designated developer

**Artifact 5: Testing Results Report**
- **Artifact**: Testing results report
- **Content**:
  - User consent flow tested end-to-end
  - Terms of Service acceptance tested
  - User agreement acceptance tested
  - User consent storage tested (consent is stored and auditable)
  - Error handling tested (rejection, expiration, etc.)
- **Format**: Test execution report with pass/fail results
- **Owner**: System operator or designated tester

**Artifact 6: Approval Record**
- **Artifact**: Approval record
- **Content**:
  - Terms of Service reviewed by system operator
  - User agreements reviewed by system operator
  - Terms of Service and user agreements approved by system operator (with legal counsel)
  - Approval date documented
- **Format**: Written approval record or signature
- **Owner**: System operator

**All Artifacts Required**: All 6 artifacts must be completed and verified before marking ALLOWED.

---

### (e) Explicit Handoff to Authorization

**Handoff Trigger**: All verification artifacts completed and verified

**Handoff Process**:
1. **Artifact Compilation**: System operator compiles all verification artifacts
2. **Verification Summary**: System operator creates verification summary document
3. **Authorization Request**: System operator requests authorization for BLOCKED 7 resolution
4. **Authorization Review**: System operator reviews artifacts against acceptance criteria
5. **Authorization Decision**: System operator makes authorization decision (Authorized or Not Authorized)
6. **Authorization Record**: System operator creates authorization record in PRODUCTION_AUTHORIZATION.md
7. **GO_LIVE_READINESS.md Update**: System operator updates GO_LIVE_READINESS.md to mark BLOCKED 7 as ALLOWED

**Handoff Artifacts** (Must be provided to authorization):
- Terms of Service document
- User agreements document
- User consent framework implementation verification
- Acceptance flow implementation verification
- Testing results report
- Approval record

**Handoff Criteria**:
- ✅ All 6 verification artifacts completed
- ✅ All acceptance criteria met (from GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)
- ✅ System operator verified all artifacts
- ✅ System operator ready to make authorization decision

**Authorization Decision Authority**: System operator (CEO / Engineering Lead / CTO) only

**Authorization Record Format**: 
- Authorization ID: `AUTH-BLOCKED7-YYYYMMDD-HHMMSS`
- Authorization State: Authorized or Not Authorized
- Evidence Artifacts: List of 6 verification artifacts
- Authorization Date: Date of authorization decision
- Operator Signature: System operator signature or equivalent formal record

**Post-Authorization**: 
- If Authorized: Update GO_LIVE_READINESS.md to mark BLOCKED 7 as ALLOWED
- If Not Authorized: Document reasons, update execution plan, re-execute if needed

---

## 5. BLOCKED 8: Backup and Restore Procedures

### (a) Execution Owner

**Primary Owner**: System operator (CEO / Engineering Lead / CTO)

**Owner Responsibilities**:
- Overall execution coordination
- Convex dashboard access verification
- Backup procedures verification
- Restore procedures verification
- Restore testing coordination
- Documentation
- Authorization handoff

**Supporting Roles**:
- Convex support (if required): Backup and restore procedure information
- Developer (if system operator is not the developer): Restore testing support (if required)

**Owner Authority**: System operator has final authority over all execution decisions, verification, and authorization handoff.

---

### (b) Execution Phases

**Phase 1: Convex Dashboard Access Verification**
- **Objective**: Verify operator has access to Convex dashboard
- **Duration**: 1 day
- **Deliverable**: Convex dashboard access verified, access documented

**Phase 2: Backup Procedures Verification**
- **Objective**: Verify Convex backup procedures (frequency, retention, storage, access)
- **Duration**: 1-2 days
- **Deliverable**: Backup procedures verified, backup procedures documented

**Phase 3: Restore Procedures Verification**
- **Objective**: Verify Convex restore procedures (restore process, time, requirements)
- **Duration**: 1-2 days
- **Deliverable**: Restore procedures verified, restore procedures documented

**Phase 4: Operator Access Verification**
- **Objective**: Verify operator access to backups and restore capabilities
- **Duration**: 1 day
- **Deliverable**: Operator access verified, access documented

**Phase 5: Restore Testing** (if possible)
- **Objective**: Perform restore testing in non-production environment (if possible)
- **Duration**: 1-2 days
- **Deliverable**: Restore testing performed, restore testing results documented

**Phase 6: Documentation**
- **Objective**: Document backup and restore procedures
- **Duration**: 1-2 days
- **Deliverable**: BACKUP_AND_RESTORE_VERIFICATION_REPORT.md updated with verified procedures

**Total Estimated Duration**: 6-10 days (depending on Convex support response time and restore testing feasibility)

---

### (c) Parallelizable vs Sequential Tasks

**Sequential Tasks** (Must be completed in order):
1. **Convex Dashboard Access Verification** → **Backup Procedures Verification** → **Restore Procedures Verification** → **Operator Access Verification** → **Restore Testing** (if possible) → **Documentation**
   - **Reason**: Each phase depends on previous phase completion
   - **Dependency Chain**: Dashboard access must be verified before backup procedures verification, backup procedures must be verified before restore procedures verification, restore procedures must be verified before operator access verification, operator access must be verified before restore testing, restore testing must be completed before documentation

**Parallelizable Tasks** (Can be completed in parallel):
1. **Backup Procedures Verification** || **Restore Procedures Verification** (partial parallelization)
   - **Reason**: These can proceed in parallel (backup and restore information can be gathered simultaneously)
   - **Constraint**: Both must be completed before Operator Access Verification

**Task Dependencies**:
- Convex Dashboard Access Verification: No dependencies
- Backup Procedures Verification: Depends on Convex Dashboard Access Verification
- Restore Procedures Verification: Depends on Convex Dashboard Access Verification (can proceed in parallel with Backup Procedures Verification)
- Operator Access Verification: Depends on Backup Procedures Verification and Restore Procedures Verification
- Restore Testing: Depends on Operator Access Verification (only if testing is possible)
- Documentation: Depends on Restore Testing (or Operator Access Verification if testing is not possible)

---

### (d) Verification Artifacts Required to Mark ALLOWED

**Artifact 1: Convex Dashboard Access Verification**
- **Artifact**: Dashboard access verification record
- **Content**:
  - Operator has access to Convex dashboard
  - Dashboard URL and project information documented
  - Access credentials secured (if applicable)
- **Format**: Written record or screenshot
- **Owner**: System operator

**Artifact 2: Backup Procedures Verification Report**
- **Artifact**: Backup procedures verification report
- **Content**:
  - Backup procedures verified (Convex backup access confirmed)
  - Backup frequency verified (e.g., "Continuous", "Daily", "Hourly", "Real-time")
  - Backup retention policy verified (e.g., "30 days", "7 days", "Point-in-time recovery")
  - Backup storage location verified
  - Backup access verified (operator can access backup information)
- **Format**: Written report with verification evidence
- **Owner**: System operator

**Artifact 3: Restore Procedures Verification Report**
- **Artifact**: Restore procedures verification report
- **Content**:
  - Restore procedures verified (restore process documented and tested)
  - Restore time verified (how long restore takes)
  - Restore process verified (step-by-step restore process)
  - Restore requirements verified (what is required to perform restore)
  - Restore testing requirements verified (if testing is possible)
- **Format**: Written report with verification evidence
- **Owner**: System operator

**Artifact 4: Operator Access Verification Report**
- **Artifact**: Operator access verification report
- **Content**:
  - Operator access to backups verified (operator can access backup information)
  - Operator can initiate restore process (if required)
  - Operator access procedures documented
- **Format**: Written report with verification evidence
- **Owner**: System operator

**Artifact 5: Restore Testing Results** (if testing is possible)
- **Artifact**: Restore testing results report
- **Content**:
  - Restore testing performed (if possible in non-production environment)
  - Restore process works (tested)
  - Data integrity after restore verified (if restore testing performed)
  - Restore testing results documented
- **Format**: Test execution report with pass/fail results
- **Owner**: System operator

**Artifact 6: Updated Verification Report**
- **Artifact**: BACKUP_AND_RESTORE_VERIFICATION_REPORT.md updated
- **Content**:
  - Backup procedures documented
  - Restore procedures documented
  - Operator access documented
  - Restore testing results documented (if testing was performed)
  - Final declaration: BLOCKED 8 Status: PASS
- **Format**: Updated markdown document
- **Owner**: System operator

**All Artifacts Required**: All 6 artifacts must be completed and verified before marking ALLOWED (Artifact 5 is optional if restore testing is not possible).

---

### (e) Explicit Handoff to Authorization

**Handoff Trigger**: All verification artifacts completed and verified

**Handoff Process**:
1. **Artifact Compilation**: System operator compiles all verification artifacts
2. **Verification Summary**: System operator creates verification summary document
3. **Authorization Request**: System operator requests authorization for BLOCKED 8 resolution
4. **Authorization Review**: System operator reviews artifacts against acceptance criteria
5. **Authorization Decision**: System operator makes authorization decision (Authorized or Not Authorized)
6. **Authorization Record**: System operator creates authorization record in PRODUCTION_AUTHORIZATION.md
7. **GO_LIVE_READINESS.md Update**: System operator updates GO_LIVE_READINESS.md to mark BLOCKED 8 as ALLOWED

**Handoff Artifacts** (Must be provided to authorization):
- Convex dashboard access verification record
- Backup procedures verification report
- Restore procedures verification report
- Operator access verification report
- Restore testing results (if testing was performed)
- Updated BACKUP_AND_RESTORE_VERIFICATION_REPORT.md

**Handoff Criteria**:
- ✅ All required verification artifacts completed (5-6 artifacts, depending on restore testing feasibility)
- ✅ All acceptance criteria met (from GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)
- ✅ System operator verified all artifacts
- ✅ System operator ready to make authorization decision

**Authorization Decision Authority**: System operator (CEO / Engineering Lead / CTO) only

**Authorization Record Format**: 
- Authorization ID: `AUTH-BLOCKED8-YYYYMMDD-HHMMSS`
- Authorization State: Authorized or Not Authorized
- Evidence Artifacts: List of verification artifacts (5-6 artifacts)
- Authorization Date: Date of authorization decision
- Operator Signature: System operator signature or equivalent formal record

**Post-Authorization**: 
- If Authorized: Update GO_LIVE_READINESS.md to mark BLOCKED 8 as ALLOWED
- If Not Authorized: Document reasons, update execution plan, re-execute if needed

---

## 6. Cross-Capability Execution Coordination

### Parallel Execution Opportunities

**Capabilities That Can Be Executed in Parallel**:
1. **BLOCKED 5: Pilot Mode Enforcement** || **BLOCKED 8: Backup and Restore Procedures**
   - **Reason**: These are independent (pilot mode enforcement does not depend on backup/restore procedures)
   - **Constraint**: Both must be completed before system activation

2. **BLOCKED 6: Legal Compliance** || **BLOCKED 1: Production Authentication** (partial parallelization)
   - **Reason**: Legal compliance (legal review) can proceed in parallel with production authentication (code work)
   - **Constraint**: Both must be completed before system activation

3. **BLOCKED 7: Terms of Service and User Agreements** || **BLOCKED 1: Production Authentication** (partial parallelization, after legal review)
   - **Reason**: Terms of Service implementation can proceed in parallel with production authentication (after legal review is complete)
   - **Constraint**: Both must be completed before system activation

**Capabilities That Must Be Sequential**:
1. **BLOCKED 6: Legal Compliance** → **BLOCKED 7: Terms of Service and User Agreements**
   - **Reason**: Terms of Service depends on legal review completion
   - **Constraint**: Legal review must be completed before Terms of Service legal review

---

### Execution Priority

**Priority 1 (Lowest Effort, Fastest Resolution)**:
1. **BLOCKED 5: Pilot Mode Enforcement** — 5-8 days
2. **BLOCKED 8: Backup and Restore Procedures** — 6-10 days

**Priority 2 (High Effort, Can Proceed in Parallel)**:
3. **BLOCKED 1: Production Authentication** — 9-17 days
4. **BLOCKED 6: Legal Compliance** — 3-5 weeks

**Priority 3 (Depends on Priority 2)**:
5. **BLOCKED 7: Terms of Service and User Agreements** — 3-4 weeks (depends on BLOCKED 6 completion)

**Recommended Execution Order**:
1. Start **BLOCKED 5** and **BLOCKED 8** in parallel (fastest resolution)
2. Start **BLOCKED 1** and **BLOCKED 6** in parallel (high effort, can proceed simultaneously)
3. Start **BLOCKED 7** after **BLOCKED 6** legal review is complete (depends on legal review)

**Total Estimated Duration** (if executed optimally): 3-5 weeks (limited by longest parallel path: BLOCKED 6 or BLOCKED 1)

---

### Execution Dependencies

**No Cross-Capability Dependencies**: All 5 critical capabilities can be executed independently. No capability depends on another for execution.

**Internal Dependencies** (within each capability):
- Each capability has internal phase dependencies (documented in each capability's execution phases)

**External Dependencies**:
- **BLOCKED 1**: Email service provider (if email delivery is required)
- **BLOCKED 6**: Legal counsel availability
- **BLOCKED 7**: Legal counsel availability (depends on BLOCKED 6 legal review)
- **BLOCKED 8**: Convex support/information availability

---

## 7. Authorization Handoff Summary

### Handoff Process (Common to All Capabilities)

**Step 1: Artifact Compilation**
- System operator compiles all verification artifacts for the capability
- Artifacts are organized and ready for review

**Step 2: Verification Summary**
- System operator creates verification summary document
- Summary references all artifacts and acceptance criteria

**Step 3: Authorization Request**
- System operator requests authorization for capability resolution
- Request includes verification summary and artifacts

**Step 4: Authorization Review**
- System operator reviews artifacts against acceptance criteria
- Review verifies all criteria are met

**Step 5: Authorization Decision**
- System operator makes authorization decision (Authorized or Not Authorized)
- Decision is documented

**Step 6: Authorization Record**
- System operator creates authorization record in PRODUCTION_AUTHORIZATION.md
- Record includes authorization ID, state, evidence artifacts, date, signature

**Step 7: GO_LIVE_READINESS.md Update**
- System operator updates GO_LIVE_READINESS.md to mark capability as ALLOWED
- Update includes evidence reference

---

### Authorization Record Format (Common to All Capabilities)

**Required Fields**:
- Authorization ID: `AUTH-BLOCKED{X}-YYYYMMDD-HHMMSS`
- Authorization State: Authorized or Not Authorized
- Evidence Artifacts: List of verification artifacts
- Authorization Date: Date of authorization decision
- Operator Signature: System operator signature or equivalent formal record

**Optional Fields**:
- Authorization Rationale: Reason for authorization decision (if required)
- Conditions: Any conditions attached to authorization (if Conditionally Authorized)

---

### Post-Authorization Actions

**If Authorized**:
- Update GO_LIVE_READINESS.md to mark capability as ALLOWED
- Update capability status in SYSTEM_ACTIVATION_AND_GO_LIVE_CONTROLS.md
- Proceed to next critical capability (if not all are authorized)

**If Not Authorized**:
- Document reasons for not authorizing
- Update execution plan with required fixes
- Re-execute capability resolution if needed
- Re-request authorization after fixes

---

## 8. Execution Timeline Summary

### Estimated Timeline (Sequential Execution)

**If Executed Sequentially** (worst case):
- BLOCKED 5: 5-8 days
- BLOCKED 8: 6-10 days
- BLOCKED 1: 9-17 days
- BLOCKED 6: 3-5 weeks
- BLOCKED 7: 3-4 weeks (after BLOCKED 6)
- **Total**: 8-12 weeks

### Estimated Timeline (Parallel Execution)

**If Executed in Parallel** (optimal case):
- **Path 1**: BLOCKED 5 (5-8 days) || BLOCKED 8 (6-10 days) → **10 days**
- **Path 2**: BLOCKED 1 (9-17 days) || BLOCKED 6 (3-5 weeks) → **3-5 weeks**
- **Path 3**: BLOCKED 7 (3-4 weeks, after BLOCKED 6) → **3-4 weeks after Path 2**
- **Total**: 6-9 weeks (limited by longest path: Path 2 + Path 3)

### Critical Path

**Critical Path**: BLOCKED 6 (Legal Compliance) → BLOCKED 7 (Terms of Service) → Authorization

**Reason**: BLOCKED 7 depends on BLOCKED 6 legal review completion, and both are high-effort capabilities.

**Optimization Opportunity**: Execute BLOCKED 1, BLOCKED 5, and BLOCKED 8 in parallel with BLOCKED 6 to reduce total timeline.

---

## 9. Execution Risk Management

### Execution Risks

**Risk 1: Legal Counsel Availability**
- **Risk**: Legal counsel may not be available when needed
- **Impact**: Delays BLOCKED 6 and BLOCKED 7 execution
- **Mitigation**: Engage legal counsel early, establish availability schedule

**Risk 2: Email Service Provider Setup**
- **Risk**: Email service provider setup may take longer than expected
- **Impact**: Delays BLOCKED 1 execution
- **Mitigation**: Start email service provider engagement early, have backup options

**Risk 3: Convex Support Response Time**
- **Risk**: Convex support may not respond quickly to backup/restore questions
- **Impact**: Delays BLOCKED 8 execution
- **Mitigation**: Start Convex support engagement early, use documentation as primary source

**Risk 4: Testing Failures**
- **Risk**: Testing may reveal issues requiring fixes
- **Impact**: Delays capability execution
- **Mitigation**: Allocate buffer time for testing and fixes

**Risk 5: Security Review Findings**
- **Risk**: Security review may reveal security issues requiring fixes
- **Impact**: Delays BLOCKED 1 execution
- **Mitigation**: Allocate buffer time for security review and fixes

---

## 10. Final Verification Checklist

### Execution Plan Completeness

**For Each Critical Capability**:
- ✅ (a) Execution owner — Defined
- ✅ (b) Execution phases — Enumerated
- ✅ (c) Parallelizable vs sequential tasks — Identified
- ✅ (d) Verification artifacts — Enumerated
- ✅ (e) Explicit handoff to authorization — Defined

**All Critical Capabilities Covered**:
- ✅ BLOCKED 1: Production Authentication
- ✅ BLOCKED 5: Pilot Mode Enforcement
- ✅ BLOCKED 6: Legal Compliance
- ✅ BLOCKED 7: Terms of Service and User Agreements
- ✅ BLOCKED 8: Backup and Restore Procedures

**Cross-Capability Coordination**:
- ✅ Parallel execution opportunities identified
- ✅ Execution priority defined
- ✅ Execution dependencies documented
- ✅ Authorization handoff process defined

---

**CURRENT SYSTEM STATUS**: **NOT READY FOR EXECUTION**

**System cannot proceed with execution until:**
1. Execution plan is approved by system operator
2. Execution owners are assigned and available
3. Supporting roles are engaged (if required)
4. External dependencies are resolved (legal counsel, email service, Convex support)

---

*This document enumerates execution planning for all 5 critical BLOCKED capabilities. No implementation, no code changes, no new features. Only enumeration of execution owners, phases, tasks, verification artifacts, and authorization handoff.*
