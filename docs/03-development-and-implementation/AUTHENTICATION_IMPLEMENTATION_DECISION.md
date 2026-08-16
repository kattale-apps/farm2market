# AUTHENTICATION_IMPLEMENTATION_DECISION.md

**Authentication Implementation Decision — Session Model**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state  
**Decision Type**: Implementation Path Lock (No Code, No API Design, No Frontend Details)

**Context**: 
- PRODUCTION_AUTHENTICATION_SPECIFICATION.md defines authentication requirements
- This document locks the session model decision (stateless vs stateful)
- Step 6 (Authentication module) cannot proceed until this decision is locked
- IMPLEMENTATION_SEQUENCE.md Step 6 is BLOCKED until this decision is made
- INVARIANTS.md defines security boundaries
- THREAT_MODEL.md defines authentication-related threats

**Purpose**: This document decides and documents the session model choice (stateless JWT vs stateful database-backed sessions) and justifies the decision against security, operational simplicity, Convex backend constraints, and invariant enforcement.

**Goal**: Lock the authentication implementation path so Step 6 can be formally authorized.

---

## 1. Decision Summary

### Session Model Choice

**DECISION**: **Stateful (Database-Backed Sessions)**

**Rationale**: Stateful sessions provide superior security (immediate revocation, compromise response), align with Convex backend capabilities, and meet all invariant and threat mitigation requirements. The operational complexity is acceptable given the security benefits.

**Status**: **LOCKED** — This decision is final and cannot be changed without re-authorization.

---

## 2. Decision Analysis

### 2.1 Security Analysis

#### Revocation Capability

**Stateless (JWT)**:
- **Revocation**: Requires token blacklist (additional database table)
- **Immediate Revocation**: Not possible without blacklist lookup
- **Compromise Response**: Compromised token valid until expiration (unless blacklisted)
- **Blacklist Complexity**: Requires blacklist table, cleanup, and lookup on every request

**Stateful (Database Sessions)**:
- **Revocation**: Direct database invalidation (update `invalidated` field)
- **Immediate Revocation**: Yes (single database update)
- **Compromise Response**: Compromised session can be immediately invalidated
- **Blacklist Complexity**: None (revocation is direct database operation)

**Security Winner**: **Stateful** — Immediate revocation without blacklist complexity.

---

#### Compromise Response (THREAT 1.3: Admin Credential Compromise)

**Stateless (JWT)**:
- **Compromise Response**: Requires blacklist for all user tokens
- **Response Time**: Depends on blacklist lookup and update
- **Complexity**: Must blacklist all tokens for compromised user
- **Effectiveness**: Moderate (blacklist must be checked on every request)

**Stateful (Database Sessions)**:
- **Compromise Response**: Direct invalidation of all user sessions
- **Response Time**: Immediate (single database query/update)
- **Complexity**: Simple (update all sessions for user to `invalidated: true`)
- **Effectiveness**: High (invalidated sessions rejected immediately)

**Security Winner**: **Stateful** — Immediate, simple, effective compromise response.

---

#### Password Reset Session Invalidation

**Requirement** (from PRODUCTION_AUTHENTICATION_SPECIFICATION.md Section 4.4):
- Password reset must invalidate all existing sessions for user (security measure)

**Stateless (JWT)**:
- **Implementation**: Must blacklist all tokens for user
- **Complexity**: Requires tracking all tokens per user (or blacklisting all tokens)
- **Effectiveness**: Moderate (blacklist must be checked on every request)

**Stateful (Database Sessions)**:
- **Implementation**: Direct invalidation of all user sessions (`invalidated: true`)
- **Complexity**: Simple (single database query/update)
- **Effectiveness**: High (invalidated sessions rejected immediately)

**Security Winner**: **Stateful** — Simple, immediate, effective password reset session invalidation.

---

### 2.2 Operational Simplicity Analysis

#### Implementation Complexity

**Stateless (JWT)**:
- **Token Generation**: Requires JWT library (external dependency)
- **Token Validation**: Requires JWT library and signature verification
- **Revocation**: Requires blacklist table and lookup logic
- **Cleanup**: No cleanup needed (tokens expire naturally)
- **Dependencies**: External JWT library (e.g., `jsonwebtoken`, `jose`)

**Stateful (Database Sessions)**:
- **Token Generation**: Simple random token generation (cryptographically secure)
- **Token Validation**: Database lookup (simple query)
- **Revocation**: Direct database update (simple mutation)
- **Cleanup**: Requires session cleanup (expired sessions)
- **Dependencies**: None (uses Convex database operations)

