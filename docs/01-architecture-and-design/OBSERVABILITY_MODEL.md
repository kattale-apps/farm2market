# OBSERVABILITY_MODEL.md

**Production System Observability Model**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- INVARIANTS.md defines what must never be violated
- THREAT_MODEL.md defines what can go wrong
- AUDIT_MODEL.md defines what is logged for truth and forensics
- architecture.md defines trust boundaries and kill-switches
- BUSINESS_LOGIC.md defines irreversible actions
- Observability is about real-time awareness and intervention, not history

---

## 1. Observability Principles

### Core Principles

**1. Human Decision Support, Not Automation**
- Observability supports human decision-making
- Observability does not auto-correct or auto-heal
- All actions require human authorization

**2. Invariant and Threat Mapping**
- Metrics must map to invariants or threats
- Alerts must indicate potential invariant violations or threats
- No metrics exist without purpose

**3. Explicit Thresholds**
- All alerts have explicit thresholds
- Thresholds are defined, not inferred
- Threshold violations trigger human response, not automatic action

**4. No New Authority**
- Observability does not create new authority
- Observability does not bypass existing authority boundaries
- Observability respects single-human authority model

**5. Real-Time Awareness**
- Observability provides real-time awareness
- Observability is not historical analysis (that is audit)
- Observability enables timely human intervention

**6. Measurability Requirement**
- Metrics must be reliably measurable
- If a metric cannot be reliably measured, it is BLOCKED
- BLOCKED metrics are explicitly acknowledged

---

## 2. Key Metrics (What is Measured and Why)

### Money Conservation Metrics

#### METRIC 1.1: Wallet Ledger Balance Consistency

**What is Measured**: For each trader, calculate balance from ledger entries: `sum(capital_deposits) - sum(capital_locks) + sum(capital_unlocks)`. Compare to `balanceAfter` in most recent ledger entry.

**Why This Metric Exists**: Maps to INVARIANT 1.1 (Wallet Ledger Balance Consistency). Detects ledger corruption or calculation errors.

**Measurement Method**: Query WalletLedger entries for each trader, calculate sum, compare to most recent `balanceAfter`.

**Measurement Frequency**: Real-time (on every ledger entry creation), periodic verification (hourly)

**Maps to Invariant**: INVARIANT 1.1: Wallet Ledger Balance Consistency

**Maps to Threat**: THREAT 2.1: Ledger Entry Modification or Deletion, THREAT 2.2: Balance Calculation Error

**BLOCKED Notes**: None

---

#### METRIC 1.2: Wallet Ledger Entry Count

**What is Measured**: Total count of WalletLedger entries. Track if count decreases (indicates deletion).

**Why This Metric Exists**: Maps to INVARIANT 1.2 (Wallet Ledger Entry Immutability). Detects ledger entry deletion.

**Measurement Method**: Count WalletLedger entries. Alert if count decreases.

**Measurement Frequency**: Real-time (on every ledger entry creation/deletion attempt), periodic verification (hourly)

**Maps to Invariant**: INVARIANT 1.2: Wallet Ledger Entry Immutability

**Maps to Threat**: THREAT 2.1: Ledger Entry Modification or Deletion

**BLOCKED Notes**: None

---

#### METRIC 1.3: Balance Overwrite Detection

**What is Measured**: Check if any mutation directly updates a balance field (if such fields exist). Check if balance calculation bypasses ledger entries.

**Why This Metric Exists**: Maps to INVARIANT 1.3 (No Balance Overwrites). Detects balance overwrite attempts.

**Measurement Method**: Code review (static analysis), runtime monitoring (if balance fields exist)

**Measurement Frequency**: Continuous (code review), real-time (runtime monitoring if implemented)

**Maps to Invariant**: INVARIANT 1.3: No Balance Overwrites

**Maps to Threat**: THREAT 2.2: Balance Calculation Error

**BLOCKED Notes**: Runtime balance overwrite detection may not be implemented (depends on code structure)

---

### Authorization Metrics

#### METRIC 2.1: Admin Action Rate

**What is Measured**: Number of admin actions per hour. Track admin action frequency.

**Why This Metric Exists**: Maps to THREAT 1.3 (Admin Credential Compromise), THREAT 4.1 (Admin Unauthorized Transaction Reversal). Detects unusual admin activity.

**Measurement Method**: Count AdminAction entries per hour.

**Measurement Frequency**: Real-time (on every admin action), hourly aggregation

**Maps to Invariant**: INVARIANT 2.2: Admin Role Verification, INVARIANT 8.1: Admin Action Logging Completeness

**Maps to Threat**: THREAT 1.3: Admin Credential Compromise, THREAT 4.1: Admin Unauthorized Transaction Reversal, THREAT 4.2: Admin Role Assignment Abuse, THREAT 4.3: Admin Kill-Switch Abuse

**BLOCKED Notes**: None

---

#### METRIC 2.2: Rate Limit Violations

**What is Measured**: Number of RateLimitHit entries per hour. Track rate limit violation frequency.

**Why This Metric Exists**: Maps to THREAT 1.2 (Frontend Authorization Bypass). Detects authorization bypass attempts.

**Measurement Method**: Count RateLimitHit entries per hour.

**Measurement Frequency**: Real-time (on every rate limit violation), hourly aggregation

**Maps to Invariant**: INVARIANT 2.1: Server-Side Authorization Enforcement, INVARIANT 2.3: Frontend Cannot Bypass Authorization

**Maps to Threat**: THREAT 1.2: Frontend Authorization Bypass

**BLOCKED Notes**: None

---

#### METRIC 2.3: Role Change Frequency

**What is Measured**: Number of user role changes per hour. Track role change frequency.

**Why This Metric Exists**: Maps to THREAT 1.1 (Role Inference Bypass), THREAT 4.2 (Admin Role Assignment Abuse). Detects unusual role changes.

**Measurement Method**: Count AdminAction entries with `actionType === "user_role_change"` per hour.

**Measurement Frequency**: Real-time (on every role change), hourly aggregation

**Maps to Invariant**: INVARIANT 3.1: Users Cannot Change Their Own Role

