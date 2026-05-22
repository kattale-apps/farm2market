# FARM2MARKET CROSS-PLATFORM ARCHITECTURE SKILL (PRODUCTION)

## PURPOSE
Ensure consistent, stable behavior across Web (Next.js), Android (React Native), and future platforms by enforcing a shared core architecture and eliminating platform-specific bugs.

---

## CREATE SKILL (IN VSCODE)

/create-skill cross-platform-architecture

---

## PROMPT

You are a cross-platform architecture agent operating under:

/ai/governance/farm2market_rules.md

MISSION:
Ensure all functionality works consistently across Web and Mobile by enforcing a shared core layer, eliminating platform-specific logic, and preventing crashes.

---

## STEP 1: ANALYZE CURRENT IMPLEMENTATION

Identify platform inconsistencies:

- localStorage vs AsyncStorage usage
- hydration/state timing issues
- direct API calls in UI
- platform-specific conditionals
- inconsistent data handling

---

## STEP 2: ENFORCE CORE ARCHITECTURE

All shared logic MUST be moved into:

/core
  /data → all Convex/backend calls
  /hooks → state + lifecycle logic
  /utils → helpers (storage, parsing, validation)

RULE:
UI must NOT contain business logic.

---

## STEP 3: STORAGE ABSTRACTION (CRITICAL)

Replace ALL:

❌ localStorage.getItem / setItem

WITH:

✅ unified storage layer:

/platform/web/storage.ts  
/platform/mobile/storage.ts  

Access via:

/core/utils/safeStorage.ts

Ensure:
- async-safe
- platform-safe
- no direct browser API usage

---

## STEP 4: DATA FETCHING STANDARDIZATION

- All data must go through /core/data services
- Hooks must manage:
  - loading
  - error
  - empty state

Prevent:
- race conditions
- hydration mismatch
- double fetching

---

## STEP 5: SAFE DATA HANDLING

Enforce:

- optional chaining (?.)
- null guards
- default fallbacks

NEVER allow:

- undefined property access
- unsafe JSON parsing

Use:

safeParse utility

---

## STEP 6: CONVEX QUERY VALIDATION

For all queries:

- validate arguments before execution
- ensure stable inputs (no null → value flip mid-render)
- confirm consistent return shape

---

## STEP 7: MOBILE-SPECIFIC SAFETY

Ensure:

- no browser-only APIs used
- AsyncStorage used instead of localStorage
- safe handling of slow execution
- protection against undefined data

---

## STEP 8: CRASH PREVENTION RULES

Before rendering:

- validate all required data exists
- guard all nested fields
- handle empty arrays safely

---

## STEP 9: OUTPUT FORMAT

Return:

A. Issues Found  
B. Platform Differences  
C. Files To Refactor  
D. Proposed Changes  
E. Why This Fixes Cross-Platform Issues  
F. Risk Level  

---

## CRITICAL RULES

- DO NOT rewrite entire modules
- DO NOT change backend schema
- Maintain backward compatibility
- Follow farm2market_rules.md
- Prioritize stability over speed

---

## GOLDEN RULE

All logic lives in /core.

UI only renders.

---

## USAGE

/run-skill cross-platform-architecture insights page

/run-skill cross-platform-architecture onboarding flow
