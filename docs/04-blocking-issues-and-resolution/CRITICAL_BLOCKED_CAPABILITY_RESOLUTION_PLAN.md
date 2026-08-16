# CRITICAL_BLOCKED_CAPABILITY_RESOLUTION_PLAN.md

**Critical BLOCKED Capability Resolution Plan**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state  
**Plan Type**: Resolution Plan (No New Features, No Design Changes)

**Context**: 
- GO_LIVE_READINESS.md defines 5 critical BLOCKED capabilities
- SYSTEM_ACTIVATION_READINESS_REVIEW.md identifies blocking factors
- This document enumerates minimum actions required to mark each capability ALLOWED

**Purpose**: This document enumerates for each critical BLOCKED capability:
- What is missing
- Whether it is technical, legal, or operational
- Whether it requires code, configuration, or human process
- The minimum action required to mark it ALLOWED

**No New Features**: This plan does not propose new features or design changes. Only enumeration of minimum actions to resolve BLOCKED status.

---

## 1. BLOCKED 1: Production Authentication

### What Is Missing

**Missing Components**:
1. Individual user password authentication mechanism (replaces shared password)
2. Secure password hashing implementation (bcrypt, argon2, or equivalent)
3. Session management system (JWT, session tokens, or equivalent)
4. Password reset mechanism (email-based or equivalent)
5. Explicit role assignment (replaces email prefix inference)
6. Production authentication testing and verification

**Current State**: Pilot mode uses shared password (`Farm2Market2024`) for all users. This is not suitable for production.

---

### Classification

**Type**: **TECHNICAL**

**Reason**: Production authentication requires code implementation, security mechanisms, and testing. This is a technical capability that must be built.

---

### Required Action Type

**Action Type**: **CODE**

**Reason**: Production authentication requires:
- Code implementation (authentication module, password hashing, session management)
- Database schema updates (session storage, password reset tokens)
- API endpoints (login, logout, password reset)
- Security mechanisms (password hashing, session validation)

**Configuration Required**: None (code implementation only)

**Human Process Required**: Testing and verification (after code implementation)

---

### Minimum Action Required to Mark ALLOWED

**Minimum Action**: Implement production authentication module with:
1. **Password Authentication**:
   - Individual user passwords (not shared)
   - Secure password hashing (bcrypt, argon2, or equivalent)
   - Password validation (strength requirements)

2. **Session Management**:
   - Session token generation (JWT or equivalent)
   - Session validation (server-side)
   - Session expiration and refresh

3. **Password Reset**:
   - Password reset token generation
   - Email-based password reset (or equivalent)
   - Password reset token expiration

4. **Explicit Role Assignment**:
   - Remove email prefix inference
   - Admin-controlled role assignment only
   - Role assignment via User Management module

5. **Testing and Verification**:
   - Test authentication with multiple users
   - Test password reset flow
   - Test session management
   - Security review (password hashing, session security)

**Verification Criteria**:
- ✅ Production authentication code exists and is implemented
- ✅ Password hashing is secure (bcrypt, argon2, or equivalent)
- ✅ Session management is implemented
- ✅ Password reset is implemented
- ✅ Email prefix inference is removed
- ✅ Role assignment is admin-controlled only
- ✅ Production authentication tested with multiple users
- ✅ Security review completed

**Authority Required**: System operator (to verify and authorize)

**Estimated Effort**: High (full authentication module implementation)

**Dependencies**: None (can be implemented independently)

---

## 2. BLOCKED 5: Pilot Mode Enforcement

### What Is Missing

**Missing Components**:
1. Verification that pilot mode enforcement is implemented in ALL money-moving mutations
2. Verification that pilot mode enforcement is tested
3. Verification that pilot mode enforcement is complete (not partial)
4. Verification that pilot mode enforcement observability exists
5. Verification that pilot mode enforcement audit logging exists

**Current State**: Pilot mode enforcement code exists (`convex/pilotMode.ts` with `checkPilotMode` function), but implementation status is UNKNOWN. Code may be incomplete or untested.

**Evidence of Existence**:
- `convex/pilotMode.ts` exists with `checkPilotMode` function
- `checkPilotMode` is called in `wallet.ts`, `listings.ts`, `buyers.ts`
- Pilot mode enforcement may exist but may not be complete

---

### Classification

**Type**: **TECHNICAL** (with operational verification component)

**Reason**: Pilot mode enforcement requires code verification, testing, and operational validation. This is primarily a technical capability that must be verified and tested.

---

### Required Action Type

**Action Type**: **CODE VERIFICATION + TESTING** (code may already exist, but verification and testing are required)