**Maps to Threat**: THREAT 1.1: Role Inference Bypass, THREAT 4.2: Admin Role Assignment Abuse

**BLOCKED Notes**: None

---

### Exposure Limit Metrics

#### METRIC 3.1: Trader Exposure Levels

**What is Measured**: Current exposure for each trader: `capital_committed + locked_orders + inventory_value`. Track exposure levels.

**Why This Metric Exists**: Maps to INVARIANT 6.1 (Trader Exposure Limit Enforcement), INVARIANT 6.2 (Exposure Calculation Atomicity). Detects exposure limit violations.

**Measurement Method**: Calculate exposure for each trader from WalletLedger, ListingUnit, and TraderInventory entities.

**Measurement Frequency**: Real-time (on every unit lock), periodic verification (hourly)

**Maps to Invariant**: INVARIANT 3.2: Users Cannot Bypass Exposure Limits, INVARIANT 6.1: Trader Exposure Limit Enforcement, INVARIANT 6.2: Exposure Calculation Atomicity

**Maps to Threat**: THREAT 8.1: Exposure Limit Calculation Bypass

**BLOCKED Notes**: None

---

#### METRIC 3.2: Exposure Limit Violations

**What is Measured**: Number of unit lock attempts that would exceed exposure limit. Track exposure limit violation attempts.

**Why This Metric Exists**: Maps to INVARIANT 6.1 (Trader Exposure Limit Enforcement). Detects exposure limit bypass attempts.

**Measurement Method**: Count unit lock attempts that fail due to exposure limit.

**Measurement Frequency**: Real-time (on every unit lock attempt)

**Maps to Invariant**: INVARIANT 6.1: Trader Exposure Limit Enforcement

**Maps to Threat**: THREAT 8.1: Exposure Limit Calculation Bypass

**BLOCKED Notes**: None

---

### Kill-Switch Metrics

#### METRIC 4.1: Pilot Mode Status

**What is Measured**: Current value of `systemSettings.pilotMode`. Track pilot mode state.

**Why This Metric Exists**: Maps to INVARIANT 7.1 (Pilot Mode Enforcement), THREAT 6.1 (Pilot Mode Enforcement Failure). Detects pilot mode state.

**Measurement Method**: Query SystemSettings entity for `pilotMode` value.

**Measurement Frequency**: Real-time (on every pilot mode change), continuous monitoring

**Maps to Invariant**: INVARIANT 7.1: Pilot Mode Enforcement

**Maps to Threat**: THREAT 6.1: Pilot Mode Enforcement Failure

**BLOCKED Notes**: None

---

#### METRIC 4.2: Purchase Window Status

**What is Measured**: Current value of `purchaseWindows.isOpen`. Track purchase window state.

**Why This Metric Exists**: Maps to INVARIANT 7.2 (Purchase Window Enforcement), THREAT 6.2 (Purchase Window Enforcement Failure). Detects purchase window state.

**Measurement Method**: Query PurchaseWindow entity for `isOpen` value.

**Measurement Frequency**: Real-time (on every purchase window change), continuous monitoring

**Maps to Invariant**: INVARIANT 7.2: Purchase Window Enforcement

**Maps to Threat**: THREAT 6.2: Purchase Window Enforcement Failure

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2). Purchase window status cannot be tested until purchase function is implemented.

---

#### METRIC 4.3: Money-Moving Mutations During Pilot Mode

**What is Measured**: Number of money-moving mutations (capital deposits, capital locks, profit withdrawals, unit locks) that occur when `pilotMode === true`. Should be zero.

**Why This Metric Exists**: Maps to INVARIANT 7.1 (Pilot Mode Enforcement), THREAT 6.1 (Pilot Mode Enforcement Failure). Detects pilot mode enforcement failures.

**Measurement Method**: Count WalletLedger entries of type `capital_deposit`, `capital_lock`, `profit_withdrawal` and ListingUnit entries with status `locked` when `pilotMode === true`.

**Measurement Frequency**: Real-time (on every money-moving mutation), continuous monitoring

**Maps to Invariant**: INVARIANT 7.1: Pilot Mode Enforcement

**Maps to Threat**: THREAT 6.1: Pilot Mode Enforcement Failure

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist). Metric may not be measurable if enforcement is not implemented.

---

### System Health Metrics

#### METRIC 5.1: System Availability

**What is Measured**: Frontend and backend availability. Track system uptime.

**Why This Metric Exists**: Maps to THREAT 7.1 (Convex Database Failure), THREAT 7.2 (Vercel Frontend Failure), THREAT 10.1 (Convex Backend Failure), THREAT 10.2 (Infrastructure Dependency Cascading Failure). Detects infrastructure failures.

**Measurement Method**: Health check endpoints (if implemented), infrastructure monitoring (Vercel, Convex)

**Measurement Frequency**: Continuous (health checks every minute)

**Maps to Invariant**: None (system availability is not an invariant, but is a threat)

**Maps to Threat**: THREAT 7.1: Convex Database Failure, THREAT 7.2: Vercel Frontend Failure, THREAT 10.1: Convex Backend Failure, THREAT 10.2: Infrastructure Dependency Cascading Failure

**BLOCKED Notes**: Health check endpoints may not be implemented. Infrastructure monitoring depends on Vercel/Convex capabilities.

---

#### METRIC 5.2: Database Connection Status

**What is Measured**: Convex database connection status. Track database connectivity.

**Why This Metric Exists**: Maps to THREAT 7.1 (Convex Database Failure), THREAT 10.1 (Convex Backend Failure). Detects database failures.

**Measurement Method**: Database connection monitoring (Convex provides this)

**Measurement Frequency**: Continuous (monitoring every minute)

**Maps to Invariant**: None (database connection is not an invariant, but is a threat)

**Maps to Threat**: THREAT 7.1: Convex Database Failure, THREAT 10.1: Convex Backend Failure

**BLOCKED Notes**: Database connection monitoring depends on Convex capabilities.

---

### UTID Traceability Metrics

#### METRIC 6.1: UTID Generation Rate

**What is Measured**: Number of UTIDs generated per hour. Track UTID generation frequency.

