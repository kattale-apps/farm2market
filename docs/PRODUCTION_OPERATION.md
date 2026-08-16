# PRODUCTION_OPERATION.md

**Production System Operation Manual**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- PRODUCTION_ACTIVATION.md defines how the system is activated
- INVARIANTS.md defines what must never be violated
- THREAT_MODEL.md defines material risks
- OBSERVABILITY_MODEL.md defines metrics and alerts
- AUDIT_MODEL.md defines forensic guarantees
- architecture.md defines kill-switches and trust boundaries
- BUSINESS_LOGIC.md defines irreversible actions

**Purpose**: This document defines how the production system is operated AFTER activation. Operation is continuous, not event-based.

---

## 1. Operating Principles

### Core Principles

**1. Operation Is Continuous, Not Event-Based**
- System must be monitored continuously, not only when incidents occur
- Monitoring must run 24/7, not only during business hours
- Operator must be aware of system state at all times
- Silence is a failure state (no alerts does not mean no problems)

**2. Every Invariant Must Have an Operational Response**
- Every invariant violation must trigger an alert
- Every alert must have an owner (system operator)
- Every alert must have an action (investigation, correction, or escalation)
- No invariant violation can go undetected or unhandled

**3. Every Alert Must Have an Owner and an Action**
- Every alert must be assigned to system operator
- Every alert must have explicit response actions
- Every alert must have escalation path (if operator is unavailable)
- No alert can be ignored or deferred indefinitely

**4. Human Override Must Always Be Possible**
- System operator can override any automated action
- System operator can stop any operation
- System operator can activate kill-switches at any time
- No automated action can prevent human intervention

**5. Silence Is a Failure State**
- No alerts does not mean system is healthy
- Monitoring system failure is a critical failure
- Alert system failure must be detected and handled
- Partial visibility is unacceptable

**6. Partial Visibility Is Unacceptable**
- All critical metrics must be measurable
- All critical alerts must be triggerable
- All invariants must be observable
- BLOCKED observability gaps must be explicitly acknowledged

**7. Automated Actions Must Never Exceed Documented Authority**
- Automated actions must be explicitly documented
- Automated actions must not bypass human authorization
- Automated actions must be reversible
- No automated action can exceed operator authority

**8. When in Doubt, System Must Fail Safe**
- If operator is unavailable, system must fail safe
- If monitoring fails, system must fail safe
- If invariants are violated, system must fail safe
- Safe state means: no irreversible damage, kill-switches accessible

**9. Single-Human Operation Is a Risk**
- System is operated by ONE HUMAN (single point of failure)
- Operator unavailability is a critical risk
- Operator burnout is a critical risk
- Mitigation strategies must be defined

**10. Incidents Are Expected, Not Rare**
- System will experience incidents
- Incidents must be handled promptly
- Incident handling must be documented
- Incident patterns must be analyzed

---

## 2. Operator Authority and Responsibilities

### Operator Authority

**System Operator** (CEO / Engineering Lead / CTO) - Single human

**Authority Scope**:
- System operator has full authority over system operation
- System operator can activate/deactivate system
- System operator can activate kill-switches
- System operator can investigate and correct violations
- System operator can override automated actions
- System operator can shutdown system

**No Other Authority**:
- No other person has operational authority
- No automated system has operational authority
- No delegation of operational authority exists

**Authority Limitations**:
- Operator authority does not remove operator's responsibility
- Operator authority does not remove operator's liability
- Operator authority does not guarantee system success
- Operator authority does not guarantee operator availability

---

### Operator Responsibilities

**1. Continuous Monitoring**:
- Monitor system continuously (24/7)
- Review alerts promptly (within defined response times)
- Investigate violations immediately
- Document all operational actions

**2. Invariant Violation Response**:
- Detect invariant violations (via alerts)
- Investigate violations immediately
- Correct violations promptly
- Verify corrections before resuming operations

**3. Threat Materialization Response**:
- Detect threat materialization (via alerts)
- Investigate threats immediately
- Mitigate threats promptly
- Document threat responses

**4. Kill-Switch Management**:
- Verify kill-switches are accessible
- Activate kill-switches when required
- Document kill-switch activations
- Verify kill-switch effectiveness

**5. Incident Documentation**:
- Document all incidents
- Document all responses
- Document all corrections
- Analyze incident patterns

