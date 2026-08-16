# PRODUCTION_AUTHENTICATION_SPECIFICATION.md

**Production Authentication Module Specification**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state  
**Specification Type**: Production Authentication Model (No Implementation, No Code, No API Details)

**Context**: 
- CRITICAL_BLOCKED_CAPABILITY_RESOLUTION_PLAN.md identifies BLOCKED 1: Production Authentication
- GO_LIVE_READINESS.md marks production authentication as BLOCKED
- VISION.md BLOCKED #1: Production Authentication NOT IMPLEMENTED
- IMPLEMENTATION_SEQUENCE.md Step 6 (Authentication) is BLOCKED until this specification is approved
- User Management module (Step 5) is complete and locked
- Authorization module (Step 3) is complete and locked
- INVARIANTS.md defines security boundaries
- THREAT_MODEL.md defines authentication-related threats

**Purpose**: This document defines the production authentication model specification. This is NOT an implementation guide. This defines requirements, security boundaries, and interaction points. No code, no API implementation details, no frontend details beyond flow description.

**Goal**: Produce a specification sufficient to authorize Step 6 (Authentication module) implementation.

---

## 1. Module Purpose

### Core Purpose

**Production Authentication Module** provides individual user credential verification, secure password hashing, session management, and password reset mechanisms required for production use. This module replaces pilot mode shared password authentication with production-grade individual user authentication.

**Why This Module Exists**:
- Pilot mode uses shared password (`Farm2Market2024`) for all users (not suitable for production)
- Production requires individual user credentials (one password per user)
- Production requires secure password hashing (bcrypt, argon2, or equivalent)
- Production requires session management (JWT, session tokens, or equivalent)
- Production requires password reset mechanism (email-based or equivalent)
- Authentication supports security boundaries (INVARIANT 2.1, 2.2, 2.3)
- Authentication prevents unauthorized access (THREAT 1.1, 1.2, 1.3)

**Why This Module Must Be Step 6**:
- Depends on User Management module (Step 5) for user account verification
- Depends on Authorization module (Step 3) for role verification after authentication
- Depends on Utilities module (Step 1) for UTID generation in authentication logs
- Depends on Error Handling module (Step 2) for standardized error responses
- Required by all modules that need authenticated user context
- Provides authentication infrastructure (all modules need authenticated users)
- Safe to stop after (authentication is independent, creates Session entities)

**Why No Other Module Can Precede**:
- Authentication requires User Management (to verify user accounts exist)
- Authentication requires Authorization (to verify user roles after authentication)
- Building other modules first would violate dependency constraints
- Building other modules first would create unsafe state (missing authentication enforcement)
- Authentication must be in place before business logic modules are built

---

## 2. Owned Entities

### Entities Owned by Authentication Module

**Session**: User session with token, expiration, and invalidation status

**From DOMAIN_MODEL.md**:
- **Entity**: Session (implicit - not explicitly defined, but required for session management)
- **Owner**: System (sessions are system-managed)
- **Purpose**: User session with token, expiration, invalidation status
- **Note**: Session entity must track token, user ID, expiration timestamp, and invalidation status

**From convex/schema.ts** (to be added):
- **Table**: `sessions` (to be added to schema)
- **Fields** (proposed):
  - `userId`: User ID (v.id("users"))
  - `token`: Session token (v.string()) - hashed or encrypted
  - `expiresAt`: Session expiration timestamp (v.number())
  - `createdAt`: Session creation timestamp (v.number())
  - `lastActiveAt`: Last activity timestamp (v.number())
  - `invalidated`: Session invalidation status (v.boolean())
  - `invalidatedAt`: Session invalidation timestamp (v.optional(v.number()))

**From MODULARITY_GUIDE.md**:
- **Owned Entities**: Session
- **Responsibility**: Session creation, validation, expiration, invalidation

**Session Entity States** (from specification):
- **active**: Session is active and valid (initial state)
- **expired**: Session has expired (automatic state transition)
- **invalidated**: Session has been invalidated (manual state transition)

**BLOCKED Notes**: Session entity does not exist in current schema. Session entity must be added to schema before Authentication module implementation.

---

## 3. Trust Boundary Classification

### Explicit Trust Boundary

**Trust Boundary Classification**: **Trusted (Server-Side)**

**From architecture.md**:
- **Backend (Convex)**: Trusted (server-side)
- **Authentication Enforcement**: All authentication is enforced in Convex backend
- **Trust Boundary**: Server-side only (backend is trusted, frontend is untrusted)

**Trust Boundary Requirements**:
- Password hashing must be performed server-side only (in Convex backend)
- Session token generation must be performed server-side only (in Convex backend)
- Session validation must be performed server-side only (in Convex backend)
- Password reset token generation must be performed server-side only (in Convex backend)
- Authentication operations must NOT be performed on frontend (frontend is untrusted)
- Authentication operations must NOT be exposed to frontend (authentication logic is server-side only)
- Authentication decisions must be made server-side (frontend cannot bypass authentication)

**Kill-Switch Points** (from architecture.md):
- Authentication module does not implement kill-switches (kill-switches are system-level)
- Authentication module supports kill-switch enforcement (authentication can block operations)
- Authentication module does not control kill-switches (kill-switches are controlled by system operator)

**Single-Human Authority Control Points** (from architecture.md):
- Authentication module does not implement authority control points (authority is system-level)
- Authentication module enforces authority boundaries (user identity verification)
- Authentication module does not control authority (authority is controlled by system operator)