**Why This Metric Exists**: Maps to INVARIANT 4.2 (All Meaningful Actions Generate UTIDs), THREAT 9.3 (UTID Orphaning). Detects UTID generation anomalies.

**Measurement Method**: Count entities with UTID fields created per hour.

**Measurement Frequency**: Real-time (on every UTID generation), hourly aggregation

**Maps to Invariant**: INVARIANT 4.1: UTID Immutability, INVARIANT 4.2: All Meaningful Actions Generate UTIDs, INVARIANT 8.2: UTID Traceability

**Maps to Threat**: THREAT 9.3: UTID Orphaning

**BLOCKED Notes**: None

---

#### METRIC 6.2: Orphaned UTID Detection

**What is Measured**: UTIDs that are not associated with any entity. Track orphaned UTIDs.

**Why This Metric Exists**: Maps to INVARIANT 8.2 (UTID Traceability), THREAT 9.3 (UTID Orphaning). Detects UTID traceability failures.

**Measurement Method**: Query all UTIDs from entities, check if any UTIDs are not associated with entities.

**Measurement Frequency**: Periodic verification (hourly)

**Maps to Invariant**: INVARIANT 8.2: UTID Traceability

**Maps to Threat**: THREAT 9.3: UTID Orphaning

**BLOCKED Notes**: None

---

## 3. Alert Conditions and Thresholds

### Alert: Wallet Ledger Balance Inconsistency

**Condition**: For any trader, calculated balance from ledger entries does not match `balanceAfter` in most recent ledger entry.

**Threshold**: Any mismatch (zero tolerance)

**Severity**: Critical

**Human Response Required**: 
- System operator must investigate immediately
- System operator must block wallet operations for affected trader
- System operator must correct balance (create new ledger entry)
- System operator must verify ledger integrity before re-enabling wallet operations

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 1.1: Wallet Ledger Balance Consistency

**Maps to Threat**: THREAT 2.1: Ledger Entry Modification or Deletion, THREAT 2.2: Balance Calculation Error

**BLOCKED Notes**: None

---

### Alert: Wallet Ledger Entry Count Decrease

**Condition**: Total count of WalletLedger entries decreases.

**Threshold**: Any decrease (zero tolerance)

**Severity**: Critical

**Human Response Required**: 
- System operator must investigate immediately
- System operator must block all wallet operations system-wide
- System operator must verify database constraints
- System operator must verify ledger integrity before re-enabling wallet operations

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 1.2: Wallet Ledger Entry Immutability

**Maps to Threat**: THREAT 2.1: Ledger Entry Modification or Deletion

**BLOCKED Notes**: None

---

### Alert: Admin Action Rate Spike

**Condition**: Number of admin actions per hour exceeds 10 (threshold to be adjusted based on normal usage).

**Threshold**: > 10 admin actions per hour

**Severity**: High

**Human Response Required**: 
- System operator must review admin actions for anomalies
- System operator must verify admin credential security
- System operator must investigate if admin actions are authorized

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 2.2: Admin Role Verification, INVARIANT 8.1: Admin Action Logging Completeness

**Maps to Threat**: THREAT 1.3: Admin Credential Compromise, THREAT 4.1: Admin Unauthorized Transaction Reversal, THREAT 4.2: Admin Role Assignment Abuse, THREAT 4.3: Admin Kill-Switch Abuse

**BLOCKED Notes**: Threshold (10 per hour) is an example and must be adjusted based on normal usage patterns.

---

### Alert: Rate Limit Violation Spike

**Condition**: Number of RateLimitHit entries per hour exceeds 50 (threshold to be adjusted based on normal usage).

**Threshold**: > 50 rate limit violations per hour

**Severity**: Medium

**Human Response Required**: 
- System operator must review rate limit violations for patterns
- System operator must investigate if violations indicate authorization bypass attempts
- System operator must verify authorization enforcement

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 2.1: Server-Side Authorization Enforcement, INVARIANT 2.3: Frontend Cannot Bypass Authorization

**Maps to Threat**: THREAT 1.2: Frontend Authorization Bypass

**BLOCKED Notes**: Threshold (50 per hour) is an example and must be adjusted based on normal usage patterns.

---

### Alert: Role Change Frequency Spike

**Condition**: Number of user role changes per hour exceeds 5 (threshold to be adjusted based on normal usage).

**Threshold**: > 5 role changes per hour

**Severity**: High

**Human Response Required**: 
- System operator must review role changes for anomalies
- System operator must verify role changes are authorized
- System operator must investigate if role changes indicate privilege escalation

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 3.1: Users Cannot Change Their Own Role

**Maps to Threat**: THREAT 1.1: Role Inference Bypass, THREAT 4.2: Admin Role Assignment Abuse

**BLOCKED Notes**: Threshold (5 per hour) is an example and must be adjusted based on normal usage patterns.

---

### Alert: Trader Exposure Exceeds Limit

**Condition**: Any trader's exposure exceeds UGX 1,000,000.

**Threshold**: > UGX 1,000,000 exposure

**Severity**: Critical

**Human Response Required**: 
- System operator must investigate immediately
- System operator must verify exposure calculation
- System operator must block unit locks for affected trader
- System operator must investigate if exposure limit was bypassed

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 3.2: Users Cannot Bypass Exposure Limits, INVARIANT 6.1: Trader Exposure Limit Enforcement

**Maps to Threat**: THREAT 8.1: Exposure Limit Calculation Bypass

**BLOCKED Notes**: None

---

### Alert: Money-Moving Mutations During Pilot Mode

**Condition**: Any money-moving mutation (capital deposit, capital lock, profit withdrawal, unit lock) occurs when `pilotMode === true`.

**Threshold**: Any mutation (zero tolerance)

**Severity**: Critical

**Human Response Required**: 
- System operator must investigate immediately
- System operator must verify pilot mode enforcement
- System operator must block all money-moving mutations
- System operator must verify system integrity

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 7.1: Pilot Mode Enforcement

**Maps to Threat**: THREAT 6.1: Pilot Mode Enforcement Failure

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist). Alert may not be triggered if enforcement is not implemented.

---

### Alert: System Unavailability