**6. System Health Maintenance**:
- Monitor system health continuously
- Respond to health issues promptly
- Maintain observability systems
- Verify audit systems

**7. Operator Availability**:
- Maintain operator availability (within defined limits)
- Communicate unavailability (if possible)
- Document operator availability
- Mitigate operator unavailability risk

**BLOCKED Notes**: Some operator capabilities are BLOCKED (legal compliance verification, backup/restore, health check monitoring). Operator responsibilities are limited by BLOCKED capabilities.

---

## 3. Continuous Monitoring Requirements

### Monitoring Scope

**What Must Be Monitored**:
- All invariants (25 invariants from INVARIANTS.md)
- All threats (24 threats from THREAT_MODEL.md)
- All critical metrics (11 metrics from OBSERVABILITY_MODEL.md)
- All kill-switches (3 kill-switches from architecture.md)
- System health (availability, connectivity, performance)

**Monitoring Frequency**:
- Real-time: Critical metrics (wallet ledger balance, exposure levels, invariant violations)
- Continuous: System health (availability, connectivity)
- Periodic: Non-critical metrics (UTID generation rate, role changes)
- On-demand: Investigation metrics (audit logs, transaction history)

**Monitoring Coverage**:
- All invariants must be monitored (or BLOCKED)
- All threats must be monitored (or BLOCKED)
- All critical metrics must be monitored (or BLOCKED)
- Partial visibility is unacceptable

---

### Monitoring Systems

**Observability Dashboards**:
- Operator must have access to observability dashboards
- Dashboards must display all critical metrics
- Dashboards must display all alerts
- Dashboards must be accessible 24/7

**Alert System**:
- Alert system must be operational 24/7
- Alerts must be delivered to operator promptly
- Alerts must be persistent (not lost if operator is unavailable)
- Alert system failure must be detected

**Health Check System**:
- Health check endpoints must be monitored (if implemented)
- Health check failures must trigger alerts
- Health check system must be operational 24/7

**BLOCKED Notes**: Health check endpoints may not be implemented (BLOCKED). Health check monitoring may not be available.

---

### Monitoring Failure Handling

**Monitoring System Failure**:
- If monitoring system fails, system must fail safe
- Monitoring system failure must be detected (if possible)
- Monitoring system failure must trigger alerts (if possible)
- Operator must be notified of monitoring system failure

**Alert System Failure**:
- If alert system fails, system must fail safe
- Alert system failure must be detected (if possible)
- Alert system failure must trigger alternative notification (if possible)
- Operator must be notified of alert system failure

**Dashboard Inaccessibility**:
- If dashboards are inaccessible, operator must use alternative methods
- Alternative methods must be documented
- Dashboard inaccessibility must be resolved promptly

**BLOCKED Notes**: Some monitoring capabilities are BLOCKED (health check endpoints, pilot mode enforcement observability). Monitoring coverage is partial.

---

## 4. Alert Classification and Response Playbooks

### Alert Classification

**Severity Levels**:
- **Critical**: Invariant violation, system failure, data corruption
- **High**: Threat materialization, authorization bypass, kill-switch failure
- **Medium**: Rate limit violations, suspicious activity, performance degradation
- **Low**: Non-critical anomalies, informational alerts

**Alert Ownership**:
- All alerts are owned by system operator
- No alerts are owned by automated systems
- No alerts can be ignored or deferred indefinitely

**Alert Response Times**:
- **Critical**: Immediate (within 5 minutes)
- **High**: Urgent (within 30 minutes)
- **Medium**: Prompt (within 2 hours)
- **Low**: Timely (within 24 hours)

**BLOCKED Notes**: Response times are targets, not guarantees. Operator availability is limited (single human).

---

### Alert Response Playbooks

#### Playbook 1: Wallet Ledger Balance Inconsistency

**Alert**: Wallet Ledger Balance Inconsistency (Critical)

**Trigger**: For any trader, calculated balance from ledger entries does not match `balanceAfter` in most recent ledger entry.

**Response Steps**:
1. **Immediate**: Block all wallet operations for affected trader
2. **Immediate**: Log violation in system (if logging mechanism exists)
3. **Immediate**: Notify system operator (alert)
4. **Required**: System operator investigates immediately
5. **Required**: System operator corrects balance (create new ledger entry)
6. **Required**: System operator verifies ledger integrity
7. **Required**: System operator re-enables wallet operations (after verification)

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: None

