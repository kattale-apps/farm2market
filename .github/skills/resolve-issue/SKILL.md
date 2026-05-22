---
name: resolve-issue
description: 'End-to-end issue resolution for Farm2Market. Use when: diagnosing frontend/backend problems, validating root causes, proposing safe fixes. Includes structured debugging, root cause analysis, and Fix Agent handoff—never auto-implements without explicit approval.'
argument-hint: 'Describe the issue or system affected (e.g., "Insights page not loading", "Analytics query fails")'
user-invocable: true
disable-model-invocation: false
---

# Farm2Market Issue Resolution

## When to Use

- Diagnosing bugs or unexpected behavior in Farm2Market (frontend, backend, data, integration)
- Validating root causes with structured analysis
- Preparing fixes for safe implementation via the **Fix Agent**
- Debugging critical systems (onboarding, QR, farmcoin, payments, input tracking)

**Do NOT use**: For general code questions, performance optimization without issue context, or MCP configuration.

## Overview

This skill walks through an **8-step diagnostic and fix proposal pipeline**:

1. **Issue Intake** — Classify the problem
2. **Debug (Full Diagnostic)** — Check frontend, backend, data, integration points
3. **Root Cause Analysis** — Identify exact files, functions, queries
4. **Fix Agent Handoff** — Validate and propose minimal changes
5. **Safety Check** — Flag critical systems and require approval
6. **Output (Strict Format)** — Deliver a validated diagnosis
7. **Implementation (Approval Only)** — Apply fix if approved
8. **Verification** — Confirm resolution and check for regressions

## Procedure

### Step 1: Issue Intake

**Goal**: Understand the issue and classify its scope.

1. Listen to the issue description carefully
2. Classify by **category**:
   - Frontend (Next.js rendering, hydration, state)
   - Backend (Convex queries, functions, arguments)
   - Data layer (schema, integrity, missing records)
   - Integration (frontend ↔ backend wiring, hook behavior)
3. Identify **affected system**:
   - Analytics dashboard
   - Onboarding flow
   - QR code scanning
   - Payments
   - FarmCoin
   - Input tracking
   - Farmer profiles
   - Other
4. Ask clarifying questions if needed (reproduction steps, error messages, frequency)

---

### Step 2: Debug (Full Diagnostic)

**Goal**: Perform structured investigation across all layers.

#### Frontend Debugging (Next.js)
- Check rendering errors in browser console
- Look for hydration mismatches (SSR vs client)
- Verify state initialization (React hooks, context)
- Inspect component props and lifecycle

#### Backend Debugging (Convex)
- Examine query execution flow
- Validate query arguments match expected schema
- Check returned data shape
- Review function side effects
- Test query directly if possible

#### Data Layer Debugging
- Verify data exists in database (correct schema, fields populated)
- Check for stale or cached data
- Identify any schema mismatches between frontend expectations and actual data

#### Integration Debugging
- Verify hooks are wired correctly (`useQuery`, `useOfflineQuery`, etc.)
- Check argument passing from component to hook
- Validate async data flow (loading, error, data states)
- Trace Convex hook behavior under offline/online conditions

---

### Step 3: Root Cause Analysis

**Goal**: Identify the most likely root cause with evidence.

1. **Synthesize findings** from Step 2 across all layers
2. **Identify root cause**:
   - Provide exact file(s), function(s), query(ies) involved
   - Explain how the bug manifests
   - Link evidence: logs, code behavior, data snapshots
3. **If uncertain**: Rank top 2–3 possible causes by likelihood
4. **Validate consistency**:
   - Does the root cause explain the symptoms?
   - Are logs consistent with the code?
   - Does the data shape match expectations?

---

### Step 4: Fix Agent Handoff (Simulated)

**Goal**: Transition to fix validation and proposal.

Act as the **Farm2Market Fix Agent**:

1. Re-validate the root cause
2. Identify **exact files to modify**
3. Propose **minimal, safe changes**:
   - Only modify what's necessary
   - Preserve existing logic
   - Don't refactor unrelated code
4. Ensure compliance with `/ai/governance/farm2market_rules.md`
5. Review for unintended side effects

---

### Step 5: Safety Check

**Goal**: Flag critical systems and determine if approval is required.

**Ask**: Is the affected system **critical**?

- Critical systems: onboarding, QR scanning, farmcoin, payments, input tracking, farmer profiles
- Non-critical: UI polish, logging, internal utilities

**If YES (critical system)**:
- → **MUST require explicit user approval before implementation**
- → Explain why approval is needed

**Additional safety checks**:
- Does fix affect Convex queries? → Verify query logic
- Does fix change data shape? → Ensure no breaking changes
- Does fix affect caching? → Explicitly test cache behavior

---