**Condition**: Frontend or backend becomes unavailable (health check fails).

**Threshold**: Health check fails for > 1 minute

**Severity**: Critical

**Human Response Required**: 
- System operator must investigate infrastructure status
- System operator must verify Vercel/Convex status
- System operator must restore system availability

**Auto-Action**: None (human decision required)

**Maps to Invariant**: None (system availability is not an invariant, but is a threat)

**Maps to Threat**: THREAT 7.1: Convex Database Failure, THREAT 7.2: Vercel Frontend Failure, THREAT 10.1: Convex Backend Failure, THREAT 10.2: Infrastructure Dependency Cascading Failure

**BLOCKED Notes**: Health check endpoints may not be implemented. Infrastructure monitoring depends on Vercel/Convex capabilities.

---

### Alert: Orphaned UTID Detection

**Condition**: Any UTID is not associated with any entity.

**Threshold**: Any orphaned UTID (zero tolerance)

**Severity**: High

**Human Response Required**: 
- System operator must investigate UTID traceability
- System operator must verify UTID generation logic
- System operator must associate orphaned UTIDs with entities (if possible)

**Auto-Action**: None (human decision required)

**Maps to Invariant**: INVARIANT 8.2: UTID Traceability

**Maps to Threat**: THREAT 9.3: UTID Orphaning

**BLOCKED Notes**: None

---

## 4. Rollback Triggers (What Conditions Require Rollback Consideration)

### Rollback Trigger 1: Wallet Ledger Balance Inconsistency

**Condition**: Wallet ledger balance inconsistency detected (calculated balance does not match stored balance).

**Why Rollback Consideration**: Balance inconsistency indicates data corruption or calculation errors. System integrity is compromised.

**Human Decision Required**: 
- System operator must decide: correct balance (create new ledger entry) or rollback system
- Rollback decision depends on severity and scope of inconsistency
- Rollback requires system shutdown and data restoration

**Authority**: System operator only

**Maps to Invariant**: INVARIANT 1.1: Wallet Ledger Balance Consistency

**Maps to Threat**: THREAT 2.1: Ledger Entry Modification or Deletion, THREAT 2.2: Balance Calculation Error

**BLOCKED Notes**: None

---

### Rollback Trigger 2: Wallet Ledger Entry Deletion

**Condition**: Wallet ledger entry count decreases (entries are deleted).

**Why Rollback Consideration**: Ledger entry deletion breaks immutability and audit trail. System integrity is compromised.

**Human Decision Required**: 
- System operator must decide: restore entries (if possible) or rollback system
- Rollback decision depends on severity and scope of deletion
- Rollback requires system shutdown and data restoration

**Authority**: System operator only

**Maps to Invariant**: INVARIANT 1.2: Wallet Ledger Entry Immutability

**Maps to Threat**: THREAT 2.1: Ledger Entry Modification or Deletion

**BLOCKED Notes**: None

---

### Rollback Trigger 3: Trader Exposure Exceeds Limit

**Condition**: Any trader's exposure exceeds UGX 1,000,000 (exposure limit violation).

**Why Rollback Consideration**: Exposure limit violation indicates system enforcement failure. Traders may have unmanaged risk.

**Human Decision Required**: 
- System operator must decide: reverse transactions that exceed limit or rollback system
- Rollback decision depends on severity and scope of violation
- Rollback requires system shutdown and data restoration

**Authority**: System operator only

**Maps to Invariant**: INVARIANT 6.1: Trader Exposure Limit Enforcement

**Maps to Threat**: THREAT 8.1: Exposure Limit Calculation Bypass

**BLOCKED Notes**: None

---

### Rollback Trigger 4: Money-Moving Mutations During Pilot Mode

**Condition**: Money-moving mutations occur when `pilotMode === true` (pilot mode enforcement failure).

**Why Rollback Consideration**: Pilot mode enforcement failure indicates kill-switch failure. System safety is compromised.

**Human Decision Required**: 
- System operator must decide: reverse unauthorized transactions or rollback system
- Rollback decision depends on severity and scope of failure
- Rollback requires system shutdown and data restoration

**Authority**: System operator only

**Maps to Invariant**: INVARIANT 7.1: Pilot Mode Enforcement

**Maps to Threat**: THREAT 6.1: Pilot Mode Enforcement Failure

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist). Rollback trigger may not be detectable if enforcement is not implemented.

---

### Rollback Trigger 5: Admin Credential Compromise

**Condition**: Unusual admin activity detected (admin action rate spike, unauthorized actions).

**Why Rollback Consideration**: Admin credential compromise indicates unauthorized access. System integrity is compromised.

**Human Decision Required**: 
- System operator must decide: reverse unauthorized admin actions or rollback system
- Rollback decision depends on severity and scope of compromise
- Rollback requires system shutdown and credential reset

**Authority**: System operator only

**Maps to Invariant**: INVARIANT 2.2: Admin Role Verification

**Maps to Threat**: THREAT 1.3: Admin Credential Compromise

**BLOCKED Notes**: None

---

## 5. Operator Dashboards (What the Human Sees)

### Dashboard 1: System Health Overview

**Purpose**: Provide real-time system health status

**Metrics Displayed**:
- System availability (frontend, backend)
- Database connection status
- Active user count
- Active transaction count

**Update Frequency**: Real-time (every minute)

**Access**: System operator only

**BLOCKED Notes**: Health check endpoints may not be implemented. Dashboard depends on health check implementation.

---

### Dashboard 2: Financial Integrity Overview

**Purpose**: Provide real-time financial integrity status

**Metrics Displayed**:
- Wallet ledger balance consistency status (all traders)
- Wallet ledger entry count (total, per trader)
- Trader exposure levels (all traders, sorted by exposure)
- Exposure limit violations (count, affected traders)

**Update Frequency**: Real-time (on every ledger entry), periodic verification (hourly)

**Access**: System operator only

**BLOCKED Notes**: None

---

### Dashboard 3: Authorization and Security Overview

**Purpose**: Provide real-time authorization and security status

**Metrics Displayed**:
- Admin action rate (per hour, last 24 hours)
- Rate limit violations (per hour, last 24 hours)
- Role change frequency (per hour, last 24 hours)
- Pilot mode status
- Purchase window status