**Reason**: Pilot mode enforcement requires:
- Code verification (verify enforcement exists in ALL money-moving mutations)
- Testing (test that enforcement blocks mutations when pilot mode is enabled)
- Operational validation (verify enforcement works in production-like environment)

**Configuration Required**: None (verification and testing only)

**Human Process Required**: Testing, verification, and operational validation

---

### Minimum Action Required to Mark ALLOWED

**Minimum Action**: Verify and test pilot mode enforcement:

1. **Code Verification**:
   - Verify `checkPilotMode` is called in ALL money-moving mutations:
     - Capital deposits (`wallet.ts`)
     - Capital locks (`wallet.ts`)
     - Profit withdrawals (`wallet.ts`)
     - Unit locks (`listings.ts`)
     - Buyer purchases (`buyers.ts` - if implemented)
     - Any other money-moving mutations
   - Verify enforcement is server-side (not client-side)
   - Verify enforcement cannot be bypassed

2. **Testing**:
   - Test pilot mode enforcement (enable pilot mode, attempt money-moving mutations, verify they are blocked)
   - Test pilot mode enforcement with different user roles
   - Test pilot mode enforcement with admin actions (should still work)
   - Test pilot mode enforcement with read-only queries (should still work)

3. **Observability Verification**:
   - Verify pilot mode enforcement violations are logged
   - Verify pilot mode enforcement metrics can be measured
   - Verify pilot mode status is observable

4. **Audit Logging Verification**:
   - Verify pilot mode enforcement violations are logged in audit trail
   - Verify pilot mode status changes are logged (AdminAction entries)

**Verification Criteria**:
- ✅ Pilot mode enforcement code exists in ALL money-moving mutations
- ✅ Pilot mode enforcement is tested (mutations blocked when enabled)
- ✅ Pilot mode enforcement is complete (not partial)
- ✅ Pilot mode enforcement observability exists
- ✅ Pilot mode enforcement audit logging exists

**Authority Required**: System operator (to verify and authorize)

**Estimated Effort**: Low to Medium (verification and testing only, code may already exist)

**Dependencies**: None (can be verified independently)

---

## 3. BLOCKED 6: Legal Compliance

### What Is Missing

**Missing Components**:
1. Legal review completed by qualified legal counsel
2. Legal framework verification (Uganda regulations)
3. Financial regulation compliance verification (closed-loop ledger legal status)
4. Data protection compliance verification (Uganda data protection laws)
5. Legal compliance documentation and approval

**Current State**: Legal review is NOT COMPLETED. Legal compliance status is UNKNOWN.

---

### Classification

**Type**: **LEGAL**

**Reason**: Legal compliance requires legal review, regulatory verification, and legal documentation. This is a legal capability that requires legal counsel.

---

### Required Action Type

**Action Type**: **HUMAN PROCESS** (legal review and documentation)

**Reason**: Legal compliance requires:
- Legal review by qualified legal counsel
- Regulatory verification (Uganda regulations)
- Legal documentation (compliance reports, legal opinions)
- Legal approval (system operator approval with legal counsel)

**Code Required**: None (legal compliance is not a code issue)

**Configuration Required**: None (legal compliance is not a configuration issue)

---

### Minimum Action Required to Mark ALLOWED

**Minimum Action**: Complete legal review and verification:

1. **Legal Review**:
   - Engage qualified legal counsel (Uganda-based or familiar with Uganda regulations)
   - Review system architecture, business model, and operations
   - Identify legal requirements and compliance obligations
   - Document legal risks and mitigation strategies

2. **Regulatory Verification**:
   - Verify legal framework compliance (Uganda regulations)
   - Verify financial regulation compliance (closed-loop ledger legal status)
   - Verify data protection compliance (Uganda data protection laws)
   - Verify any other applicable regulations

3. **Legal Documentation**:
   - Document legal compliance status
   - Document legal risks and mitigation strategies
   - Document regulatory requirements and compliance measures
   - Create legal compliance report

4. **Legal Approval**:
   - System operator reviews legal compliance report
   - System operator approves legal compliance (with legal counsel)
   - Legal compliance documented in PRODUCTION_AUTHORIZATION.md

**Verification Criteria**:
- ✅ Legal review completed by qualified legal counsel
- ✅ Legal framework verified (Uganda regulations)
- ✅ Financial regulation compliance verified (closed-loop ledger legal status)
- ✅ Data protection compliance verified (Uganda data protection laws)
- ✅ Legal compliance documented and approved

**Authority Required**: System operator (to verify and authorize, with legal counsel)

**Estimated Effort**: High (legal review and documentation process)

**Dependencies**: None (can be completed independently)

---

## 4. BLOCKED 7: Terms of Service and User Agreements

### What Is Missing

