---
name: resolve-issue-with-tests
description: 'End-to-end issue resolution for Farm2Market with automatic test generation, validation, and controlled deployment. Use when: diagnosing bugs, generating tests, validating fixes before deployment. Requires explicit approval before deployment.'
argument-hint: 'Describe the issue (e.g., "Insights page hydration error", "Query returns empty data")'
user-invocable: true
disable-model-invocation: false
---

# Farm2Market Issue Resolution with Tests

## When to Use

- Diagnose bugs or unexpected behavior in Farm2Market
- Generate and validate tests for proposed fixes
- Ensure system integrity before deployment
- Document root causes and safety reasoning
- Deploy fixes with confidence

**Do NOT use for**: General code questions, performance optimization without issue context, or experimental changes.

## Overview

This skill walks through a **16-step diagnostic, test, and deployment pipeline**:

1. **Issue Intake** — Classify the problem
2. **Debug (Full Diagnostic)** — Check all layers
3. **Root Cause Analysis** — Identify exact source
4. **Fix Proposal** — Validate minimal changes
5. **Safety Check** — Flag critical systems
6. **Output (Structured)** — Document diagnosis
7. **Test Generation** — Auto-generate test cases
8. **Test Implementation** — Write test code
9. **Implementation (Approval Only)** — Apply fix
10. **Test Execution** — Validate tests pass
11. **Manual Validation** — Smoke test system
12. **Pre-Deploy Safety Check** — Final verification
13. **Commit Preparation** — Generate commit message
14. **Deployment Control** — Confirm readiness
15. **Safe Deployment** — Push to Git + deploy
16. **Post-Deploy Verification** — Confirm live system

---

## Procedure

### Step 1: Issue Intake

**Goal**: Understand and classify the issue.

**Actions**:
1. Listen to issue description carefully
2. Classify by **category** (select one):
   - Frontend (Next.js rendering, hydration, state)
   - Backend (Convex queries, functions, arguments)
   - Data layer (schema, integrity, missing records)
   - Integration (frontend ↔ backend wiring, hooks)

3. Identify **affected system** (select one):
   - Analytics dashboard
   - Onboarding flow
   - QR code scanning
   - Payments (CRITICAL)
   - FarmCoin (CRITICAL)
   - Input tracking (CRITICAL)
   - Farmer profiles (CRITICAL)
   - Other

4. Ask clarifying questions if needed:
   - Reproduction steps?
   - Error messages?
   - Frequency (always/intermittent)?
   - Which users/communities affected?

---

### Step 2: Debug (Full Diagnostic)

**Goal**: Perform structured investigation across all layers.

#### Frontend Debugging (Next.js)
- Check browser console for React errors
- Look for hydration mismatches (SSR vs client)
- Verify state initialization (React hooks, context)
- Inspect component props and lifecycle

#### Backend Debugging (Convex)
- Examine query execution flow
- Validate query arguments match expected schema
- Check returned data shape
- Review function side effects
- Verify permission/authorization checks

#### Data Layer Debugging
- Verify data exists in database (schema, fields)
- Check for stale or cached data
- Identify any schema mismatches

#### Integration Debugging
- Verify hooks wired correctly (`useQuery`, `useOfflineQuery`)
- Check argument passing from component to hook
- Validate async data flow (loading, error, data states)
- Trace behavior under offline/online conditions

---

### Step 3: Root Cause Analysis

**Goal**: Identify the most likely root cause with evidence.

**Actions**:
1. Synthesize findings from Step 2 across all layers
2. Identify root cause:
   - Exact file(s), function(s), query(ies)
   - Why the bug manifests
   - Link evidence: logs, code, data snapshots
3. If uncertain: Rank top 2–3 causes by likelihood
4. Validate consistency:
   - Does root cause explain symptoms?
   - Are logs consistent with code?
   - Does data shape match expectations?

---

### Step 4: Fix Proposal

**Goal**: Validate root cause and propose minimal changes.

**Actions**:
1. Re-validate the root cause
2. Identify exact files to modify
3. Propose minimal, safe changes:
   - Only modify what's necessary
   - Preserve existing logic
   - Don't refactor unrelated code
4. Ensure compliance with `/ai/governance/farm2market_rules.md`
5. Review for unintended side effects

---

### Step 5: Safety Check

**Goal**: Flag critical systems and determine approval requirement.

**Ask**: Is the affected system **critical**?

**Critical systems**:
- Member onboarding
- QR code scanning
- Farmcoin minting
- Pesapal payments
- Input tracking forms
- Farmer profiles

**If YES (critical system)**:
- → **MUST require explicit user approval before implementation**
- → Explain why approval is needed

**Additional safety checks**:
- Does fix affect Convex queries? → Verify query logic
- Does fix change data shape? → Ensure no breaking changes
- Does fix affect caching? → Explicitly test cache behavior

---