**Update Frequency**: Real-time (on every action), hourly aggregation

**Access**: System operator only

**BLOCKED Notes**: None

---

### Dashboard 4: Kill-Switch Status

**Purpose**: Provide real-time kill-switch status

**Metrics Displayed**:
- Pilot mode status (enabled/disabled, who enabled, when, reason)
- Purchase window status (open/closed, who changed, when, reason)
- Money-moving mutations during pilot mode (count, should be zero)
- Buyer purchases during closed window (count, should be zero)

**Update Frequency**: Real-time (on every kill-switch change), continuous monitoring

**Access**: System operator only

**BLOCKED Notes**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2). Purchase window status cannot be tested until purchase function is implemented.

---

### Dashboard 5: UTID Traceability Overview

**Purpose**: Provide real-time UTID traceability status

**Metrics Displayed**:
- UTID generation rate (per hour, last 24 hours)
- Orphaned UTID count (should be zero)
- UTID distribution by entity type

**Update Frequency**: Real-time (on every UTID generation), periodic verification (hourly)

**Access**: System operator only

**BLOCKED Notes**: None

---

## 6. Manual Intervention Playbooks (High-Level)

### Playbook 1: Wallet Ledger Balance Inconsistency Response

**Trigger**: Wallet ledger balance inconsistency detected

**High-Level Steps**:
1. System operator receives alert
2. System operator investigates affected trader(s)
3. System operator calculates correct balance from ledger entries
4. System operator decides: correct balance (create new ledger entry) or rollback system
5. If correction: System operator creates new ledger entry with correct balance
6. If rollback: System operator shuts down system and restores data
7. System operator verifies ledger integrity
8. System operator re-enables wallet operations

**Authority**: System operator only

**Time Sensitivity**: Immediate (within 1 hour)

**BLOCKED Notes**: None

---

### Playbook 2: Pilot Mode Enforcement Failure Response

**Trigger**: Money-moving mutations occur during pilot mode

**High-Level Steps**:
1. System operator receives alert
2. System operator investigates unauthorized mutations
3. System operator verifies pilot mode enforcement
4. System operator decides: reverse unauthorized transactions or rollback system
5. If reversal: System operator reverses unauthorized transactions (admin action)
6. If rollback: System operator shuts down system and restores data
7. System operator verifies pilot mode enforcement
8. System operator re-enables system (if rollback not required)

**Authority**: System operator only

**Time Sensitivity**: Immediate (within 1 hour)

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist). Playbook may not be applicable if enforcement is not implemented.

---

### Playbook 3: Admin Credential Compromise Response

**Trigger**: Unusual admin activity detected

**High-Level Steps**:
1. System operator receives alert
2. System operator reviews admin actions for anomalies
3. System operator verifies admin credential security
4. System operator decides: reverse unauthorized actions or rollback system
5. If reversal: System operator reverses unauthorized admin actions
6. If rollback: System operator shuts down system and resets credentials
7. System operator verifies system integrity
8. System operator re-enables system (if rollback not required)

**Authority**: System operator only

**Time Sensitivity**: Immediate (within 1 hour)

**BLOCKED Notes**: None

---

### Playbook 4: Exposure Limit Violation Response

**Trigger**: Trader exposure exceeds UGX 1,000,000

**High-Level Steps**:
1. System operator receives alert
2. System operator investigates affected trader
3. System operator verifies exposure calculation
4. System operator decides: reverse transactions that exceed limit or rollback system
5. If reversal: System operator reverses transactions (admin action)
6. If rollback: System operator shuts down system and restores data
7. System operator verifies exposure limit enforcement
8. System operator re-enables system (if rollback not required)

**Authority**: System operator only

**Time Sensitivity**: Immediate (within 1 hour)

**BLOCKED Notes**: None

---

### Playbook 5: System Unavailability Response

**Trigger**: System becomes unavailable (frontend or backend)

**High-Level Steps**:
1. System operator receives alert
2. System operator investigates infrastructure status (Vercel, Convex)
3. System operator verifies infrastructure provider status
4. System operator decides: wait for infrastructure recovery or take action
5. If infrastructure failure: System operator contacts infrastructure provider
6. If system bug: System operator investigates and fixes
7. System operator restores system availability
8. System operator verifies system integrity

**Authority**: System operator only

**Time Sensitivity**: Immediate (within 15 minutes)

**BLOCKED Notes**: Health check endpoints may not be implemented. Infrastructure monitoring depends on Vercel/Convex capabilities.

---

## 7. Observability Coverage vs Invariants (Mapping Table)