---

#### Playbook 2: Wallet Ledger Entry Count Decrease

**Alert**: Wallet Ledger Entry Count Decrease (Critical)

**Trigger**: Total count of WalletLedger entries decreases.

**Response Steps**:
1. **Immediate**: Block all wallet operations system-wide
2. **Immediate**: Log violation in system (if logging mechanism exists)
3. **Immediate**: Notify system operator (alert)
4. **Required**: System operator investigates immediately
5. **Required**: System operator verifies database constraints
6. **Required**: System operator verifies ledger integrity
7. **Required**: System operator re-enables wallet operations (after verification)

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: None

---

#### Playbook 3: Admin Action Rate Spike

**Alert**: Admin Action Rate Spike (High)

**Trigger**: Number of admin actions per hour exceeds 10 (threshold to be adjusted).

**Response Steps**:
1. **Immediate**: Notify system operator (alert)
2. **Required**: System operator reviews admin actions for anomalies
3. **Required**: System operator verifies admin credential security
4. **Required**: System operator investigates if admin actions are authorized
5. **Required**: System operator documents findings

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: Threshold (10 per hour) is an example and must be adjusted based on normal usage patterns.

---

#### Playbook 4: Rate Limit Violation Spike

**Alert**: Rate Limit Violation Spike (Medium)

**Trigger**: Number of RateLimitHit entries per hour exceeds 50 (threshold to be adjusted).

**Response Steps**:
1. **Immediate**: Notify system operator (alert)
2. **Required**: System operator reviews rate limit violations for patterns
3. **Required**: System operator investigates if violations indicate authorization bypass attempts
4. **Required**: System operator verifies authorization enforcement
5. **Required**: System operator documents findings

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: Threshold (50 per hour) is an example and must be adjusted based on normal usage patterns.

---

#### Playbook 5: Role Change Frequency Spike

**Alert**: Role Change Frequency Spike (High)

**Trigger**: Number of user role changes per hour exceeds 5 (threshold to be adjusted).

**Response Steps**:
1. **Immediate**: Notify system operator (alert)
2. **Required**: System operator reviews role changes for anomalies
3. **Required**: System operator verifies role changes are authorized
4. **Required**: System operator investigates if role changes indicate privilege escalation
5. **Required**: System operator documents findings

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: Threshold (5 per hour) is an example and must be adjusted based on normal usage patterns.

---

#### Playbook 6: Trader Exposure Exceeds Limit

**Alert**: Trader Exposure Exceeds Limit (Critical)

**Trigger**: Any trader's exposure exceeds UGX 1,000,000.

**Response Steps**:
1. **Immediate**: Block all unit lock mutations for affected trader
2. **Immediate**: Log violation in system (if logging mechanism exists)
3. **Immediate**: Notify system operator (alert)
4. **Required**: System operator investigates immediately
5. **Required**: System operator verifies exposure limit enforcement
6. **Required**: System operator corrects exposure (if possible)
7. **Required**: System operator re-enables unit locks (after verification)

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: None

---

#### Playbook 7: Money-Moving Mutations During Pilot Mode

**Alert**: Money-Moving Mutations During Pilot Mode (Critical)

**Trigger**: Any money-moving mutation occurs when `pilotMode === true`.

**Response Steps**:
1. **Immediate**: Block all money-moving mutations system-wide
2. **Immediate**: Log violation in system (if logging mechanism exists)
3. **Immediate**: Notify system operator (alert)
4. **Required**: System operator investigates immediately
5. **Required**: System operator verifies pilot mode enforcement
6. **Required**: System operator corrects enforcement (if possible)
7. **Required**: System operator re-enables mutations (after verification)

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: Pilot mode enforcement implementation status is UNKNOWN (BLOCKED). Alert may not be triggerable if enforcement is not implemented.

---

#### Playbook 8: System Availability Failure

**Alert**: System Availability Failure (Critical)

**Trigger**: Frontend or backend becomes unavailable.

**Response Steps**:
1. **Immediate**: Notify system operator (alert)
2. **Required**: System operator investigates immediately
3. **Required**: System operator verifies infrastructure status (Vercel, Convex)
4. **Required**: System operator documents incident
5. **Required**: System operator restores service (if possible)

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: Health check endpoints may not be implemented (BLOCKED). System availability monitoring may not be available.