**BLOCKED Notes**: None

---

## 4. Authentication Model

### 4.1 Individual User Credentials

**Requirement**: Each user must have individual credentials (password). No shared passwords.

**Current State**: Pilot mode uses shared password (`Farm2Market2024`) for all users.

**Production Requirement**:
- Each user account must have a unique password
- Passwords must be stored securely (hashed, not plaintext)
- Passwords must not be shared between users
- Passwords must not be inferable from user data (email, alias, etc.)

**Password Storage**:
- Passwords must be stored as hashes (never plaintext)
- Password hashes must be stored in User entity `passwordHash` field
- Password hashes must be generated server-side only
- Password hashes must not be exposed to frontend

**Password Requirements** (to be defined in implementation):
- Minimum length: To be specified (recommended: 8+ characters)
- Complexity requirements: To be specified (recommended: mixed case, numbers, special characters)
- Password strength validation: To be specified (server-side only)

**BLOCKED Notes**: Password requirements are to be specified during implementation. Specification does not define exact requirements (implementation detail).

---

### 4.2 Secure Password Hashing

**Requirement**: Passwords must be hashed using secure hashing algorithm (bcrypt, argon2, or equivalent).

**Current State**: Pilot mode password hashing status UNKNOWN (may not be hashed securely).

**Production Requirement**:
- Password hashing algorithm: bcrypt, argon2, or equivalent (industry-standard secure hashing)
- Password hashing must be performed server-side only
- Password hashing must use salt (algorithm-dependent, but salt must be used)
- Password hashing must be one-way (cannot be reversed)
- Password hashing must be computationally expensive (resistant to brute force)

**Hashing Algorithm Selection** (to be specified in implementation):
- **bcrypt**: Industry-standard, widely supported, time-tested
- **argon2**: Modern, memory-hard, resistant to GPU attacks
- **Equivalent**: Any algorithm that meets security requirements (salt, one-way, computationally expensive)

**Hashing Requirements**:
- Salt must be unique per password (algorithm-dependent)
- Hash must be stored securely (database field)
- Hash must not be exposed to frontend
- Hash comparison must be constant-time (prevent timing attacks)

**BLOCKED Notes**: Exact hashing algorithm is to be selected during implementation. Specification requires secure hashing (bcrypt, argon2, or equivalent), but does not mandate specific algorithm.

---

### 4.3 Session Model

**Requirement**: Session management must be implemented (stateless vs stateful, expiration, invalidation).

**Current State**: Pilot mode session management status UNKNOWN (may not be implemented).

**Production Requirement**:
- Session model: Stateless (JWT) or stateful (database sessions) - to be specified in implementation
- Session tokens must be generated server-side only
- Session tokens must be validated server-side only
- Session expiration must be enforced
- Session invalidation must be supported

**Session Model Options**:

**Option A: Stateless (JWT)**:
- **Pros**: No database storage, scalable, stateless
- **Cons**: Cannot revoke sessions without blacklist, token size limits
- **Implementation**: JWT tokens with expiration, signature verification
- **Storage**: No database storage (tokens are self-contained)
- **Revocation**: Requires token blacklist (if revocation needed)

**Option B: Stateful (Database Sessions)**:
- **Pros**: Can revoke sessions, can track active sessions, can enforce session limits
- **Cons**: Database storage required, requires session cleanup
- **Implementation**: Session entities in database, token validation via database lookup
- **Storage**: Session entities in `sessions` table
- **Revocation**: Direct database invalidation

**Session Model Selection** (to be specified in implementation):
- Specification does not mandate stateless vs stateful
- Implementation must choose one model (not both)
- Implementation must document model choice and justification

**Session Expiration**:
- Session expiration must be enforced (automatic expiration)
- Expiration time: To be specified (recommended: 24 hours, configurable)
- Expiration must be checked on every authenticated request
- Expired sessions must be rejected (cannot be used)

**Session Invalidation**:
- Session invalidation must be supported (manual invalidation)
- Invalidation must be immediate (cannot use invalidated sessions)
- Invalidation must be logged (audit trail)
- Invalidation must support logout (user-initiated) and security invalidation (admin-initiated)

**Session Token Security**:
- Tokens must be cryptographically secure (random, unpredictable)
- Tokens must be signed (if JWT) or validated (if stateful)
- Tokens must not be exposed in URLs (use headers or cookies)
- Tokens must be transmitted over HTTPS only (production requirement)

**BLOCKED Notes**: Exact session model (stateless vs stateful) is to be selected during implementation. Specification requires session management, but does not mandate specific model.

---

### 4.4 Password Reset Flow

**Requirement**: Password reset mechanism must be implemented (email-based or equivalent).

**Current State**: Password reset mechanism NOT IMPLEMENTED.

**Production Requirement**:
- Password reset must be initiated by user (user requests reset)
- Password reset must use secure token (reset token, not password)
- Password reset token must be time-limited (expiration)
- Password reset token must be single-use (cannot be reused)
- Password reset must be logged (audit trail)

**Password Reset Flow** (high-level):
1. **User Requests Reset**: User provides email address
2. **Token Generation**: System generates secure reset token (server-side only)
3. **Token Delivery**: System sends reset token to user email (or equivalent delivery mechanism)
4. **Token Validation**: User provides reset token and new password
5. **Password Update**: System validates token, updates password hash, invalidates token
6. **Session Invalidation**: System invalidates all existing sessions for user (security measure)