### Step 6: Proposed Fix Output

**Goal**: Deliver a clear, actionable diagnosis.

**Return**:

#### A. Issue Summary
- Problem statement (1–2 sentences)
- Affected system(s)
- Impact severity

#### B. Root Cause
- Confirmed root cause OR ranked possibilities
- Evidence (logs, code references, data observations)

#### C. Files Affected
- Exact file paths
- Function or component names
- Query names (if Convex)

#### D. Proposed Fix
- Clear explanation of the change
- Why it resolves the root cause
- Code snippets or pseudocode

#### E. Why This Fix Is Safe
- No new dependencies introduced
- No breaking changes to inputs/outputs
- Backward compatibility preserved
- Minimal scope

#### F. Risk Level
- **Low**: Isolated change, well-tested path, simple logic
- **Medium**: Affects data flow, multiple components
- **High**: Critical system, Convex query change, data schema impact

#### G. Requires Approval
- **YES** (critical system OR high risk) → User must explicitly approve
- **NO** (low risk, non-critical) → Ready for testing

---

### Step 7: Test Generation (AUTO)

**Goal**: Generate comprehensive test cases.

**For every fix, generate tests covering**:

#### 1. Core Functionality
- Expected behavior works after fix

#### 2. Failure Case
- Original bug does not occur

#### 3. Edge Cases
- null/undefined values
- Empty datasets
- Invalid inputs
- Boundary conditions

#### 4. Data Integrity (if applicable)
- Correct data shape returned
- No data corruption
- All expected fields present

#### 5. Integration (if applicable)
- Frontend receives correct data
- Convex query executes correctly
- Cache behavior validated

**Test Types**:

| Type | Coverage |
|------|----------|
| Frontend unit tests | Component render, state changes, prop handling |
| Backend unit tests | Query arguments, returned data shape |
| Integration tests | Frontend ↔ Backend wiring, hooks |
| Data integrity tests | Schema validation, data transformation |

---

### Step 8: Test Implementation

**Goal**: Provide executable test code.

**Actions**:
1. Provide complete test code
2. Place in appropriate test files:
   - Frontend: `__tests__/components/` or `.test.tsx` colocated
   - Backend: `convex/__tests__/` or `.test.ts` colocated
3. Follow existing test structure (if any)
4. Use clear test names describing what's being tested

**If no test system exists**:
- Create lightweight test examples
- Simulate test scenarios with pseudocode
- Document expected behavior

**Test Structure** (example):

```typescript
describe("Insights Page Hydration Fix", () => {
  it("should render loading state during hydration", () => {
    // Arrange
    // Act
    // Assert
  });

  it("should not throw hydration mismatch error", () => {
    // Verify Suspense boundary prevents error
  });

  it("should show insights after data loads", () => {
    // Verify data renders correctly
  });

  it("should handle empty insights array", () => {
    // Verify edge case
  });
});
```

---

### Step 9: Implementation (ONLY If Approved)

**Gate**: Never implement without user approval.

**When user says**: "approve", "implement", or "proceed"

**Then**:
1. Apply fix code changes
2. Add test code
3. Keep changes minimal and focused
4. Follow Farm2Market governance rules

---

### Step 10: Test Execution

**Goal**: Validate that all tests pass.

**Before any commit**:
1. Run all tests
2. Validate:
   - All tests pass
   - No runtime errors
   - Coverage adequate

**If tests FAIL**:
- → **STOP**
- → Report failure details
- → Do not proceed to commit
- → Fix tests or code as needed

**If tests PASS**:
- → Continue to Step 11

---

### Step 11: Manual Validation (If No Tests)

**Goal**: Simulate system behavior.

**Validate**:
1. Component/page loads correctly
2. Convex queries execute and return data
3. UI renders without errors
4. State transitions work as expected
5. Edge cases handled gracefully

---

### Step 12: Pre-Deploy Safety Check

**Goal**: Final verification before deployment.

**Verify**:

#### A. Scope
- Only intended files changed
- No accidental modifications

#### B. Critical Systems
- Not affected by this change
- No breaking changes to protected flows

#### C. Data Integrity
- Data structure correct
- No corruption risk
- Backward compatible

#### D. Performance
- No new performance regressions
- Query optimization (if applicable)
- Cache behavior acceptable

#### E. Convex Queries (if affected)
- Query logic validated
- Argument shape correct
- Return data structure correct

---

### Step 13: Commit Preparation

**Goal**: Generate professional commit message.

**Format**:

```
type(scope): short description

- root cause brief explanation
- fix summary
- safety reasoning (if non-obvious)

Risk: [Low | Medium | High]
System: [analytics | onboarding | payments | etc]
```

**Types**:
- `fix`: Bug fix (for this skill, usually the type)
- `refactor`: Code reorganization
- `test`: Test additions
- `chore`: Maintenance

**Example**:

