---
name: debug-mobile-crash
description: 'Diagnose Android-only Farm2Market mobile crashes (React Native) with structured difference analysis, log analysis, crash classification, and root cause reporting. Use when crashes occur only on mobile and not on web.'
argument-hint: 'Describe the crash symptoms, logs, or affected screen (e.g., "Insights screen crashes on Android after login").'
user-invocable: true
disable-model-invocation: false
---

# Farm2Market Mobile Crash Debugging

## When to Use

- Android app crash that does not reproduce on web
- React Native JavaScript exception or native crash pattern
- Environment-specific behavior in mobile compared to browser

## Overview

This skill provides a step-by-step template for diagnosing mobile-only crashes:

1. Difference analysis (mobile vs web)
2. Log analysis (adb logcat, ReactNativeJS, fatal exception)
3. Crash type classification
4. Insights screen focus (if applicable)
5. Root cause detail
6. Structured output report

**Constraints**
- Do not implement a fix
- Rely on logs + code analysis
- Follow `/ai/governance/farm2market_rules.md`

---

## Procedure

### Step 1: Difference Analysis

1. Reproduce both mobile and web scenarios.
2. Identify platform-specific code paths:
   - React Native APIs (native modules, platform checks)
   - Conditional imports (`Platform.OS === 'android'`)
3. Compare environment differences:
   - OS version, device architecture
   - Network / debug mode vs production
4. Check rendering differences:
   - RN component trees vs web markup
   - Native view wrappers and layout behavior

---

### Step 2: Log Analysis

1. Collect error logs:
   - `adb logcat` output
   - React Native JS stack trace and error messages
   - Android crash report / fatal exception details
2. Look for:
   - undefined/null property access
   - JSON parsing problems (`JSON.parse` failures)
   - async timing/Promise resolution issues
   - memory pressure / out-of-memory errors

---

### Step 3: Crash Type Classification

Classify into one of:
- JS runtime error
- Native crash (JNI, NDK, native module)
- Data parsing failure
- API response mismatch
- Rendering failure

Use this classification to shape root cause and prioritized fix.

---

### Step 4: Insights Page Focus

When the crash is Insights-related, inspect:
- Convex data query results and null handling
- Component tree and render branches for missing data
- Defensive checks on arrays/objects
- Platform-specific behavior in Insights components

---

### Step 5: Root Cause

Provide:
- exact failure point in code (file/component/function)
- explicit reason mobile fails but web works
- required mobile-specific context (e.g., `Platform.select`, native modules)

---

### Step 6: Output

Return a structured report with:
A. Crash Type
B. Error Message (from logs)
C. File / Component
D. Root Cause
E. Why Web Works But Mobile Fails
F. Suggested Fix (analysis-only, no code change)

---

## Example

Issue: Android app crashes on Insights list load; web works.
- Step 1: Mobile path uses native `FastList` component; web path uses browser list.
- Step 2: `adb logcat` shows `TypeError: Cannot read property 'items' of undefined` in `InsightsFeed.tsx`.
- Step 3: JS runtime error.
- Step 4: Data parsing from Convex `getInsights` may return `null` on mobile path.
- Step 5: Root cause: missing null guard on `data.items` in mobile render path.
- Step 6: Output with all fields.
