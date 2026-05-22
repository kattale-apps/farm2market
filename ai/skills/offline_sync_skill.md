# FARM2MARKET OFFLINE-FIRST SYNC & CONFLICT RESOLUTION SKILL

## PURPOSE
Enable Farm2Market to function reliably in low-connectivity environments by implementing offline-first data handling, synchronization, and conflict resolution.

---

## PROMPT (USE IN VSCODE AGENT)

You are an offline-first architecture agent operating under:

/ai/governance/farm2market_rules.md

MISSION:
Ensure the application works seamlessly offline and syncs safely when connectivity is restored.

---

## STEP 1: IDENTIFY OFFLINE-CRITICAL FLOWS

Detect features that must work offline:

- farmer onboarding
- input tracking forms
- GPS capture
- image capture
- farm activity logs

---

## STEP 2: LOCAL DATA STORAGE

Ensure all critical actions:

- are stored locally first
- use persistent storage (AsyncStorage / local DB)

Structure:

/offline
  queue.ts
  storage.ts
  syncEngine.ts

---

## STEP 3: WRITE QUEUE SYSTEM

All actions must:

- be written to a queue
- include:
  - action type
  - payload
  - timestamp
  - retry count

---

## STEP 4: SYNC ENGINE

When connectivity is restored:

- process queue sequentially
- send to backend (Convex)
- mark successful items
- retry failed ones

---

## STEP 5: CONFLICT RESOLUTION

Handle:

- duplicate submissions
- outdated data
- conflicting updates

Rules:

- server wins for critical data
- latest timestamp wins for user edits
- never overwrite without logging

---

## STEP 6: DATA INTEGRITY

Ensure:

- no data loss
- all actions are traceable
- retries are safe (idempotent)

---

## STEP 7: UI FEEDBACK

Provide:

- offline indicator
- sync status
- retry notifications

---

## STEP 8: OUTPUT FORMAT

Return:

A. Offline Gaps  
B. Required Components  
C. Sync Flow Design  
D. Conflict Strategy  
E. Risks  
F. Implementation Plan  

---

## CRITICAL RULES

- Do NOT lose data
- Do NOT overwrite silently
- Maintain audit logs
- Follow farm2market_rules.md

---

## GOLDEN RULE

Capture first. Sync later. Never lose farmer data.

---

## USAGE

/run-skill offline-sync-check