**Operational Winner**: **Stateful** — Simpler implementation, no external dependencies, uses native Convex operations.

---

#### Maintenance Complexity

**Stateless (JWT)**:
- **Blacklist Maintenance**: Requires blacklist cleanup (expired tokens)
- **Blacklist Size**: Grows with revoked tokens (until cleanup)
- **Lookup Performance**: Blacklist lookup on every request (performance impact)
- **Monitoring**: Blacklist size monitoring required

**Stateful (Database Sessions)**:
- **Session Cleanup**: Periodic cleanup of expired sessions (simple query)
- **Database Size**: Grows with active sessions (manageable with cleanup)
- **Lookup Performance**: Indexed database lookup (efficient with Convex indexes)
- **Monitoring**: Session count monitoring (standard database monitoring)

**Operational Winner**: **Stateful** — Simpler maintenance, standard database operations, efficient with Convex indexes.

---

### 2.3 Convex Backend Constraints Analysis

#### Database Operations

**Stateless (JWT)**:
- **Database Usage**: Blacklist table (if revocation needed)
- **Operations**: Blacklist insert (on revocation), blacklist lookup (on every request)
- **Convex Fit**: Requires blacklist table (additional schema complexity)

**Stateful (Database Sessions)**:
- **Database Usage**: Session table (native Convex table)
- **Operations**: Session insert (on login), session lookup (on validation), session update (on invalidation)
- **Convex Fit**: Native Convex database operations (perfect fit)

**Convex Winner**: **Stateful** — Native Convex operations, no additional complexity.

---

#### Convex Mutations and Queries

**Stateless (JWT)**:
- **Token Generation**: External JWT library (not Convex-native)
- **Token Validation**: External JWT library + blacklist lookup
- **Revocation**: Blacklist insert (Convex mutation)

**Stateful (Database Sessions)**:
- **Token Generation**: Random token generation (native JavaScript)
- **Token Validation**: Database query (Convex query)
- **Revocation**: Database update (Convex mutation)

**Convex Winner**: **Stateful** — All operations use native Convex capabilities.

---

#### Convex Indexes

**Stateless (JWT)**:
- **Blacklist Indexes**: Requires `by_token` index (if blacklist used)
- **User Token Tracking**: Requires `by_user` index (if tracking tokens per user)

**Stateful (Database Sessions)**:
- **Session Indexes**: Requires `by_user` index (for user session lookup), `by_token` index (for token validation)
- **Expiration Indexes**: Optional `by_expiresAt` index (for cleanup queries)

**Convex Winner**: **Stateful** — Standard Convex indexes, well-supported pattern.

---

### 2.4 Invariant Enforcement Analysis

#### INVARIANT 2.1: Server-Side Authorization Enforcement

**Stateless (JWT)**:
- **Support**: Yes (token validation is server-side)
- **Enforcement**: Token validation in Convex backend
- **Bypass Risk**: Low (token validation is server-side)

**Stateful (Database Sessions)**:
- **Support**: Yes (session validation is server-side)
- **Enforcement**: Session lookup in Convex backend
- **Bypass Risk**: Low (session validation is server-side)

**Invariant Winner**: **Tie** — Both models support server-side enforcement.

---

#### INVARIANT 2.2: Admin Role Verification

**Stateless (JWT)**:
- **Support**: Yes (role embedded in token, validated server-side)
- **Enforcement**: Token validation includes role verification
- **Role Source**: Token payload (must be validated against User entity)

**Stateful (Database Sessions)**:
- **Support**: Yes (role read from User entity during session validation)
- **Enforcement**: Session validation includes role verification
- **Role Source**: User entity (always current, not cached in token)

**Invariant Winner**: **Stateful** — Role always current (read from User entity), not cached in token.

---

#### INVARIANT 2.3: Frontend Cannot Bypass Authorization

**Stateless (JWT)**:
- **Support**: Yes (token validation is server-side)
- **Enforcement**: Token validation in Convex backend
- **Bypass Risk**: Low (token validation is server-side)

**Stateful (Database Sessions)**:
- **Support**: Yes (session validation is server-side)
- **Enforcement**: Session lookup in Convex backend
- **Bypass Risk**: Low (session validation is server-side)

**Invariant Winner**: **Tie** — Both models support server-side enforcement.

---