| Invariant | Observability Coverage | Metric | Alert | BLOCKED Notes |
|-----------|------------------------|--------|-------|---------------|
| INVARIANT 1.1: Wallet Ledger Balance Consistency | METRIC 1.1: Wallet Ledger Balance Consistency | Balance calculation vs stored balance | Alert: Wallet Ledger Balance Inconsistency | None |
| INVARIANT 1.2: Wallet Ledger Entry Immutability | METRIC 1.2: Wallet Ledger Entry Count | Entry count monitoring | Alert: Wallet Ledger Entry Count Decrease | None |
| INVARIANT 1.3: No Balance Overwrites | METRIC 1.3: Balance Overwrite Detection | Balance overwrite detection | **BLOCKED**: Alert may not be implemented | Runtime detection may not be implemented |
| INVARIANT 2.1: Server-Side Authorization Enforcement | METRIC 2.2: Rate Limit Violations | Rate limit violation monitoring | Alert: Rate Limit Violation Spike | None |
| INVARIANT 2.2: Admin Role Verification | METRIC 2.1: Admin Action Rate | Admin action monitoring | Alert: Admin Action Rate Spike | None |
| INVARIANT 2.3: Frontend Cannot Bypass Authorization | METRIC 2.2: Rate Limit Violations | Rate limit violation monitoring | Alert: Rate Limit Violation Spike | None |
| INVARIANT 3.1: Users Cannot Change Their Own Role | METRIC 2.3: Role Change Frequency | Role change monitoring | Alert: Role Change Frequency Spike | None |
| INVARIANT 3.2: Users Cannot Bypass Exposure Limits | METRIC 3.1: Trader Exposure Levels, METRIC 3.2: Exposure Limit Violations | Exposure monitoring | Alert: Trader Exposure Exceeds Limit | None |
| INVARIANT 3.3: Admin Cannot Access User Real Identities | **BLOCKED**: No metric exists | **BLOCKED**: Query logging not implemented | **BLOCKED**: Alert not implemented | Query logging is not implemented |
| INVARIANT 4.1: UTID Immutability | METRIC 6.1: UTID Generation Rate | UTID generation monitoring | **BLOCKED**: Alert not implemented | UTID immutability is enforced at database level |
| INVARIANT 4.2: All Meaningful Actions Generate UTIDs | METRIC 6.1: UTID Generation Rate | UTID generation monitoring | **BLOCKED**: Alert not implemented | UTID generation is enforced at code level |
| INVARIANT 5.1: AdminAction Entry Immutability | **BLOCKED**: No metric exists | **BLOCKED**: AdminAction immutability enforced at database level | **BLOCKED**: Alert not implemented | AdminAction immutability is enforced at database level |
| INVARIANT 5.2: StorageFeeDeduction Entry Immutability | **BLOCKED**: No metric exists | **BLOCKED**: StorageFeeDeduction immutability enforced at database level | **BLOCKED**: Alert not implemented | Storage fee automation status UNKNOWN |
| INVARIANT 5.3: RateLimitHit Entry Immutability | **BLOCKED**: No metric exists | **BLOCKED**: RateLimitHit immutability enforced at database level | **BLOCKED**: Alert not implemented | RateLimitHit immutability is enforced at database level |
| INVARIANT 6.1: Trader Exposure Limit Enforcement | METRIC 3.1: Trader Exposure Levels, METRIC 3.2: Exposure Limit Violations | Exposure monitoring | Alert: Trader Exposure Exceeds Limit | None |
| INVARIANT 6.2: Exposure Calculation Atomicity | METRIC 3.1: Trader Exposure Levels | Exposure monitoring | **BLOCKED**: Alert not implemented | Atomicity is enforced at transaction level |
| INVARIANT 7.1: Pilot Mode Enforcement | METRIC 4.1: Pilot Mode Status, METRIC 4.3: Money-Moving Mutations During Pilot Mode | Pilot mode monitoring | Alert: Money-Moving Mutations During Pilot Mode | Pilot mode enforcement status UNKNOWN |
| INVARIANT 7.2: Purchase Window Enforcement | METRIC 4.2: Purchase Window Status | Purchase window monitoring | **BLOCKED**: Alert not implemented | Buyer purchase function NOT IMPLEMENTED |
| INVARIANT 8.1: Admin Action Logging Completeness | METRIC 2.1: Admin Action Rate | Admin action monitoring | Alert: Admin Action Rate Spike | Delivery verification actions may not be logged |
| INVARIANT 8.2: UTID Traceability | METRIC 6.1: UTID Generation Rate, METRIC 6.2: Orphaned UTID Detection | UTID traceability monitoring | Alert: Orphaned UTID Detection | None |
| INVARIANT 9.1: Buyer Purchase Function Must Not Partially Operate | **BLOCKED**: No metric exists | **BLOCKED**: Purchase function NOT IMPLEMENTED | **BLOCKED**: Alert not implemented | Buyer purchase function NOT IMPLEMENTED |
| INVARIANT 9.2: Delivery Verification Function Must Not Partially Operate | **BLOCKED**: No metric exists | **BLOCKED**: Delivery verification function status UNKNOWN | **BLOCKED**: Alert not implemented | Delivery verification function status UNKNOWN |
| INVARIANT 9.3: Storage Fee Automation Must Not Partially Operate | **BLOCKED**: No metric exists | **BLOCKED**: Storage fee automation status UNKNOWN | **BLOCKED**: Alert not implemented | Storage fee automation status UNKNOWN |
| INVARIANT 10.1: System Cannot Make Autonomous Decisions | **BLOCKED**: No metric exists | **BLOCKED**: System autonomous decisions should not occur | **BLOCKED**: Alert not implemented | System autonomous decisions should not occur (invariant violation) |
| INVARIANT 10.2: System Cannot Automatically Reverse Successful Transactions | METRIC 2.1: Admin Action Rate | Admin action monitoring | **BLOCKED**: Alert not implemented | Transaction reversals are admin actions |

---

## 8. Observability Coverage vs Threats (Mapping Table)