**Password Reset Token Requirements**:
- Token must be cryptographically secure (random, unpredictable)
- Token must be time-limited (expiration: recommended 1 hour, configurable)
- Token must be single-use (cannot be reused after password reset)
- Token must be stored securely (hashed or encrypted, not plaintext)
- Token must not be exposed in URLs (use secure delivery mechanism)

**Password Reset Token Storage**:
- Token must be stored in database (reset token table or user entity)
- Token must be hashed or encrypted (not plaintext)
- Token must be associated with user ID and expiration timestamp
- Token must be invalidated after use or expiration

**Password Reset Delivery**:
- Delivery mechanism: Email-based (recommended) or equivalent secure mechanism
- Email delivery: To be specified in implementation (SMTP, email service, etc.)
- Email content: To be specified in implementation (reset link, token, instructions)
- Email security: Must not expose reset token in email (use secure link or equivalent)

**BLOCKED Notes**: Exact email delivery mechanism is to be specified during implementation. Specification requires password reset, but does not mandate specific delivery mechanism (email is recommended, but equivalent secure mechanisms are allowed).

---

### 4.5 Explicit Role Assignment

**Requirement**: Role assignment must be explicit (admin-controlled). No role inference.

**Current State**: Pilot mode uses role inference from email prefix (BLOCKED FOR PRODUCTION).

**Production Requirement**:
- Role assignment must be explicit (admin-controlled via User Management module)
- Role must not be inferred from email prefix (BLOCKED FOR PRODUCTION)
- Role must not be inferred from user data (email, alias, etc.)
- Role must be stored in User entity `role` field (explicit field)
- Authentication must read role from User entity (not infer role)

**Role Assignment Flow**:
1. **User Account Creation**: Admin creates user account via User Management module
2. **Role Assignment**: Admin assigns role explicitly (farmer, trader, buyer, admin)
3. **Role Storage**: Role is stored in User entity `role` field
4. **Authentication**: Authentication reads role from User entity (not inferred)

**Role Verification**:
- Authentication must verify user role from User entity (read-only)
- Authentication must not assign roles (User Management responsibility)
- Authentication must not infer roles (explicit role assignment only)
- Authentication must provide role to Authorization module (for authorization checks)

**BLOCKED Notes**: Role inference from email prefix is BLOCKED FOR PRODUCTION. Authentication must use explicit role assignment (admin-controlled via User Management module).

---

## 5. Interaction with User Management Module

### 5.1 User Account Verification

**Requirement**: Authentication must verify user accounts exist via User Management module.

**Interaction Point**:
- Authentication calls User Management `getUserById` to verify user exists
- Authentication reads User entity to get user role and password hash
- Authentication does not create, modify, or delete users (User Management responsibility)

**User Account States**:
- **active**: User account is active (authentication allowed)
- **suspended**: User account is suspended (authentication blocked)
- **deleted**: User account is deleted (authentication blocked)

**Authentication Behavior by User State**:
- **active**: Authentication allowed (normal flow)
- **suspended**: Authentication blocked (return error, do not authenticate)
- **deleted**: Authentication blocked (return error, do not authenticate)

**BLOCKED Notes**: User Management module (Step 5) is complete and locked. Authentication can use User Management `getUserById` to verify user accounts.

---

### 5.2 Role Reading

**Requirement**: Authentication must read user role from User entity (not assign or infer).

**Interaction Point**:
- Authentication reads User entity `role` field (read-only)
- Authentication provides role to Authorization module (for authorization checks)
- Authentication does not assign roles (User Management responsibility)
- Authentication does not infer roles (explicit role assignment only)

**Role Flow**:
1. **User Login**: User provides credentials (email, password)
2. **User Verification**: Authentication verifies user exists (User Management `getUserById`)
3. **Password Verification**: Authentication verifies password (password hash comparison)
4. **Role Reading**: Authentication reads role from User entity `role` field
5. **Session Creation**: Authentication creates session with user ID and role
6. **Authorization**: Authentication provides role to Authorization module (for authorization checks)

**BLOCKED Notes**: Role assignment is User Management responsibility. Authentication only reads role (read-only access).

---

### 5.3 Password Hash Storage

**Requirement**: Password hashes must be stored in User entity `passwordHash` field.

**Interaction Point**:
- Authentication reads `passwordHash` from User entity (for password verification)
- Authentication writes `passwordHash` to User entity (for password updates, password reset)
- User Management does not manage password hashes (Authentication responsibility)

**Password Hash Management**:
- **Password Creation**: Authentication generates password hash (server-side only)
- **Password Storage**: Authentication stores password hash in User entity `passwordHash` field
- **Password Verification**: Authentication reads password hash, compares with provided password
- **Password Update**: Authentication updates password hash in User entity (password reset, password change)

**BLOCKED Notes**: Password hash management is Authentication responsibility. User Management does not manage password hashes.

---

## 6. Security Boundaries and Invariants

### 6.1 Security Boundaries

**Server-Side Authentication Enforcement**:
- All authentication must be performed server-side only (in Convex backend)
- Password hashing must be performed server-side only
- Session token generation must be performed server-side only
- Session validation must be performed server-side only
- Frontend cannot bypass authentication (all requests must be authenticated)

**Password Security**:
- Passwords must never be stored in plaintext
- Passwords must never be transmitted in plaintext (HTTPS only)
- Passwords must never be logged (no password in logs)
- Passwords must never be exposed to frontend (password hashes only)