### Step 6: Output (Strict Format)

**Goal**: Deliver a clear, actionable diagnosis document.

Return a structured report with these sections:

#### A. Issue Summary
- Problem statement (1–2 sentences)
- Affected system(s)
- Impact (errors, broken features, data loss, etc.)

#### B. Root Cause
- Confirmed root cause OR ranked possibilities (if uncertain)
- Evidence (logs, code references, data observations)

#### C. Files Affected
- Exact file paths
- Function or component names
- Query names (if Convex)

#### D. Proposed Fix
- Clear explanation of the change
- Why it resolves the root cause
- Include code snippets or pseudocode

#### E. Why This Fix Is Safe
- Does not introduce new dependencies
- Does not break existing inputs/outputs
- Preserves backward compatibility (if applicable)
- Minimal scope

#### F. Risk Level
- **Low**: Isolated change, well-tested path, simple logic
- **Medium**: Affects data flow, multiple components, or integration logic
- **High**: Critical system, Convex query change, data schema impact, or affects multiple features

#### G. Requires Approval
- **YES** (critical system or high risk) → User must explicitly approve
- **NO** (low risk, non-critical system) → Ready for implementation upon request

#### H. Next Action
- "Approve to implement" (if approval required)
- "Needs clarification" (if diagnosis incomplete)
- "Ready to implement" (if low risk and no approval needed)

---

### Step 7: Implementation (ONLY If Approved)

**Goal**: Apply the fix safely after approval.

**Gate**: Never implement without user approval (or explicit "approve" / "implement" command).

**When approved**:
1. Apply fix using minimal, safe changes
2. Do not modify unrelated logic
3. Follow Farm2Market governance rules
4. Update affected tests (if applicable)

---

### Step 8: Verification

**Goal**: Confirm the fix resolves the issue and introduce no regressions.

After implementation:

1. **Confirm resolution**: Issue is gone
2. **Check UI rendering**: No new visual errors
3. **Check Convex queries**: Queries still execute correctly
4. **Check data integrity**: Data shape is correct
5. **Check caching**: Offline behavior works (if applicable)
6. **Look for regressions**:
   - Related features still working?
   - No unintended behavior changes?

---

## Critical Rules

- **NEVER auto-implement without approval** — Always wait for explicit user confirmation
- **NEVER modify critical systems without confirmation** — Onboarding, QR, farmcoin, payments, input tracking
- **ALWAYS follow governance rules** — Reference `/ai/governance/farm2market_rules.md`
- **ALWAYS prioritize stability over speed** — When uncertain, ask or propose lower-risk alternatives

---

## Special Verification Rules

If the issue involves any of these areas, extra care is needed:

### Hydration Mismatches
- Verify query execution timing (server vs client)
- Check for stale data on client initialization
- Ensure cache keys are stable

### State Initialization
- Verify React hooks run in correct order
- Check Convex query arguments don't change unexpectedly
- Ensure useEffect dependencies are correct

### Convex Queries
- Check argument validation
- Verify query execution completes before rendering
- Ensure returned data matches schema

### Analytics Dashboards
- Verify aggregation queries execute correctly
- Check cache invalidation on data changes
- Ensure time-based queries use correct timezone

---

## Resources

- **Farm2Market Governance**: `/ai/governance/farm2market_rules.md`
- **Agents**: Farm2Market Debug Agent, Farm2Market Fix Agent, Farm2Market Refactor Agent
- **Architecture**: Check `architecture.md` for system overview

---

## Example Workflows

### Workflow A: Frontend Rendering Bug
```
Issue: "Insights page shows blank content"

Step 1: Intake → Frontend category, Analytics system
Step 2: Debug → Check console errors, hydration, component rendering
Step 3: RCA → Found: query returns empty array, but component expects object
Step 4: Fix Agent → Change data destructuring or add null check
Step 5: Safety → Non-critical, low risk
Step 6–8: Output → Propose fix, implement, verify
```

### Workflow B: Backend Query Failure
```
Issue: "Payment query fails with 'Unauthorized'"

Step 1: Intake → Backend category, Payments system (CRITICAL)
Step 2: Debug → Check Convex permissions, query arguments, logs
Step 3: RCA → User role not passed to query correctly
Step 4: Fix Agent → Add role validation or fix argument passing
Step 5: Safety → CRITICAL SYSTEM → REQUIRE APPROVAL
Step 6: Output → High risk, must get explicit go-ahead
Step 7–8: Implementation & Verification → Only if approved
```

---

## Related Agents & Skills

- **Farm2Market Debug Agent** — For diagnosis-only (no changes)
- **Farm2Market Fix Agent** — For validated fix implementation
- **Farm2Market Refactor Agent** — For code quality improvements (safe, incremental)