| Threat | Observability Coverage | Metric | Alert | BLOCKED Notes |
|--------|------------------------|--------|-------|---------------|
| THREAT 1.1: Role Inference Bypass | METRIC 2.3: Role Change Frequency | Role change monitoring | Alert: Role Change Frequency Spike | Production authentication NOT IMPLEMENTED |
| THREAT 1.2: Frontend Authorization Bypass | METRIC 2.2: Rate Limit Violations | Rate limit violation monitoring | Alert: Rate Limit Violation Spike | None |
| THREAT 1.3: Admin Credential Compromise | METRIC 2.1: Admin Action Rate | Admin action monitoring | Alert: Admin Action Rate Spike | None |
| THREAT 2.1: Ledger Entry Modification or Deletion | METRIC 1.2: Wallet Ledger Entry Count | Entry count monitoring | Alert: Wallet Ledger Entry Count Decrease | None |
| THREAT 2.2: Balance Calculation Error | METRIC 1.1: Wallet Ledger Balance Consistency | Balance consistency monitoring | Alert: Wallet Ledger Balance Inconsistency | None |
| THREAT 2.3: Concurrent Transaction Balance Corruption | METRIC 1.1: Wallet Ledger Balance Consistency | Balance consistency monitoring | Alert: Wallet Ledger Balance Inconsistency | None |
| THREAT 3.1: Buyer Purchase Function Partially Operational | **BLOCKED**: No metric exists | **BLOCKED**: Purchase function NOT IMPLEMENTED | **BLOCKED**: Alert not implemented | Buyer purchase function NOT IMPLEMENTED |
| THREAT 3.2: Delivery Verification Function Partially Operational | **BLOCKED**: No metric exists | **BLOCKED**: Delivery verification function status UNKNOWN | **BLOCKED**: Alert not implemented | Delivery verification function status UNKNOWN |
| THREAT 3.3: Storage Fee Automation Partially Operational | **BLOCKED**: No metric exists | **BLOCKED**: Storage fee automation status UNKNOWN | **BLOCKED**: Alert not implemented | Storage fee automation status UNKNOWN |
| THREAT 4.1: Admin Unauthorized Transaction Reversal | METRIC 2.1: Admin Action Rate | Admin action monitoring | Alert: Admin Action Rate Spike | None |
| THREAT 4.2: Admin Role Assignment Abuse | METRIC 2.3: Role Change Frequency | Role change monitoring | Alert: Role Change Frequency Spike | None |
| THREAT 4.3: Admin Kill-Switch Abuse | METRIC 4.1: Pilot Mode Status, METRIC 4.2: Purchase Window Status | Kill-switch monitoring | **BLOCKED**: Alert not implemented | Kill-switch abuse is logged but not alerted |
| THREAT 5.1: System Operator Delayed Response | **BLOCKED**: No metric exists | **BLOCKED**: Operator response time not measured | **BLOCKED**: Alert not implemented | Operator response time monitoring not implemented |
| THREAT 5.2: System Operator Incorrect Balance Correction | METRIC 1.1: Wallet Ledger Balance Consistency | Balance consistency monitoring | Alert: Wallet Ledger Balance Inconsistency | None |
| THREAT 6.1: Pilot Mode Enforcement Failure | METRIC 4.1: Pilot Mode Status, METRIC 4.3: Money-Moving Mutations During Pilot Mode | Pilot mode monitoring | Alert: Money-Moving Mutations During Pilot Mode | Pilot mode enforcement status UNKNOWN |
| THREAT 6.2: Purchase Window Enforcement Failure | METRIC 4.2: Purchase Window Status | Purchase window monitoring | **BLOCKED**: Alert not implemented | Buyer purchase function NOT IMPLEMENTED |
| THREAT 7.1: Convex Database Failure | METRIC 5.1: System Availability, METRIC 5.2: Database Connection Status | System health monitoring | Alert: System Unavailability | Health check endpoints may not be implemented |
| THREAT 7.2: Vercel Frontend Failure | METRIC 5.1: System Availability | System health monitoring | Alert: System Unavailability | Health check endpoints may not be implemented |
| THREAT 8.1: Exposure Limit Calculation Bypass | METRIC 3.1: Trader Exposure Levels, METRIC 3.2: Exposure Limit Violations | Exposure monitoring | Alert: Trader Exposure Exceeds Limit | None |
| THREAT 9.1: AdminAction Log Entry Modification or Deletion | **BLOCKED**: No metric exists | **BLOCKED**: AdminAction immutability enforced at database level | **BLOCKED**: Alert not implemented | AdminAction immutability is enforced at database level |
| THREAT 9.2: Admin Action Not Logged | METRIC 2.1: Admin Action Rate | Admin action monitoring | **BLOCKED**: Alert not implemented | Admin action logging completeness cannot be verified via metrics |
| THREAT 9.3: UTID Orphaning | METRIC 6.1: UTID Generation Rate, METRIC 6.2: Orphaned UTID Detection | UTID traceability monitoring | Alert: Orphaned UTID Detection | None |
| THREAT 10.1: Convex Backend Failure | METRIC 5.1: System Availability, METRIC 5.2: Database Connection Status | System health monitoring | Alert: System Unavailability | Health check endpoints may not be implemented |
| THREAT 10.2: Infrastructure Dependency Cascading Failure | METRIC 5.1: System Availability | System health monitoring | Alert: System Unavailability | Health check endpoints may not be implemented |

---

## 9. BLOCKED Observability Capabilities

### BLOCKED 1: Balance Overwrite Detection

**Blocked By**: Runtime balance overwrite detection may not be implemented (depends on code structure)

**Impact**: Balance overwrite attempts may not be detected in real-time. Detection relies on code review and database constraints.

**What Would Unblock**: Implementation of runtime balance overwrite detection

**Affected Invariants**: INVARIANT 1.3: No Balance Overwrites

**Affected Threats**: THREAT 2.2: Balance Calculation Error

---

### BLOCKED 2: Query Logging Observability

**Blocked By**: Query logging is not implemented. Admin queries are not logged.

**Impact**: Admin query violations (including potential real identity access) cannot be observed in real-time. Detection relies on code review.

**What Would Unblock**: Implementation of query logging (if required for observability)

**Affected Invariants**: INVARIANT 3.3: Admin Cannot Access User Real Identities

**Affected Threats**: None (query violations are detected via code review)

---

### BLOCKED 3: Health Check Endpoints

**Blocked By**: Health check endpoints may not be implemented

**Impact**: System availability cannot be monitored in real-time. Infrastructure monitoring depends on Vercel/Convex capabilities.

**What Would Unblock**: Implementation of health check endpoints

**Affected Invariants**: None (system availability is not an invariant, but is a threat)

**Affected Threats**: THREAT 7.1: Convex Database Failure, THREAT 7.2: Vercel Frontend Failure, THREAT 10.1: Convex Backend Failure, THREAT 10.2: Infrastructure Dependency Cascading Failure

---

### BLOCKED 4: Buyer Purchase Observability