---

#### Playbook 9: Database Connection Failure

**Alert**: Database Connection Failure (Critical)

**Trigger**: Convex database connection fails.

**Response Steps**:
1. **Immediate**: Notify system operator (alert)
2. **Required**: System operator investigates immediately
3. **Required**: System operator verifies Convex infrastructure status
4. **Required**: System operator documents incident
5. **Required**: System operator restores service (if possible)

**Authority**: System operator only

**Escalation**: None (system operator is single authority)

**BLOCKED Notes**: Database connection monitoring depends on Convex capabilities.

---

### Alert Escalation

**Escalation Path**:
- All alerts escalate to system operator
- No alerts escalate beyond system operator
- If system operator is unavailable, alerts must be persistent
- Alert persistence must be documented

**Escalation Triggers**:
- Operator does not respond within response time
- Operator is unavailable
- Alert severity increases
- Multiple related alerts occur

**BLOCKED Notes**: Escalation beyond system operator is not possible (single human). Alert persistence depends on alert system capabilities.

---

## 5. Invariant Violation Handling

### Invariant Violation Detection

**Detection Methods**:
- Real-time monitoring (metrics, alerts)
- Periodic verification (audit logs, database checks)
- On-demand investigation (operator queries)

**Detection Coverage**:
- All 25 invariants must be detectable (or BLOCKED)
- Detection must be continuous (not event-based)
- Detection failures must be handled

**BLOCKED Notes**: Some invariants depend on BLOCKED capabilities (delivery verification, pilot mode enforcement). Detection may not be possible for BLOCKED invariants.

---

### Invariant Violation Response

**Response Process**:
1. **Detection**: Invariant violation is detected (via alert or investigation)
2. **Immediate Action**: System blocks affected operations (if possible)
3. **Notification**: System operator is notified (via alert)
4. **Investigation**: System operator investigates violation
5. **Correction**: System operator corrects violation
6. **Verification**: System operator verifies correction
7. **Resumption**: System operator re-enables operations (after verification)
8. **Documentation**: System operator documents violation and response

**Response Authority**:
- System operator only
- No automated correction (human decision required)
- No delegation of response authority

**Response Times**:
- **Critical Invariants**: Immediate (within 5 minutes)
- **High Priority Invariants**: Urgent (within 30 minutes)
- **Medium Priority Invariants**: Prompt (within 2 hours)

**BLOCKED Notes**: Response times are targets, not guarantees. Operator availability is limited (single human).

---

### Invariant Violation Examples

**Example 1: Wallet Ledger Balance Inconsistency (INVARIANT 1.1)**
- **Detection**: Alert triggered when balance mismatch detected
- **Immediate Action**: Block wallet operations for affected trader
- **Investigation**: System operator queries ledger entries, calculates balance
- **Correction**: System operator creates correction ledger entry
- **Verification**: System operator verifies balance consistency
- **Resumption**: System operator re-enables wallet operations

**Example 2: Wallet Ledger Entry Immutability (INVARIANT 1.2)**
- **Detection**: Alert triggered when entry count decreases
- **Immediate Action**: Block all wallet operations system-wide
- **Investigation**: System operator queries database, verifies constraints
- **Correction**: System operator verifies database constraints (if violated, restore from backup)
- **Verification**: System operator verifies ledger integrity
- **Resumption**: System operator re-enables wallet operations

**Example 3: Trader Exposure Exceeds Limit (INVARIANT 6.1)**
- **Detection**: Alert triggered when exposure exceeds UGX 1,000,000
- **Immediate Action**: Block unit lock mutations for affected trader
- **Investigation**: System operator queries exposure calculation, verifies enforcement
- **Correction**: System operator corrects exposure (if possible) or verifies enforcement
- **Verification**: System operator verifies exposure limit enforcement
- **Resumption**: System operator re-enables unit locks (after verification)

**BLOCKED Notes**: Some invariant violations depend on BLOCKED capabilities (delivery verification, pilot mode enforcement). Response may not be possible for BLOCKED invariants.

---

## 6. Threat Materialization Response

### Threat Materialization Detection