**Session Security**:
- Session tokens must be cryptographically secure
- Session tokens must be validated server-side only
- Session tokens must not be exposed in URLs
- Session tokens must be transmitted over HTTPS only

**BLOCKED Notes**: None

---

### 6.2 Supported Invariants

**INVARIANT 2.1: Server-Side Authorization Enforcement**

**How Authentication Supports**:
- Authentication provides authenticated user context to Authorization module
- Authentication ensures all requests are authenticated (server-side only)
- Authentication prevents unauthorized access (authentication required before authorization)

**Authentication Responsibility**:
- Provide authenticated user context (user ID, role) to Authorization module
- Ensure authentication is server-side only (no frontend authentication)
- Ensure authentication cannot be bypassed (all requests must be authenticated)

**From INVARIANTS.md**:
- **Description**: All authorization checks must be performed server-side (in Convex backend). Frontend cannot bypass authorization. All mutations require server-side authorization verification.
- **Why This Invariant Exists**: Client-side authorization can be bypassed. Server-side enforcement is the only trusted authorization boundary.
- **Mandatory System Response**: Block affected mutations until authorization is added, log violation, notify system operator

**BLOCKED Notes**: None

---

**INVARIANT 2.2: Admin Role Verification**

**How Authentication Supports**:
- Authentication provides user role to Authorization module (for admin role verification)
- Authentication ensures role is read from User entity (not inferred)
- Authentication ensures role is explicit (admin-controlled, not inferred)

**Authentication Responsibility**:
- Provide user role to Authorization module (read from User entity)
- Ensure role is explicit (not inferred from email prefix)
- Ensure role is read-only (authentication does not assign roles)

**From INVARIANTS.md**:
- **Description**: All admin actions must verify that the acting user has `role === "admin"` (verified server-side). Admin actions include: delivery verification, transaction reversal, purchase window control, pilot mode control, user role changes.
- **Why This Invariant Exists**: Admin actions have significant authority. Unauthorized admin actions could harm users or compromise system integrity.
- **Mandatory System Response**: Block affected admin actions until role verification is added, log violation, notify system operator

**BLOCKED Notes**: None

---

**INVARIANT 2.3: Frontend Cannot Bypass Authorization**

**How Authentication Supports**:
- Authentication ensures all requests are authenticated (server-side only)
- Authentication prevents frontend from bypassing authentication (authentication required)
- Authentication ensures authentication cannot be bypassed (all requests must be authenticated)

**Authentication Responsibility**:
- Ensure authentication is server-side only (no frontend authentication)
- Ensure authentication cannot be bypassed (all requests must be authenticated)
- Ensure authentication is enforced before authorization (authentication required)

**From INVARIANTS.md**:
- **Description**: Frontend (Next.js) cannot bypass backend authorization. All user actions must go through backend mutations that enforce authorization.
- **Why This Invariant Exists**: Frontend is untrusted. Authorization bypass would allow unauthorized actions.
- **Mandatory System Response**: Block affected frontend features until authorization bypass is removed, log violation, notify system operator

**BLOCKED Notes**: None

---

## 7. Allowed Operations

### Operations This Module Is Allowed to Perform

**1. Password Hashing**:
- Hash passwords using secure algorithm (bcrypt, argon2, or equivalent)
- Generate password hashes server-side only
- Store password hashes in User entity `passwordHash` field
- Compare password hashes with provided passwords (constant-time comparison)

**2. Session Management**:
- Generate session tokens (server-side only)
- Create session entities (if stateful model)
- Validate session tokens (server-side only)
- Expire sessions (automatic expiration)
- Invalidate sessions (manual invalidation, logout, security invalidation)

**3. Password Reset**:
- Generate password reset tokens (server-side only)
- Store password reset tokens (hashed or encrypted)
- Validate password reset tokens (server-side only)
- Update password hashes (password reset, password change)
- Invalidate password reset tokens (after use or expiration)

**4. User Authentication**:
- Verify user credentials (email, password)
- Verify user account exists (User Management `getUserById`)
- Verify user account state (active, suspended, deleted)
- Read user role from User entity (read-only)
- Create authenticated session (session token generation)

**5. Session Validation**:
- Validate session tokens (server-side only)
- Check session expiration (automatic expiration check)
- Check session invalidation (manual invalidation check)
- Provide authenticated user context (user ID, role) to calling code

**6. UTID Generation for Authentication Logs**:
- Use Utilities module to generate UTIDs for authentication actions
- UTID generation must be deterministic (from Utilities module)
- UTID generation must be pure (from Utilities module)
- UTID generation must be stateless (from Utilities module)

**7. Error Response for Authentication Failures**:
- Use Error Handling module to return standardized errors when authentication fails
- Error responses must be consistent (from Error Handling module)
- Error responses must be server-side only
- Error responses must not expose sensitive information (no password hints, no user existence hints)

**Constraints**:
- All authentication operations must be server-side only
- All authentication operations must be deterministic (same inputs = same result, assuming same database state)
- All authentication operations must be stateless (no internal state, except session storage if stateful)
- All authentication operations must be independently testable
- Password hashing must use secure algorithm (bcrypt, argon2, or equivalent)
- Session tokens must be cryptographically secure
- Password reset tokens must be cryptographically secure

**BLOCKED Notes**: None

---

## 8. Forbidden Operations