#### Session Invalidation Requirement

**Requirement** (from PRODUCTION_AUTHENTICATION_SPECIFICATION.md Section 4.3):
- Session invalidation must be immediate (cannot use invalidated sessions)
- Invalidation must support logout (user-initiated) and security invalidation (admin-initiated)

**Stateless (JWT)**:
- **Immediate Invalidation**: Requires blacklist (adds complexity)
- **Logout**: Requires blacklist insert
- **Security Invalidation**: Requires blacklist insert for all user tokens

**Stateful (Database Sessions)**:
- **Immediate Invalidation**: Direct database update (simple)
- **Logout**: Direct database update (`invalidated: true`)
- **Security Invalidation**: Direct database update for all user sessions

**Invariant Winner**: **Stateful** — Immediate invalidation without blacklist complexity.

---

### 2.5 Threat Mitigation Analysis

#### THREAT 1.3: Admin Credential Compromise

**Mitigation Requirement**: Immediate session revocation capability.

**Stateless (JWT)**:
- **Revocation**: Requires blacklist (adds complexity)
- **Response Time**: Depends on blacklist update
- **Effectiveness**: Moderate (blacklist must be checked on every request)

**Stateful (Database Sessions)**:
- **Revocation**: Direct database invalidation (simple)
- **Response Time**: Immediate (single database update)
- **Effectiveness**: High (invalidated sessions rejected immediately)

**Threat Mitigation Winner**: **Stateful** — Immediate, simple, effective compromise response.

---

## 3. Decision Justification

### Primary Justification: Security

**Stateful sessions provide superior security**:
1. **Immediate Revocation**: Compromised sessions can be invalidated immediately (single database update)
2. **Compromise Response**: THREAT 1.3 (Admin Credential Compromise) requires immediate revocation capability
3. **Password Reset**: Password reset requires invalidating all user sessions (simple with stateful)
4. **No Blacklist Complexity**: Revocation is direct database operation (no blacklist lookup overhead)

**Security is the primary concern** for production authentication. Stateful sessions provide immediate revocation without blacklist complexity, which is critical for compromise response and password reset flows.

---

### Secondary Justification: Convex Backend Alignment

**Stateful sessions align with Convex backend capabilities**:
1. **Native Operations**: All operations use native Convex database operations (no external dependencies)
2. **Efficient Indexes**: Convex indexes support fast session lookups (`by_token`, `by_user`)
3. **Atomic Operations**: Convex mutations are atomic (session creation/invalidation is atomic)
4. **No External Dependencies**: No JWT library required (uses native JavaScript and Convex)

**Convex is designed for database operations**. Stateful sessions leverage Convex's strengths (database operations, indexes, atomic mutations) rather than requiring external JWT libraries.

---

### Tertiary Justification: Operational Simplicity

**Stateful sessions are operationally simpler**:
1. **No Blacklist**: No blacklist table or lookup logic required
2. **Standard Patterns**: Uses standard Convex database patterns (familiar to developers)
3. **Simple Cleanup**: Session cleanup is straightforward (query expired sessions, delete)
4. **Monitoring**: Standard database monitoring (session count, cleanup status)

**Operational simplicity** is important for maintainability. Stateful sessions use standard Convex patterns and require no blacklist complexity.

---

### Trade-off Acceptance