**Detection Methods**:
- Real-time monitoring (metrics, alerts)
- Periodic verification (audit logs, security checks)
- On-demand investigation (operator queries)

**Detection Coverage**:
- All 24 threats must be detectable (or BLOCKED)
- Detection must be continuous (not event-based)
- Detection failures must be handled

**BLOCKED Notes**: Some threats depend on BLOCKED capabilities (production authentication, delivery verification). Detection may not be possible for BLOCKED threats.

---

### Threat Materialization Response

**Response Process**:
1. **Detection**: Threat materialization is detected (via alert or investigation)
2. **Immediate Action**: System blocks affected operations (if possible)
3. **Notification**: System operator is notified (via alert)
4. **Investigation**: System operator investigates threat
5. **Mitigation**: System operator mitigates threat
6. **Verification**: System operator verifies mitigation
7. **Resumption**: System operator re-enables operations (after verification)
8. **Documentation**: System operator documents threat and response

**Response Authority**:
- System operator only
- No automated mitigation (human decision required)
- No delegation of response authority

**Response Times**:
- **Critical Threats**: Immediate (within 5 minutes)
- **High Priority Threats**: Urgent (within 30 minutes)
- **Medium Priority Threats**: Prompt (within 2 hours)

**BLOCKED Notes**: Response times are targets, not guarantees. Operator availability is limited (single human).

---

### Threat Materialization Examples

**Example 1: Admin Credential Compromise (THREAT 1.3)**
- **Detection**: Alert triggered when admin action rate spikes
- **Immediate Action**: System operator reviews admin actions
- **Investigation**: System operator verifies admin credential security
- **Mitigation**: System operator revokes compromised credentials, resets admin access
- **Verification**: System operator verifies admin access is secure
- **Resumption**: System operator re-enables admin operations (after verification)

**Example 2: Ledger Entry Modification or Deletion (THREAT 2.1)**
- **Detection**: Alert triggered when ledger entry count decreases
- **Immediate Action**: Block all wallet operations system-wide
- **Investigation**: System operator queries database, verifies constraints
- **Mitigation**: System operator restores ledger entries from backup (if possible)
- **Verification**: System operator verifies ledger integrity
- **Resumption**: System operator re-enables wallet operations (after verification)

**Example 3: Infrastructure Dependency Failure (THREAT 10.1, 10.2)**
- **Detection**: Alert triggered when system availability fails
- **Immediate Action**: System operator verifies infrastructure status
- **Investigation**: System operator investigates Vercel/Convex status
- **Mitigation**: System operator contacts infrastructure providers, waits for resolution
- **Verification**: System operator verifies service restoration
- **Resumption**: System operator re-enables operations (after verification)

**BLOCKED Notes**: Some threat materializations depend on BLOCKED capabilities (production authentication, delivery verification). Response may not be possible for BLOCKED threats.

---

## 7. Kill-Switch Usage During Operations

### Kill-Switch Types

**1. Pilot Mode (Admin-Controlled)**:
- **What It Stops**: All money-moving mutations
- **Who Can Activate**: Admin only
- **When to Use**: System issues, disputes, violations
- **Reversibility**: Reversible (admin can disable)

**2. Purchase Window (Admin-Controlled)**:
- **What It Stops**: Buyer purchases
- **Who Can Activate**: Admin only
- **When to Use**: Buyer purchase issues, disputes
- **Reversibility**: Reversible (admin can open)

**3. System Shutdown (System Operator-Controlled)**:
- **What It Stops**: Entire system
- **Who Can Activate**: System operator only
- **When to Use**: Emergency, legal risk, security breach
- **Reversibility**: Reversible (system operator can restart)

---

### Kill-Switch Activation Process

**Activation Steps**:
1. **Decision**: Operator decides to activate kill-switch
2. **Activation**: Operator activates kill-switch (admin or system operator)
3. **Verification**: Operator verifies kill-switch is active
4. **Notification**: Operator notifies users (if possible)
5. **Documentation**: Operator documents kill-switch activation
6. **Investigation**: Operator investigates reason for activation
7. **Resolution**: Operator resolves issue
8. **Deactivation**: Operator deactivates kill-switch (after resolution)

**Activation Authority**:
- Pilot mode: Admin only
- Purchase window: Admin only
- System shutdown: System operator only