### Operations This Module Must NEVER Perform

**1. Role Assignment**:
- **FORBIDDEN**: Assign roles to users (User Management responsibility)
- **FORBIDDEN**: Infer roles from email prefix (BLOCKED FOR PRODUCTION)
- **FORBIDDEN**: Change user roles (User Management responsibility)
- **FORBIDDEN**: Create user accounts (User Management responsibility)
- **Reason**: Authentication verifies credentials and reads roles, does not assign them. Role inference from email prefix is BLOCKED FOR PRODUCTION (DOMAIN_MODEL.md, BUSINESS_LOGIC.md).

**2. User Management**:
- **FORBIDDEN**: Create user accounts (User Management responsibility)
- **FORBIDDEN**: Delete user accounts (User Management responsibility)
- **FORBIDDEN**: Suspend user accounts (User Management responsibility)
- **FORBIDDEN**: Modify user data beyond password hash (User Management responsibility)
- **Reason**: Authentication verifies users and manages passwords, does not manage user accounts.

**3. Authorization Logic**:
- **FORBIDDEN**: Perform authorization checks (Authorization module responsibility)
- **FORBIDDEN**: Implement role-based permissions (Authorization module responsibility)
- **FORBIDDEN**: Enforce operation-specific permissions (Authorization module responsibility)
- **Reason**: Authentication verifies identity, Authorization verifies permissions. Authentication provides user context to Authorization module.

**4. Frontend Authentication**:
- **FORBIDDEN**: Perform authentication checks on frontend (authentication must be server-side only)
- **FORBIDDEN**: Trust frontend authentication decisions (authentication must be server-side only)
- **FORBIDDEN**: Expose authentication logic to frontend (authentication must be server-side only)
- **FORBIDDEN**: Allow frontend to bypass authentication (authentication must be server-side only)
- **Reason**: INVARIANT 2.1, 2.3 require server-side authentication only. Frontend is untrusted (architecture.md).

**5. Business Logic**:
- **FORBIDDEN**: Implement business logic (authentication is infrastructure, not business logic)
- **FORBIDDEN**: Make business decisions (authentication is infrastructure, not business logic)
- **FORBIDDEN**: Enforce business rules (authentication is infrastructure, not business logic)
- **FORBIDDEN**: Process transactions (authentication is infrastructure, not business logic)
- **Reason**: Authentication is infrastructure, not business logic. It verifies identity, does not process business operations.

**6. Password Storage in Plaintext**:
- **FORBIDDEN**: Store passwords in plaintext (passwords must be hashed)
- **FORBIDDEN**: Transmit passwords in plaintext (passwords must be transmitted over HTTPS)
- **FORBIDDEN**: Log passwords (passwords must never be logged)
- **FORBIDDEN**: Expose passwords to frontend (passwords must never be exposed)
- **Reason**: Password security requires hashing, secure transmission, and no exposure.

**7. Session Token Exposure**:
- **FORBIDDEN**: Expose session tokens in URLs (tokens must be in headers or cookies)
- **FORBIDDEN**: Transmit session tokens over HTTP (tokens must be transmitted over HTTPS only)
- **FORBIDDEN**: Log session tokens (tokens must never be logged)
- **FORBIDDEN**: Expose session tokens to frontend unnecessarily (tokens must be secure)
- **Reason**: Session token security requires secure transmission and no exposure.

**8. BLOCKED Capabilities**:
- **FORBIDDEN**: Depend on external identity providers (unless explicitly justified)
- **FORBIDDEN**: Use role inference from email prefix (BLOCKED FOR PRODUCTION)
- **FORBIDDEN**: Assume BLOCKED capabilities exist
- **FORBIDDEN**: Implement BLOCKED capabilities
- **Reason**: Authentication must not require BLOCKED capabilities to function. External identity providers are not justified unless explicitly required.

**9. Logging Sink Implementation**:
- **FORBIDDEN**: Implement logging sinks (database, files, network) for general system logs
- **FORBIDDEN**: Choose logging destinations or configure logging infrastructure
- **Reason**: Authentication creates Session entities (its owned entity), but uses Error Handling module for general error logging contracts.

**10. Error Transformation or Filtering**:
- **FORBIDDEN**: Transform, filter, or aggregate errors returned by Error Handling module
- **Reason**: Authentication must preserve error truth, not modify it.

---

## 9. Dependencies

### Required Dependencies

**1. User Management Module (Step 5)**:
- **Required For**: User account verification (`getUserById`), user role reading, password hash storage
- **Status**: ✅ Complete and locked
- **Usage**: 
  - Call `getUserById` to verify user exists
  - Read User entity to get user role and password hash
  - Write User entity to update password hash (password reset, password change)
- **BLOCKED Notes**: None

**2. Authorization Module (Step 3)**:
- **Required For**: Role verification after authentication (authentication provides role to Authorization)
- **Status**: ✅ Complete and locked
- **Usage**: 
  - Authentication provides user role to Authorization module (for authorization checks)
  - Authentication does not perform authorization checks (Authorization module responsibility)
- **BLOCKED Notes**: None

**3. Utilities Module (Step 1)**:
- **Required For**: UTID generation for authentication logs
- **Status**: ✅ Complete and locked
- **Usage**: Generate UTIDs for authentication actions (login, logout, password reset)
- **BLOCKED Notes**: None