**Accepted Trade-offs**:
1. **Database Storage**: Sessions require database storage (acceptable given Convex's database capabilities)
2. **Session Cleanup**: Requires periodic cleanup of expired sessions (standard database maintenance)
3. **Database Queries**: Session validation requires database query (efficient with Convex indexes)

**Unacceptable Trade-offs** (for stateless):
1. **Blacklist Complexity**: Blacklist adds complexity and lookup overhead
2. **Delayed Revocation**: Revocation requires blacklist lookup (not immediate)
3. **External Dependencies**: JWT library adds external dependency

**Trade-off Analysis**: The database storage and cleanup requirements for stateful sessions are acceptable given the security benefits and Convex's database capabilities. The blacklist complexity and delayed revocation of stateless sessions are unacceptable for production security requirements.

---

## 4. Schema Impact

### Session Entity Required

**Decision**: **YES** — Session entity is required for stateful sessions.

**Schema Change Authorization**: **AUTHORIZED** — Session entity addition to schema is authorized as part of Step 6 (Authentication module) implementation.

---

### Session Entity Definition

**Table Name**: `sessions`

**Fields** (proposed):
- `userId`: User ID (v.id("users")) — Required, indexed
- `token`: Session token (v.string()) — Required, indexed, cryptographically secure random token
- `expiresAt`: Session expiration timestamp (v.number()) — Required, indexed for cleanup
- `createdAt`: Session creation timestamp (v.number()) — Required
- `lastActiveAt`: Last activity timestamp (v.number()) — Required, updated on each request
- `invalidated`: Session invalidation status (v.boolean()) — Required, default false
- `invalidatedAt`: Session invalidation timestamp (v.optional(v.number())) — Optional, set when invalidated

**Indexes** (required):
- `by_user`: Index on `userId` (for user session lookup, invalidation)
- `by_token`: Index on `token` (for token validation)
- `by_expiresAt`: Index on `expiresAt` (for cleanup queries) — Optional but recommended

**Schema Location**: `convex/schema.ts`

**Schema Change Type**: **ADDITIVE** — Adding new table, no breaking changes to existing schema.

---

### Schema Change Impact

**Breaking Changes**: **NONE** — Session entity is new table, no impact on existing tables.

**Migration Required**: **NO** — New table addition, no data migration needed.

**Backward Compatibility**: **MAINTAINED** — Existing schema unchanged, new table added.

**Authorization**: **AUTHORIZED** — Schema change is authorized as part of Step 6 (Authentication module) implementation.

---

## 5. Implementation Constraints

### Constraints from Decision

**1. Session Entity Required**:
- Session entity must be added to `convex/schema.ts` before implementation
- Session entity must have required fields and indexes
- Session entity must support token validation, expiration, and invalidation

**2. No JWT Library**:
- Authentication must not use JWT library (stateful model chosen)
- Token generation must use cryptographically secure random token generation
- Token validation must use database lookup (not JWT signature verification)

**3. Session Cleanup Required**:
- Session cleanup must be implemented (periodic cleanup of expired sessions)
- Cleanup can be implemented as scheduled function or manual cleanup
- Cleanup must not delete active sessions (only expired sessions)

**4. Database Operations Only**:
- All session operations must use Convex database operations (no external dependencies)
- Session creation: Database insert (Convex mutation)
- Session validation: Database query (Convex query)
- Session invalidation: Database update (Convex mutation)

---

## 6. Decision Lock Status

### Decision Status

**Status**: **LOCKED**

**Decision**: **Stateful (Database-Backed Sessions)**

**Lock Date**: Current system state

**Authority**: Single human (CEO / Engineering Lead / CTO)

**Re-authorization Required**: **YES** — This decision cannot be changed without explicit re-authorization.

---

### Authorization for Step 6

**Step 6 Authorization Status**: **AUTHORIZED** (pending schema change)

**Authorization Conditions**:
1. ✅ Session model decision is locked (this document)
2. ✅ Session entity schema change is authorized (Section 4)
3. ⏳ Session entity must be added to `convex/schema.ts` before implementation
4. ⏳ Implementation must follow stateful session model (no JWT)

**Authorization Authority**: System operator (CEO / Engineering Lead / CTO)

**Authorization Date**: Current system state (pending schema change)

---

## 7. Final Verification

### Decision Verification

**✅ Security**: Stateful sessions provide immediate revocation and compromise response (superior to stateless)

**✅ Operational Simplicity**: Stateful sessions use native Convex operations (simpler than stateless with blacklist)

**✅ Convex Backend Alignment**: Stateful sessions leverage Convex database capabilities (perfect fit)

**✅ Invariant Enforcement**: Stateful sessions support all required invariants (INVARIANT 2.1, 2.2, 2.3)

**✅ Threat Mitigation**: Stateful sessions provide immediate compromise response (THREAT 1.3 mitigation)

**✅ Schema Impact**: Session entity is required and authorized (Section 4)

**✅ Implementation Constraints**: Constraints are defined and acceptable (Section 5)

---

### Decision Lock Confirmation

**Decision**: **Stateful (Database-Backed Sessions)** — **LOCKED**

**Justification**: Security (immediate revocation, compromise response), Convex backend alignment (native operations), operational simplicity (no blacklist complexity), invariant enforcement (all invariants supported), threat mitigation (immediate compromise response).

**Schema Impact**: Session entity required and authorized.

**Step 6 Authorization**: **AUTHORIZED** (pending schema change).

---

*This decision is locked and cannot be changed without explicit re-authorization. Implementation must follow stateful session model.*