**Activation Documentation**:
- All kill-switch activations must be documented
- Documentation must include: reason, time, operator, scope
- Documentation must be stored in audit trail

**BLOCKED Notes**: Pilot mode enforcement status is UNKNOWN (BLOCKED). Kill-switch may not be effective if enforcement is not implemented.

---

### Kill-Switch Deactivation Process

**Deactivation Steps**:
1. **Verification**: Operator verifies issue is resolved
2. **Deactivation**: Operator deactivates kill-switch
3. **Verification**: Operator verifies kill-switch is deactivated
4. **Notification**: Operator notifies users (if possible)
5. **Documentation**: Operator documents kill-switch deactivation
6. **Monitoring**: Operator monitors system after deactivation

**Deactivation Authority**:
- Same as activation authority (admin or system operator)

**Deactivation Documentation**:
- All kill-switch deactivations must be documented
- Documentation must include: reason, time, operator, verification
- Documentation must be stored in audit trail

**BLOCKED Notes**: None

---

## 8. Degraded Mode Operation

### Degraded Mode Definition

**Degraded Mode**: System operates with reduced functionality due to:
- Invariant violations (some operations blocked)
- Threat materialization (some operations blocked)
- Infrastructure failures (some services unavailable)
- Kill-switch activation (some operations blocked)

**Degraded Mode Characteristics**:
- System is partially operational
- Some capabilities are disabled
- Some operations are blocked
- System is in safe state (no irreversible damage)

---

### Degraded Mode Operation

**Operation During Degraded Mode**:
1. **Detection**: System operator detects degraded mode condition
2. **Assessment**: System operator assesses degraded mode scope
3. **Notification**: System operator notifies users (if possible)
4. **Documentation**: System operator documents degraded mode
5. **Investigation**: System operator investigates cause
6. **Resolution**: System operator resolves cause
7. **Verification**: System operator verifies resolution
8. **Resumption**: System operator resumes normal operations

**Degraded Mode Constraints**:
- System must remain in safe state
- Kill-switches must remain accessible
- Observability must remain operational (if possible)
- Audit trail must remain intact

**BLOCKED Notes**: Some degraded mode conditions depend on BLOCKED capabilities (health checks, pilot mode enforcement). Detection may not be possible for BLOCKED conditions.

---

### Degraded Mode Examples

**Example 1: Wallet Operations Blocked (Balance Inconsistency)**
- **Condition**: Wallet ledger balance inconsistency detected
- **Impact**: Wallet operations blocked for affected trader
- **Operation**: System continues with other operations
- **Resolution**: System operator corrects balance, re-enables operations

**Example 2: Pilot Mode Activated**
- **Condition**: Admin activates pilot mode
- **Impact**: All money-moving mutations blocked
- **Operation**: System continues with read-only operations
- **Resolution**: Admin deactivates pilot mode after issue resolution

**Example 3: Infrastructure Failure**
- **Condition**: Vercel or Convex infrastructure fails
- **Impact**: System becomes unavailable
- **Operation**: System is completely unavailable
- **Resolution**: Infrastructure provider restores service, system operator verifies restoration

**BLOCKED Notes**: Some degraded mode conditions depend on BLOCKED capabilities. Operation may not be possible for BLOCKED conditions.

---

## 9. Incident Documentation Requirements

### Incident Documentation

**Required Fields**:
1. **Incident ID**: Unique identifier (format: `INC-YYYYMMDD-HHMMSS`)
2. **Incident Type**: Invariant violation, threat materialization, infrastructure failure, etc.
3. **Incident Severity**: Critical, High, Medium, Low
4. **Incident Start Time**: When incident was detected
5. **Incident End Time**: When incident was resolved
6. **Incident Duration**: Time from detection to resolution
7. **Incident Description**: What happened
8. **Incident Cause**: Root cause (if known)
9. **Incident Impact**: What was affected
10. **Incident Response**: What was done
11. **Incident Resolution**: How it was resolved
12. **Incident Prevention**: How to prevent recurrence
13. **Operator**: System operator name and role
14. **Documentation Date**: When incident was documented

**Documentation Storage**:
- Incident records must be stored in version control (Git)
- Incident records must be committed to repository
- Incident records must be immutable (cannot be modified, only new records can be created)

**Documentation Access**:
- Incident records are readable by system operator
- Incident records are readable by admin (if required)
- Incident records are not readable by users