**4. Error Handling Module (Step 2)**:
- **Required For**: Standardized error responses for authentication failures
- **Status**: ✅ Complete and locked
- **Usage**: Return standardized errors when authentication fails (invalid credentials, expired session, etc.)
- **BLOCKED Notes**: None

**5. User Entity**:
- **Required For**: Read user role, read/write password hash
- **Status**: ✅ Database schema entity exists (convex/schema.ts)
- **Usage**: 
  - Read User entity to get user role and password hash
  - Write User entity to update password hash (password reset, password change)
- **BLOCKED Notes**: Password hash field (`passwordHash`) exists in schema (v.optional(v.string())). Authentication must use this field for password storage.

**6. Session Entity** (to be added):
- **Required For**: Session storage (if stateful model)
- **Status**: ⚠️ To be added to schema
- **Usage**: Create, read, update Session entities (session creation, validation, expiration, invalidation)
- **BLOCKED Notes**: Session entity does not exist in current schema. Session entity must be added to schema before Authentication module implementation.

---

### BLOCKED Dependencies

**1. External Identity Providers**:
- **BLOCKED Reason**: External identity providers are not justified unless explicitly required
- **Impact**: Authentication must implement password-based authentication (no OAuth, SSO, etc.)
- **Workaround**: Authentication implements password-based authentication (individual user credentials)
- **BLOCKED Notes**: External identity providers (OAuth, SSO, etc.) are not justified unless explicitly required. Specification does not require external identity providers.

---

## 10. Safe Stopping Guarantees

### Safe Stopping Definition

**Safe Stopping**: System can be safely stopped after Authentication module implementation without:
- Creating irreversible damage
- Creating data corruption
- Creating security vulnerabilities
- Violating invariants
- Requiring rollback

**Why Stopping After Authentication Is Safe**:
- Authentication module has minimal dependencies (User Management, Authorization, Utilities, Error Handling, User entity, Session entity)
- Authentication module creates Session entities only (no business data created)
- Authentication module has no side effects beyond Session entity creation/modification and password hash updates
- Authentication module is independently testable (can be validated independently)
- Authentication module preserves invariants (INVARIANT 2.1, 2.2, 2.3)

**Safe Stopping Guarantee**:
- **Data Created**: Authentication module creates Session entities only (no business data)
- **Side Effects**: Authentication module modifies Session entities and User entity password hash only (no external state modifications beyond these)
- **State**: Authentication module is stateless (no internal state, except session storage if stateful)
- **Minimal Dependencies**: Authentication module depends only on User Management, Authorization, Utilities, Error Handling, User entity, Session entity
- **Pure Functions**: All authentication operations are deterministic (same inputs = same result, assuming same database state)

**BLOCKED Notes**: None (authentication is foundational, no BLOCKED dependencies that prevent safe stopping)

---

## 11. What This Module MUST NOT Do

### Explicit Constraints

**1. MUST NOT Assign Roles**:
- Authentication module MUST NOT assign roles to users, infer roles from email prefix, change user roles, or create user accounts.
- **Reason**: Authentication verifies credentials and reads roles, does not assign them. Role inference from email prefix is BLOCKED FOR PRODUCTION.

**2. MUST NOT Manage Users**:
- Authentication module MUST NOT create user accounts, delete user accounts, suspend user accounts, or modify user data beyond password hash.
- **Reason**: Authentication verifies users and manages passwords, does not manage user accounts.

**3. MUST NOT Perform Authorization**:
- Authentication module MUST NOT perform authorization checks, implement role-based permissions, or enforce operation-specific permissions.
- **Reason**: Authentication verifies identity, Authorization verifies permissions. Authentication provides user context to Authorization module.

**4. MUST NOT Perform Frontend Authentication**:
- Authentication module MUST NOT perform authentication checks on frontend, trust frontend authentication decisions, expose authentication logic to frontend, or allow frontend to bypass authentication.
- **Reason**: INVARIANT 2.1, 2.3 require server-side authentication only. Frontend is untrusted.

**5. MUST NOT Store Passwords in Plaintext**:
- Authentication module MUST NOT store passwords in plaintext, transmit passwords in plaintext, log passwords, or expose passwords to frontend.
- **Reason**: Password security requires hashing, secure transmission, and no exposure.

**6. MUST NOT Expose Session Tokens**:
- Authentication module MUST NOT expose session tokens in URLs, transmit session tokens over HTTP, log session tokens, or expose session tokens to frontend unnecessarily.
- **Reason**: Session token security requires secure transmission and no exposure.

**7. MUST NOT Depend on BLOCKED Capabilities**:
- Authentication module MUST NOT depend on external identity providers (unless explicitly justified), use role inference from email prefix (BLOCKED FOR PRODUCTION), assume BLOCKED capabilities exist, or implement BLOCKED capabilities.
- **Reason**: Authentication must not require BLOCKED capabilities to function.

**8. MUST NOT Implement Logging Sinks**:
- Authentication module MUST NOT implement logging sinks (database, files, network), choose logging destinations, or configure logging infrastructure.
- **Reason**: Authentication creates Session entities (its owned entity), but uses Error Handling module for general error logging contracts.

**9. MUST NOT Transform or Filter Errors**:
- Authentication module MUST NOT transform, filter, or aggregate errors returned by Error Handling module.
- **Reason**: Authentication must preserve error truth, not modify it.

---

## 12. Cross-References

### DOMAIN_MODEL.md

**Reference**: DOMAIN_MODEL.md defines entities, ownership, and state transitions.