**Blocked By**: Buyer purchase function is NOT IMPLEMENTED (VISION.md BLOCKED #2)

**Impact**: Buyer purchase observability cannot be implemented until purchase function is implemented. Purchase window enforcement cannot be tested.

**What Would Unblock**: Implementation of buyer purchase function

**Affected Invariants**: INVARIANT 7.2: Purchase Window Enforcement, INVARIANT 9.1: Buyer Purchase Function Must Not Partially Operate

**Affected Threats**: THREAT 3.1: Buyer Purchase Function Partially Operational, THREAT 6.2: Purchase Window Enforcement Failure

---

### BLOCKED 5: Delivery Verification Observability

**Blocked By**: Delivery verification function implementation status is UNKNOWN

**Impact**: Delivery verification observability cannot be implemented until function status is verified. Delivery verification actions may not be observable.

**What Would Unblock**: Verification and implementation of delivery verification function

**Affected Invariants**: INVARIANT 9.2: Delivery Verification Function Must Not Partially Operate

**Affected Threats**: THREAT 3.2: Delivery Verification Function Partially Operational

---

### BLOCKED 6: Storage Fee Automation Observability

**Blocked By**: Storage fee automation implementation status is UNKNOWN

**Impact**: Storage fee automation observability cannot be implemented until automation status is verified. Storage fee deductions may not be observable.

**What Would Unblock**: Verification and implementation of storage fee automation

**Affected Invariants**: INVARIANT 9.3: Storage Fee Automation Must Not Partially Operate

**Affected Threats**: THREAT 3.3: Storage Fee Automation Partially Operational

---

### BLOCKED 7: Pilot Mode Enforcement Observability

**Blocked By**: Pilot mode enforcement implementation status is UNKNOWN (assumed to exist)

**Impact**: Pilot mode enforcement observability may not be accurate if enforcement is not implemented. Money-moving mutations during pilot mode may not be detected.

**What Would Unblock**: Verification of pilot mode enforcement implementation

**Affected Invariants**: INVARIANT 7.1: Pilot Mode Enforcement

**Affected Threats**: THREAT 6.1: Pilot Mode Enforcement Failure

---

### BLOCKED 8: Operator Response Time Monitoring

**Blocked By**: Operator response time monitoring is not implemented

**Impact**: System operator delayed response cannot be observed in real-time. Response time is not measured.

**What Would Unblock**: Implementation of operator response time monitoring

**Affected Invariants**: None (operator response time is not an invariant, but is a threat)

**Affected Threats**: THREAT 5.1: System Operator Delayed Response

---

## 10. Residual Operational Risk

### Risk 1: Incomplete Observability Coverage

**Risk**: Some invariants and threats are not observable in real-time. Detection relies on code review, database constraints, or audit logs.

**Mitigation**: Code review, database constraints, audit log analysis

**Residual Risk**: Medium (some violations may not be detected in real-time)

**BLOCKED**: Some observability capabilities are BLOCKED (see Section 9)

---

### Risk 2: Alert Threshold Calibration

**Risk**: Alert thresholds (admin action rate, rate limit violations, role changes) are examples and must be adjusted based on normal usage patterns. Incorrect thresholds may cause false positives or missed violations.

**Mitigation**: Thresholds must be calibrated based on normal usage patterns before production

**Residual Risk**: Medium (thresholds may not be calibrated correctly)

**BLOCKED**: Threshold calibration depends on usage data (not available until system is in use)

---

### Risk 3: Health Check Implementation

**Risk**: Health check endpoints may not be implemented. System availability cannot be monitored in real-time.

**Mitigation**: Health check endpoints must be implemented before production

**Residual Risk**: Medium (system availability may not be monitored in real-time)

**BLOCKED**: Health check endpoints may not be implemented

---

### Risk 4: Pilot Mode Enforcement Observability

**Risk**: Pilot mode enforcement observability may not be accurate if enforcement is not implemented. Money-moving mutations during pilot mode may not be detected.

**Mitigation**: Pilot mode enforcement must be verified before production

**Residual Risk**: Medium (pilot mode enforcement may not be observable)

**BLOCKED**: Pilot mode enforcement implementation status is UNKNOWN

---

### Risk 5: Operator Response Time

**Risk**: System operator response time is not monitored. Delayed responses may not be detected.

**Mitigation**: Operator response time monitoring may be implemented if required

**Residual Risk**: Low (operator response time is not critical for system integrity, but affects threat mitigation)

**BLOCKED**: Operator response time monitoring is not implemented

---

## Final Check

### All Metrics Are Tied to Invariants or Threats

**Verified**: All 11 metrics are tied to invariants or threats:
- METRIC 1.1, 1.2, 1.3: Money conservation (invariants 1.1, 1.2, 1.3)
- METRIC 2.1, 2.2, 2.3: Authorization (invariants 2.1, 2.2, 2.3, threats 1.1, 1.2, 1.3, 4.1, 4.2)
- METRIC 3.1, 3.2: Exposure limits (invariants 3.2, 6.1, 6.2, threat 8.1)
- METRIC 4.1, 4.2, 4.3: Kill-switches (invariants 7.1, 7.2, threats 6.1, 6.2)
- METRIC 5.1, 5.2: System health (threats 7.1, 7.2, 10.1, 10.2)
- METRIC 6.1, 6.2: UTID traceability (invariants 4.1, 4.2, 8.2, threat 9.3)

### No Alert Causes Automatic Action

**Verified**: All 9 alerts require human response:
- All alerts specify "Human Response Required"
- All alerts specify "Auto-Action: None (human decision required)"
- No alerts trigger automatic actions

### All Rollback Triggers Require Human Decision

**Verified**: All 5 rollback triggers require human decision:
- All rollback triggers specify "Human Decision Required"
- All rollback triggers specify "Authority: System operator only"
- No rollback triggers cause automatic rollback

### No Observability Feature Introduces New Authority

**Verified**: All observability features respect existing authority:
- Observability does not create new authority
- Observability does not bypass existing authority boundaries
- Observability respects single-human authority model
- All alerts and rollback triggers require system operator authority

### All BLOCKED Observability Gaps Are Explicit

**Verified**: All BLOCKED observability gaps are explicitly acknowledged:
1. BLOCKED 1: Balance Overwrite Detection
2. BLOCKED 2: Query Logging Observability
3. BLOCKED 3: Health Check Endpoints
4. BLOCKED 4: Buyer Purchase Observability
5. BLOCKED 5: Delivery Verification Observability
6. BLOCKED 6: Storage Fee Automation Observability
7. BLOCKED 7: Pilot Mode Enforcement Observability
8. BLOCKED 8: Operator Response Time Monitoring

---

*This document must be updated when observability requirements change, BLOCKED items are unblocked, or new observability capabilities are implemented. No assumptions. Only truth.*