**Missing Components**:
1. Terms of Service document (drafted and reviewed)
2. User agreements document (drafted and reviewed)
3. User consent framework (implementation)
4. Liability allocation specification
5. Terms of Service and user agreements approval

**Current State**: Terms of Service and user agreements are NOT COMPLETED. No explicit user agreements exist.

---

### Classification

**Type**: **LEGAL** (with technical implementation component)

**Reason**: Terms of Service and user agreements require legal documentation and technical implementation (user consent framework). This is primarily a legal capability with a technical component.

---

### Required Action Type

**Action Type**: **HUMAN PROCESS + CODE** (legal documentation and technical implementation)

**Reason**: Terms of Service and user agreements require:
- Legal documentation (Terms of Service, user agreements)
- Legal review (legal counsel review)
- Technical implementation (user consent framework)
- Technical testing (user consent flow)

**Configuration Required**: None (code implementation and legal documentation only)

---

### Minimum Action Required to Mark ALLOWED

**Minimum Action**: Complete Terms of Service and user agreements:

1. **Legal Documentation**:
   - Draft Terms of Service document
   - Draft user agreements document
   - Specify liability allocation
   - Review with legal counsel

2. **Technical Implementation**:
   - Implement user consent framework (frontend and backend)
   - Implement Terms of Service acceptance flow
   - Implement user agreement acceptance flow
   - Store user consent in database (auditable)

3. **Testing and Verification**:
   - Test user consent flow
   - Test Terms of Service acceptance
   - Test user agreement acceptance
   - Verify user consent is stored and auditable

4. **Approval**:
   - System operator reviews Terms of Service and user agreements
   - System operator approves Terms of Service and user agreements (with legal counsel)
   - Terms of Service and user agreements documented

**Verification Criteria**:
- ✅ Terms of Service drafted and reviewed
- ✅ User agreements drafted and reviewed
- ✅ User consent framework implemented
- ✅ Liability allocation specified
- ✅ Terms of Service and user agreements approved

**Authority Required**: System operator (to verify and authorize, with legal counsel)

**Estimated Effort**: Medium to High (legal documentation and technical implementation)

**Dependencies**: None (can be completed independently)

---

## 5. BLOCKED 8: Backup and Restore Procedures

### What Is Missing

**Missing Components**:
1. Backup procedures verification (Convex backup access confirmed)
2. Restore procedures verification (restore process documented and tested)
3. Operator access to backups verification
4. Restore testing performed and verified
5. Backup and restore procedures documentation

**Current State**: Backup and restore procedures are UNKNOWN. Convex provides managed backups, but operator access and restore procedures are UNKNOWN.

---

### Classification

**Type**: **OPERATIONAL** (with technical verification component)

**Reason**: Backup and restore procedures require operational verification, testing, and documentation. This is primarily an operational capability with a technical verification component.

---

### Required Action Type

**Action Type**: **HUMAN PROCESS + CONFIGURATION** (operational verification and configuration)

**Reason**: Backup and restore procedures require:
- Operational verification (verify Convex backup access, restore procedures)
- Configuration (configure backup access, restore procedures)
- Testing (test restore procedures)
- Documentation (document backup and restore procedures)

**Code Required**: None (backup and restore are infrastructure-level, not code-level)

---

### Minimum Action Required to Mark ALLOWED

**Minimum Action**: Verify and document backup and restore procedures:

1. **Backup Procedures Verification**:
   - Verify Convex backup access (check Convex dashboard, documentation, or support)
   - Verify backup frequency and retention policy
   - Verify backup storage location and access
   - Document backup procedures

2. **Restore Procedures Verification**:
   - Verify restore process (check Convex documentation or support)
   - Verify restore time and process
   - Verify restore testing requirements
   - Document restore procedures

3. **Operator Access Verification**:
   - Verify operator has access to Convex dashboard
   - Verify operator can access backup information
   - Verify operator can initiate restore process (if required)
   - Document operator access procedures

4. **Restore Testing**:
   - Perform restore testing (if possible in non-production environment)
   - Verify restore process works
   - Verify data integrity after restore
   - Document restore testing results

5. **Documentation**:
   - Document backup procedures
   - Document restore procedures
   - Document operator access procedures
   - Document restore testing results

**Verification Criteria**:
- ✅ Backup procedures verified (Convex backup access confirmed)
- ✅ Restore procedures verified (restore process documented and tested)
- ✅ Operator access to backups verified
- ✅ Restore testing performed and verified
- ✅ Backup and restore procedures documented

**Authority Required**: System operator (to verify and authorize)

**Estimated Effort**: Low to Medium (operational verification and documentation)

**Dependencies**: None (can be verified independently)

---

## 6. Resolution Plan Summary

### Critical BLOCKED Capabilities