**Relevance**:
- Authentication module creates and modifies `Session` entity (to be added to schema).
- Authentication module reads and writes `User` entity (password hash, role reading).
- User entity has explicit `role` field (not inferred).
- Role inference from email prefix is BLOCKED FOR PRODUCTION.

**BLOCKED Notes**: Role inference from email prefix is BLOCKED FOR PRODUCTION. Authentication must use explicit role assignment (admin-controlled via User Management module).

---

### INVARIANTS.md

**Reference**: INVARIANTS.md defines non-negotiable constraints.

**Relevance**:
- Authentication module directly supports INVARIANT 2.1 (Server-Side Authorization Enforcement).
- Authentication module directly supports INVARIANT 2.2 (Admin Role Verification).
- Authentication module directly supports INVARIANT 2.3 (Frontend Cannot Bypass Authorization).

**BLOCKED Notes**: None

---

### MODULARITY_GUIDE.md

**Reference**: MODULARITY_GUIDE.md defines module boundaries and forbidden couplings.

**Relevance**:
- Authentication module: User credential verification, password hashing, session management, password reset.
- Owned entities: Session.
- Trust boundary: Trusted (server-side only).
- Dependencies: User Management, Authorization, Utilities, Error Handling, User entity, Session entity.
- Forbidden couplings: MUST NOT be tightly coupled to any specific business logic module (authentication is cross-cutting).

**BLOCKED Notes**: None

---

### IMPLEMENTATION_BOUNDARIES.md

**Reference**: IMPLEMENTATION_BOUNDARIES.md defines coding constraints.

**Relevance**:
- Authentication is an allowed module.
- Authentication must not implement BLOCKED capabilities.
- Authentication must not depend on BLOCKED capabilities.
- Authentication must respect forbidden couplings.
- Authentication must enforce invariants (INVARIANT 2.1, 2.2, 2.3).

**BLOCKED Notes**: None

---

### architecture.md

**Reference**: architecture.md defines trust boundaries and kill switches.

**Relevance**:
- Authentication module enforces trust boundaries (Trusted Backend, Untrusted Frontend).
- Authentication module is part of the Trusted Backend.
- Authentication module ensures frontend cannot bypass authentication (all operations are server-side).

**BLOCKED Notes**: None

---

### THREAT_MODEL.md

**Reference**: THREAT_MODEL.md defines authentication-related threats.

**Relevance**:
- THREAT 1.1: Role Inference Bypass (Email Prefix Manipulation) - mitigated by explicit role assignment
- THREAT 1.2: Frontend Authorization Bypass - mitigated by server-side authentication
- THREAT 1.3: Admin Credential Compromise - mitigated by secure password hashing and session management