**BLOCKED Notes**: Incident documentation mechanism may not be implemented. Records must be stored in version control (Git) as minimum.

---

### Incident Analysis

**Analysis Requirements**:
- All incidents must be analyzed
- Analysis must identify root causes
- Analysis must identify prevention strategies
- Analysis must be documented

**Analysis Frequency**:
- Critical incidents: Immediate analysis
- High severity incidents: Analysis within 24 hours
- Medium severity incidents: Analysis within 1 week
- Low severity incidents: Analysis within 1 month

**Analysis Documentation**:
- Analysis must be documented
- Analysis must be stored in incident record
- Analysis must be reviewed by system operator

**BLOCKED Notes**: None

---

## 10. Operator Burnout and Single-Human Risk Mitigation

### Operator Burnout Risk

**Risk**: System operator (single human) experiences burnout due to:
- Continuous monitoring requirements (24/7)
- High alert volume
- High incident frequency
- High responsibility burden
- Limited support

**Impact**:
- Operator unavailability
- Delayed response times
- Missed alerts
- System degradation
- System failure

**Mitigation Strategies**:
1. **Alert Threshold Calibration**: Adjust alert thresholds to reduce false positives
2. **Automated Monitoring**: Use automated monitoring (within documented authority)
3. **Incident Pattern Analysis**: Analyze incident patterns to reduce recurrence
4. **Operator Availability Limits**: Define operator availability limits (not 24/7)
5. **Operator Communication**: Communicate operator availability to users
6. **Operator Backup Plan**: Define operator backup plan (if possible)

**BLOCKED Notes**: Operator backup plan may not be possible (single human). Operator availability limits may not be feasible (system requires 24/7 operation).

---

### Single-Human Risk Mitigation

**Risk**: System operator (single human) is unavailable due to:
- Illness
- Vacation
- Emergency
- Burnout
- Death

**Impact**:
- No operational authority
- No alert response
- No incident handling
- System degradation
- System failure

**Mitigation Strategies**:
1. **Alert Persistence**: Alerts must be persistent (not lost if operator is unavailable)
2. **System Fail-Safe**: System must fail safe if operator is unavailable
3. **Kill-Switch Accessibility**: Kill-switches must remain accessible (if possible)
4. **Documentation**: All operational procedures must be documented
5. **Operator Backup Plan**: Define operator backup plan (if possible)
6. **Emergency Contacts**: Define emergency contacts (if possible)

**BLOCKED Notes**: Operator backup plan may not be possible (single human). Emergency contacts may not be available. System fail-safe depends on kill-switch effectiveness (BLOCKED: pilot mode enforcement status UNKNOWN).

---

### Operator Availability Limits

**Availability Limits**:
- Operator is not available 24/7 (human limitation)
- Operator availability must be defined
- Operator unavailability must be communicated
- System must fail safe during operator unavailability

**Availability Communication**:
- Operator must communicate availability to users (if possible)
- Operator must communicate unavailability to users (if possible)
- Operator must document availability schedule

**BLOCKED Notes**: Operator availability limits may not be feasible (system requires 24/7 operation). Availability communication may not be possible.

---

## 11. Final Operational Guarantees

### Operational Guarantees

**1. Continuous Monitoring**:
- System is monitored continuously (24/7)
- All invariants are monitored (or BLOCKED)
- All threats are monitored (or BLOCKED)
- All critical metrics are monitored (or BLOCKED)

**2. Alert Response**:
- All alerts have an owner (system operator)
- All alerts have an action (investigation, correction, or escalation)
- All alerts are responded to (within defined response times)
- No alerts are ignored or deferred indefinitely

**3. Invariant Violation Handling**:
- All invariant violations are detected (or BLOCKED)
- All invariant violations are investigated
- All invariant violations are corrected
- All invariant violations are documented

**4. Threat Materialization Response**:
- All threat materializations are detected (or BLOCKED)
- All threat materializations are investigated
- All threat materializations are mitigated
- All threat materializations are documented

**5. Kill-Switch Accessibility**:
- All kill-switches are accessible (or BLOCKED)
- All kill-switches are documented
- All kill-switch activations are documented
- All kill-switch deactivations are documented

**6. Incident Documentation**:
- All incidents are documented
- All incident responses are documented
- All incident resolutions are documented
- All incident analyses are documented

