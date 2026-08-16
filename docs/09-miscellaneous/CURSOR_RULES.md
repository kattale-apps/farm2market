# 🛡️ CURSOR RULES FOR AGRI-TRADE PLATFORM (v1.1 → v1.2) - ENHANCED

## 1. Core System Invariants (Never Break)

You must preserve:

1. **UTID as the single source of truth**
   * Every order, payment, delivery, storage record, and payout references a UTID.
   * See `INVARIANTS.md` INVARIANT 4.1, 4.2 for details.

2. **Wallet Atomicity**
   * Wallet debit, unit lock, commission deduction, and payout triggers must be one transaction.
   * See `INVARIANTS.md` INVARIANT 1.1, 1.2, 1.3 for ledger correctness.

3. **Anonymity**
   * No real names, phone numbers, or IDs are exposed to users.
   * See `INVARIANTS.md` INVARIANT 3.3 for details.

4. **Role Boundaries**
   * Farmers, Traders, Buyers, StoreAdmins, and SuperAdmins must never see each other's private data.
   * **StoreAdmin** (`adminLevel === "junior"`): Junior admin who confirms delivery of specific location UTIDs. Can only access assigned storage locations.
   * **SuperAdmin** (`adminLevel === "super"` or `undefined`): Super admin with all powers of governance and oversight on the platform.
   * See `architecture.md` Section 4 for authorization boundaries.

5. **Spend Cap & Windows**
   * Traders cannot exceed UGX 1M exposure.
   * Buyers cannot transact when window is closed.
   * See `INVARIANTS.md` INVARIANT 6.1, 6.2, 7.2 for details.

6. **Time Rules**
   * 6-hour farmer delivery deadline
   * 48-hour buyer pickup window
   * See `BUSINESS_LOGIC.md` for SLA details.

7. **Storage Economics**
   * Kilo-shaving only
   * Rates set by SuperAdmin
   * See `DOMAIN_MODEL.md` for storage fee model.

8. **Profit vs Capital Separation**
   * Traders can withdraw profits
   * Capital locked unless verified
   * See `INVARIANTS.md` INVARIANT 1.1 for ledger structure.

9. **Commission Integrity**
   * Trader commission is charged on trader purchase
   * Deducted from wallet before pay-to-lock
   * Counted in admin earnings

10. **Pilot Mode Enforcement**
    * When `systemSettings.pilotMode === true`, all money-moving mutations must be blocked.
    * See `INVARIANTS.md` INVARIANT 7.1 for details.

11. **Backend Architecture**
    * ❌ **DO NOT use Supabase** - It violates core architecture constraints
    * ✅ **ONLY use Convex** - All backend logic must be in Convex functions
    * See `dormant/supabase/DO_NOT_USE.md` for detailed explanation.

---

## 2. Change Control Rules

When modifying the system:

* ❌ Do NOT refactor across files
* ❌ Do NOT rename core services
* ❌ Do NOT move UTID generation
* ❌ Do NOT alter wallet or order tables without explicit request
* ❌ Do NOT implement BLOCKED features (see `VISION.md` for BLOCKED items)
* ❌ Do NOT bypass server-side authorization checks
* ❌ Do NOT modify immutable ledger entries (WalletLedger, AdminAction, StorageFeeDeduction, RateLimitHit)
* ❌ Do NOT change admin hierarchy logic without explicit request (StoreAdmin vs SuperAdmin)

---

## 3. File-Scope Enforcement

You may only modify the **currently opened file** unless explicitly told otherwise.

If another file is needed, you must stop and ask.

---

## 4. Planning First, Coding Second

Before writing code, you must:

1. List affected invariants (reference `INVARIANTS.md`)
2. Explain how they remain safe
3. Describe the minimal change
4. Identify any BLOCKED dependencies (see `VISION.md`)
5. Verify admin hierarchy impact (StoreAdmin vs SuperAdmin permissions)

If you skip this, the response is invalid.

---

## 5. No "Helpful" Refactors

Never suggest:

* "Let's clean this up…"
* "We should refactor…"
* "This would be simpler if…"
* "We could optimize this…"

Instead, always preserve existing patterns.

---

## 6. Data Safety

* Never delete data
* Never drop fields
* Never change data meaning
* Never modify immutable entities (see `architecture.md` Section 3.2)
* Never overwrite wallet balances (ledger entries only)

---

## 7. Stop Conditions

If a change:

* Risks UTID traceability
* Breaks wallet atomicity
* Exposes identities
* Bypasses authorization
* Violates exposure limits
* Implements BLOCKED features
* Changes admin hierarchy without explicit request
  → STOP and ask for clarification.

---

## 8. Admin Hierarchy Rules

**StoreAdmin (Junior Admin)**:
* `adminLevel === "junior"` in schema
* Can only confirm delivery for UTIDs from assigned storage locations (`allowedStorageLocationIds`)
* Cannot perform SuperAdmin actions (pilot mode control, purchase window control, user role changes, etc.)
* See `convex/schema.ts` line 33-34 for schema definition

**SuperAdmin**:
* `adminLevel === "super"` or `undefined` (backward compatible)
* Has all powers of governance and oversight
* Can perform all admin actions (delivery verification, transaction reversal, purchase window control, pilot mode control, user role changes, etc.)
* Can access all storage locations
* See `convex/admin.ts` `isSuperAdmin()` function for implementation

**When modifying admin functionality**:
* Always check `isSuperAdmin()` for SuperAdmin-only actions
* Always check `canAdminAccessLocation()` for StoreAdmin location restrictions
* Never bypass admin hierarchy checks

---

## 9. Documentation References

When making changes, reference:
- `INVARIANTS.md` - 25 system invariants
- `architecture.md` - Trust boundaries and kill-switches
- `DOMAIN_MODEL.md` - Entity definitions and state transitions
- `BUSINESS_LOGIC.md` - Workflows and authority
- `VISION.md` - BLOCKED features and scope
- `convex/schema.ts` - Database schema (source of truth for entities)

---

## 10. Final Instruction

> **Your job is to preserve the system while extending it safely.
> Not to rewrite it.**

---

## 11. Version History

- **v1.1 → v1.2**: Added pilot mode enforcement, backend architecture rules, BLOCKED feature references, admin hierarchy clarification (StoreAdmin vs SuperAdmin)