**BLOCKED Notes**: Production authentication is NOT IMPLEMENTED (VISION.md BLOCKED #1). Mitigation depends on production authentication implementation.

---

### BUSINESS_LOGIC.md

**Reference**: BUSINESS_LOGIC.md defines user account creation workflow.

**Relevance**:
- Authentication module implements user authentication workflow (login, logout, password reset).
- User account creation is User Management responsibility (not Authentication responsibility).
- Role assignment is User Management responsibility (not Authentication responsibility).

**BLOCKED Notes**: Role inference from email prefix is BLOCKED FOR PRODUCTION. Authentication must use explicit role assignment (admin-controlled via User Management module).

---

## 13. Module Prerequisites

### Prerequisites Check

**1. User Management Module (Step 5)**:
- **Status**: ✅ Complete and locked
- **Required For**: User account verification, user role reading, password hash storage
- **Prerequisite Met**: Yes

**2. Authorization Module (Step 3)**:
- **Status**: ✅ Complete and locked
- **Required For**: Role verification after authentication
- **Prerequisite Met**: Yes

**3. Utilities Module (Step 1)**:
- **Status**: ✅ Complete and locked
- **Required For**: UTID generation for authentication logs
- **Prerequisite Met**: Yes

**4. Error Handling Module (Step 2)**:
- **Status**: ✅ Complete and locked
- **Required For**: Standardized error responses for authentication failures
- **Prerequisite Met**: Yes

**5. User Entity**:
- **Status**: ✅ Database schema entity exists (convex/schema.ts)
- **Required For**: Read user role, read/write password hash
- **Prerequisite Met**: Yes (User entity exists, passwordHash field exists)

**6. Session Entity**:
- **Status**: ⚠️ To be added to schema
- **Required For**: Session storage (if stateful model)
- **Prerequisite Met**: Conditional (Session entity must be added to schema before implementation)

**Prerequisites Summary**:
- **All Prerequisites Met**: ⚠️ Conditional (Session entity must be added to schema)
- **Module Status**: ⚠️ **CONDITIONALLY ALLOWED** (can proceed if Session entity is added to schema)

**BLOCKED Notes**: Session entity does not exist in current schema. Session entity must be added to schema before Authentication module implementation. Specification does not mandate stateless vs stateful model, but if stateful model is chosen, Session entity must be added to schema.

---

## 14. Final Check

### Module Purpose

**Verified**: This module provides:
- **Individual User Credentials**: Each user has unique password (no shared passwords)
- **Secure Password Hashing**: Passwords hashed using bcrypt, argon2, or equivalent
- **Session Management**: Session tokens, expiration, invalidation (stateless or stateful)
- **Password Reset**: Password reset mechanism (email-based or equivalent)
- **Explicit Role Assignment**: Role read from User entity (not inferred)
- **User Authentication**: User credential verification, session creation, session validation

**BLOCKED Notes**: Role inference from email prefix is BLOCKED FOR PRODUCTION. Authentication must use explicit role assignment (admin-controlled via User Management module).

---

### Owned Entities

**Verified**: This module owns:
- **Session**: User session with token, expiration, and invalidation status

**BLOCKED Notes**: Session entity does not exist in current schema. Session entity must be added to schema before Authentication module implementation.

---

### Trust Boundary Classification

**Verified**: This module has:
- **Trust Boundary**: Trusted (Server-Side)
- **Location**: Convex backend (server-side only)
- **Enforcement**: Server-side authentication only

**BLOCKED Notes**: None

---

### Allowed Operations

**Verified**: This module is allowed to:
- Hash passwords using secure algorithm (bcrypt, argon2, or equivalent)
- Generate session tokens (server-side only)
- Create session entities (if stateful model)
- Validate session tokens (server-side only)
- Expire sessions (automatic expiration)
- Invalidate sessions (manual invalidation)
- Generate password reset tokens (server-side only)
- Validate password reset tokens (server-side only)
- Update password hashes (password reset, password change)
- Verify user credentials (email, password)
- Verify user account exists (User Management `getUserById`)
- Verify user account state (active, suspended, deleted)
- Read user role from User entity (read-only)
- Create authenticated session (session token generation)
- Use Utilities module for UTID generation
- Use Error Handling module for standardized error responses

**BLOCKED Notes**: None (allowed operations are foundational)

---

### Forbidden Operations

**Verified**: This module is forbidden from:
- Role assignment (assigning roles, inferring roles from email)
- User management (creating, deleting, suspending users)
- Authorization logic (performing authorization checks)
- Frontend authentication (performing authentication checks on frontend)
- Business logic (implementing business logic)
- Password storage in plaintext (storing passwords in plaintext)
- Session token exposure (exposing session tokens in URLs)
- BLOCKED capabilities (depending on external identity providers, using role inference)
- Logging sink implementation (implementing logging sinks)
- Error transformation or filtering (transforming or filtering errors)

**BLOCKED Notes**: None (forbidden operations are explicit)

---

### Supported Invariants

**Verified**: This module supports:
- **INVARIANT 2.1**: Server-Side Authorization Enforcement (authentication is server-side only)
- **INVARIANT 2.2**: Admin Role Verification (authentication provides role to Authorization module)
- **INVARIANT 2.3**: Frontend Cannot Bypass Authorization (authentication cannot be bypassed by frontend)

**BLOCKED Notes**: None

---

### Dependencies

**Verified**: This module has:
- **Required Dependencies**: User Management module (Step 5), Authorization module (Step 3), Utilities module (Step 1), Error Handling module (Step 2), User entity, Session entity (to be added)
- **BLOCKED Dependencies**: External identity providers (not justified unless explicitly required)

**BLOCKED Notes**: Session entity does not exist in current schema. Session entity must be added to schema before Authentication module implementation.

---

### Safe Stopping Guarantees

**Verified**: Stopping after this step is safe because:
- Authentication module creates Session entities only (no business data created)
- Authentication module has no side effects beyond Session entity creation/modification and password hash updates
- Authentication module is stateless (no internal state, except session storage if stateful)
- Authentication module is deterministic (same inputs = same result, assuming same database state)
- Authentication module is independently testable (can be validated independently)
- Authentication module has minimal dependencies (User Management, Authorization, Utilities, Error Handling, User entity, Session entity)

**BLOCKED Notes**: None (authentication is foundational, no BLOCKED dependencies that prevent safe stopping)

---

**CURRENT MODULE STATUS**: ⚠️ **CONDITIONALLY ALLOWED**

**Production Authentication module specification is defined. Module can proceed if Session entity is added to schema. User entity has explicit role field and passwordHash field in schema (convex/schema.ts). Authentication module reads role from User entity (not inferred). Role inference from email prefix is BLOCKED FOR PRODUCTION. Authentication must use explicit role assignment (admin-controlled via User Management module).**

**Justification**:
- All prerequisites are met (User Management module Step 5 complete, Authorization module Step 3 complete, Utilities module Step 1 complete, Error Handling module Step 2 complete, User entity exists with explicit role field and passwordHash field)
- User entity schema has explicit role field: `role: v.union(v.literal("farmer"), v.literal("trader"), v.literal("buyer"), v.literal("admin"))` (convex/schema.ts)
- User entity schema has passwordHash field: `passwordHash: v.optional(v.string())` (convex/schema.ts)
- Authentication module uses explicit role assignment (admin-controlled via User Management module, not inferred)
- Role assignment mechanism BLOCKED FOR PRODUCTION does not block Authentication module (role assignment is User Management responsibility, not Authentication responsibility)
- Authentication module does not require BLOCKED capabilities to function (only requires explicit role assignment, not role inference)
- Authentication module is safe to stop after (creates Session entities only, no business data)
- Authentication module supports required invariants (INVARIANT 2.1, 2.2, 2.3)
- All dependencies are satisfied (User Management, Authorization, Utilities, Error Handling, User entity with explicit role field and passwordHash field)
- **Conditional**: Session entity must be added to schema before implementation (if stateful model is chosen)

---

*This document must be updated when implementation begins, contracts change, or new authentication requirements are needed. No assumptions. Only truth.*