**7. Operator Authority**:
- System operator has full operational authority
- System operator can override automated actions
- System operator can activate kill-switches
- System operator can shutdown system

**8. System Fail-Safe**:
- System fails safe if operator is unavailable
- System fails safe if monitoring fails
- System fails safe if invariants are violated
- Safe state means: no irreversible damage, kill-switches accessible

**BLOCKED Notes**: Some operational guarantees depend on BLOCKED capabilities (health checks, pilot mode enforcement, backup/restore). Guarantees are partial.

---

## Final Check

### How the System Is Monitored Continuously

**Verified**: System is monitored continuously:
- Real-time monitoring for critical metrics (wallet ledger balance, exposure levels)
- Continuous monitoring for system health (availability, connectivity)
- Periodic monitoring for non-critical metrics (UTID generation rate, role changes)
- All 25 invariants are monitored (or BLOCKED)
- All 24 threats are monitored (or BLOCKED)
- All 11 critical metrics are monitored (or BLOCKED)

**BLOCKED Notes**: Some monitoring capabilities are BLOCKED (health check endpoints, pilot mode enforcement observability). Monitoring coverage is partial.

---

### How the Operator Is Alerted

**Verified**: Operator is alerted:
- Alert system delivers alerts to operator promptly
- Alerts are persistent (not lost if operator is unavailable)
- Alerts are classified by severity (Critical, High, Medium, Low)
- Alerts have explicit response times (5 minutes, 30 minutes, 2 hours, 24 hours)
- All 9 alerts from OBSERVABILITY_MODEL.md are configured

**BLOCKED Notes**: Alert system failure must be detected (if possible). Alert persistence depends on alert system capabilities.

---

### How Violations Are Handled

**Verified**: Violations are handled:
- All invariant violations trigger alerts
- All alerts have response playbooks
- All violations are investigated by system operator
- All violations are corrected by system operator
- All violations are documented

**BLOCKED Notes**: Some violations depend on BLOCKED capabilities (delivery verification, pilot mode enforcement). Response may not be possible for BLOCKED violations.

---

### How Kill-Switches Are Used During Operations

**Verified**: Kill-switches are used during operations:
- All 3 kill-switches are accessible (or BLOCKED)
- Kill-switch activation process is documented
- Kill-switch deactivation process is documented
- Kill-switch activations are documented
- Kill-switch deactivations are documented

**BLOCKED Notes**: Pilot mode enforcement status is UNKNOWN (BLOCKED). Kill-switch may not be effective if enforcement is not implemented.

---

### How Incidents Are Recorded

**Verified**: Incidents are recorded:
- All incidents are documented (13 required fields)
- Incident records are stored in version control (Git)
- Incident records are immutable
- Incident analyses are documented
- Incident patterns are analyzed

**BLOCKED Notes**: Incident documentation mechanism may not be implemented. Records must be stored in version control (Git) as minimum.

---

### How the System Fails Safe If the Operator Is Unavailable

**Verified**: System fails safe if operator is unavailable:
- System blocks affected operations when invariants are violated
- System blocks affected operations when threats materialize
- Kill-switches remain accessible (if possible)
- Alerts are persistent (not lost if operator is unavailable)
- System remains in safe state (no irreversible damage)

**BLOCKED Notes**: System fail-safe depends on kill-switch effectiveness (BLOCKED: pilot mode enforcement status UNKNOWN). Operator backup plan may not be possible (single human).

---

### Why This Document Prevents Silent Degradation

**Verified**: This document prevents silent degradation:
- Continuous monitoring detects degradation (not event-based)
- All invariants are monitored (no silent violations)
- All threats are monitored (no silent materialization)
- All alerts have owners and actions (no silent alerts)
- Silence is a failure state (no alerts does not mean no problems)
- Partial visibility is unacceptable (all critical metrics must be monitored)

**BLOCKED Notes**: Some monitoring capabilities are BLOCKED. Silent degradation may occur for BLOCKED capabilities.

---

**CURRENT OPERATIONAL STATUS**: **NOT OPERATIONAL**

**System is not operational until activation is completed (see PRODUCTION_ACTIVATION.md).**

---

*This document must be updated when operational procedures change, BLOCKED items are unblocked, or new operational capabilities are implemented. No assumptions. Only truth.*