| Capability | Type | Action Type | Estimated Effort | Dependencies |
|------------|------|-------------|-------------------|--------------|
| **BLOCKED 1: Production Authentication** | Technical | Code | High | None |
| **BLOCKED 5: Pilot Mode Enforcement** | Technical | Code Verification + Testing | Low to Medium | None |
| **BLOCKED 6: Legal Compliance** | Legal | Human Process | High | None |
| **BLOCKED 7: Terms of Service and User Agreements** | Legal | Human Process + Code | Medium to High | None |
| **BLOCKED 8: Backup and Restore Procedures** | Operational | Human Process + Configuration | Low to Medium | None |

---

### Resolution Priority

**Priority 1 (Technical - Code Implementation)**:
1. **BLOCKED 1: Production Authentication** — Requires full code implementation
2. **BLOCKED 5: Pilot Mode Enforcement** — Requires code verification and testing (code may already exist)

**Priority 2 (Legal - Documentation and Review)**:
3. **BLOCKED 6: Legal Compliance** — Requires legal review and documentation
4. **BLOCKED 7: Terms of Service and User Agreements** — Requires legal documentation and technical implementation

**Priority 3 (Operational - Verification and Documentation)**:
5. **BLOCKED 8: Backup and Restore Procedures** — Requires operational verification and documentation

---

### Resolution Dependencies

**No Dependencies**: All critical BLOCKED capabilities can be resolved independently. No capability depends on another for resolution.

**Resolution Order**: Capabilities can be resolved in any order, but recommended order:
1. **BLOCKED 5: Pilot Mode Enforcement** (Low to Medium effort, code may already exist)
2. **BLOCKED 8: Backup and Restore Procedures** (Low to Medium effort, operational verification)
3. **BLOCKED 1: Production Authentication** (High effort, full code implementation)
4. **BLOCKED 6: Legal Compliance** (High effort, legal review)
5. **BLOCKED 7: Terms of Service and User Agreements** (Medium to High effort, legal documentation and technical implementation)

---

### Minimum Actions Required for ALLOWED Status

**For Each Capability**:
- **BLOCKED 1**: Implement production authentication module (code)
- **BLOCKED 5**: Verify and test pilot mode enforcement (code verification + testing)
- **BLOCKED 6**: Complete legal review and verification (human process)
- **BLOCKED 7**: Complete Terms of Service and user agreements (human process + code)
- **BLOCKED 8**: Verify and document backup and restore procedures (human process + configuration)

**Verification**: Each capability must meet its verification criteria to be marked ALLOWED.

**Authority**: System operator must verify and authorize each capability before marking ALLOWED.

---

## 7. Next Steps (No New Features)

### Step 1: Resolve BLOCKED 5 (Pilot Mode Enforcement)

**Action**: Verify and test pilot mode enforcement.

**Why First**: Lowest effort, code may already exist, enables kill-switch verification.

**Estimated Time**: 1-2 days (verification and testing)

---

### Step 2: Resolve BLOCKED 8 (Backup and Restore Procedures)

**Action**: Verify and document backup and restore procedures.

**Why Second**: Low to medium effort, operational verification, enables rollback plan.

**Estimated Time**: 1-3 days (verification and documentation)

---

### Step 3: Resolve BLOCKED 1 (Production Authentication)

**Action**: Implement production authentication module.

**Why Third**: High effort, full code implementation, critical for production security.

**Estimated Time**: 2-4 weeks (full implementation and testing)

---

### Step 4: Resolve BLOCKED 6 (Legal Compliance)

**Action**: Complete legal review and verification.

**Why Fourth**: High effort, legal review process, can proceed in parallel with code work.

**Estimated Time**: 2-4 weeks (legal review and documentation)

---

### Step 5: Resolve BLOCKED 7 (Terms of Service and User Agreements)

**Action**: Complete Terms of Service and user agreements.

**Why Fifth**: Medium to high effort, depends on legal review completion, requires technical implementation.

**Estimated Time**: 1-2 weeks (legal documentation and technical implementation)

---

## 8. Final Verification

### Resolution Plan Complete

**Status**: **PLAN COMPLETE**

**Summary**:
- 5 critical BLOCKED capabilities enumerated
- What is missing: Identified for each capability
- Classification: Technical, Legal, or Operational
- Action type: Code, Configuration, or Human Process
- Minimum action: Defined for each capability

**No New Features**: This plan does not propose new features or design changes. Only enumeration of minimum actions to resolve BLOCKED status.

**Authority**: System operator (CEO / Engineering Lead / CTO)

**Activation Dependency**: **MANDATORY** — All critical BLOCKED capabilities must be resolved before activation.

---

*This document must be updated when BLOCKED capabilities are resolved. No assumptions. Only truth.*