```
fix(insights-page): resolve hydration mismatch using Suspense boundary

- Root cause: useSearchParams() hook executes on server (null) vs client (actual params)
  causing hydration mismatch error on every page load
- Fix: Wrap component in Suspense boundary to defer hook execution to client-only context
- Safety: Non-critical system, UI-only change, no query modifications

Risk: Low
System: Analytics
```

---

### Step 14: Deployment Control

**Goal**: Confirm readiness and wait for approval.

**Return**:

```
READY FOR DEPLOYMENT: ✅ YES / ❌ NO

Summary of changes:
- [File modified]
- [Change description]
- [Test coverage]

Tests passed: ✅ All pass
Safety check: ✅ Complete
Approval status: [Waiting | Approved]

NEXT: Wait for user to say "push" 
```

**If NOT ready**:
- Explain blocking issues
- Do not proceed

**If ready**:
- Summarize changes
- Confirm tests passed
- Wait for explicit "push" command

---

### Step 15: Safe Deployment (AFTER Approval)

**Gate**: Only execute if user says "push" or "deploy".

**Actions**:
1. Commit changes to Git branch
2. If Convex queries affected: Deploy Convex
3. Push to remote Git
4. If web app affected: Trigger Vercel deployment
5. Confirm deployment success

---

### Step 16: Post-Deploy Verification

**Goal**: Confirm live system works.

**Validate**:
1. Feature/page accessible in production
2. Convex logs show no errors
3. UI renders correctly
4. Queries return correct data
5. No new errors in monitoring/logging
6. Performance acceptable

**If issues found**:
- → Rollback if necessary
- → Report findings
- → Prepare rollback plan

---

## Critical Rules

- **NEVER auto-implement without approval** — Always wait for explicit user confirmation
- **NEVER modify critical systems without confirmation** — Onboarding, QR, farmcoin, payments, input tracking
- **ALWAYS follow governance rules** — Reference `/ai/governance/farm2market_rules.md`
- **ALWAYS prioritize stability over speed** — When uncertain, ask or propose lower-risk alternatives
- **NEVER deploy without tests passing** — If tests fail, stop and investigate
- **NEVER skip Post-Deploy Verification** — Confirm live system works

---

## Special Verification Rules

### If issue involves Hydration Mismatch
- Verify query execution timing (server vs client)
- Check for stale data on client initialization
- Ensure cache keys are stable and consistent

### If issue involves State Initialization
- Verify React hooks run in correct order
- Check Convex query arguments don't change unexpectedly
- Ensure useEffect dependencies are correct
- Validate initial state matches expected type

### If issue involves Convex Queries
- Check argument validation at query entry
- Verify query execution completes before rendering
- Ensure returned data matches schema
- Test with both online and offline scenarios

### If issue involves Analytics Dashboards
- Verify aggregation queries execute correctly
- Check cache invalidation on data changes
- Ensure time-based queries use correct timezone
- Validate data consistency across layers

---

## When Approval Is Required

**Approval is MANDATORY** if:
1. Fix affects critical system (onboarding, QR, farmcoin, payments)
2. Fix involves schema changes or data migration
3. Fix modifies Convex query logic significantly
4. Risk level is HIGH
5. Fix affects multiple systems
6. Tests do not cover all scenarios

**Approval is NOT required** if:
1. Fix is LOW risk
2. System is non-critical (analytics, UI polish)
3. Change is purely frontend rendering
4. Tests provide good coverage
5. No data integrity impact

---

## Resources

- **Farm2Market Governance**: `/ai/governance/farm2market_rules.md`
- **Architecture Overview**: `architecture.md`
- **Agents**: Farm2Market Debug Agent, Farm2Market Fix Agent

---

## Example Workflow

```
User: "Insights page shows hydration error on every load"

Step 1: Intake → Frontend category, Analytics system, all communities
Step 2: Debug → Check console, hooks, Suspense boundaries
Step 3: RCA → Root cause: useSearchParams() unavailable on server
Step 4: Fix → Wrap in Suspense boundary (minimal change)
Step 5: Safety → Non-critical, LOW risk, no approval needed
Step 6: Output → Structured diagnosis document
Step 7-8: Tests → Generate and implement hydration tests
Step 9: Implementation → Apply fix (user approves)
Step 10: Execution → All tests pass ✅
Step 11: Validation → Manual smoke test successful
Step 12: Safety → Pre-deploy check complete
Step 13: Commit → "fix(insights-page): resolve hydration mismatch..."
Step 14: Control → "READY FOR DEPLOYMENT: YES"
Step 15: Deploy → Push to Git (user says "push")
Step 16: Verify → Confirm live system loads without errors
```

---

## Next Steps

After mastering this skill:
- Combine with **Farm2Market Refactor Agent** for code quality improvements
- Use **Farm2Market Debug Agent** for diagnosis-only (no changes)
- Create custom test utilities for domain-specific scenarios
