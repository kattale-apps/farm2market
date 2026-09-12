# CLAUDESCOPE.md

**Status: PINNED — read this before touching any code in this repository.**

This document is the working governance contract between the developer (owner) and Claude
Code for building out Farm2Market Uganda feature-by-feature. It is a living document —
the rules in Part 1 can be updated over time, but every update must itself pass the
backward-compatibility bar defined in Rule 6 before it is considered adopted. Part 2 is a
map of the current codebase, kept current so scope decisions can be made quickly and
correctly.

---

## Part 1 — Governing Rules

These rules apply to every session, every feature, every file touched, with no exceptions
unless the owner explicitly overrides in writing for that specific change.

### Rule 1 — No whole-app changes without approval
Never make a change whose blast radius is "the whole app" — global config, shared schema
tables used by every role, root layout, global auth/session logic, the wallet/payment
core, CI/deploy workflows — without first stating the blast radius out loud and getting
explicit approval. Default assumption: the owner wants the *smallest* change that
delivers the requested feature, not a refactor.

### Rule 2 — Never scope-creep
Work only on the feature explicitly requested. If, while working, a related bug,
inconsistency, or "nice to have" is discovered, **name it and stop** — report it to the
owner rather than fixing it inline, unless it directly blocks the requested feature from
working correctly. Do not bundle unrelated improvements into a feature PR/commit.

### Rule 3 — Always build modularly
Every new feature or edit should be isolated to the smallest reasonable set of files:
- Prefer adding a new `convex/<domain>.ts` module over expanding an existing large one.
- Prefer adding a new component/route over embedding new logic into a shared
  dispatcher (`app/page.tsx`, `app/components/*Dashboard.tsx`) beyond the minimal
  wiring needed to route to it.
- Keep role-specific logic inside that role's module/component. Don't let farmer logic
  leak into trader files, etc.
- Shared/cross-cutting concerns (wallet, payments, notifications, auth, UTID
  generation) are the exception — changes there affect all roles and fall under Rule 1.

### Rule 4 — The app is live: test backward compatibility before declaring a feature done
This is a production system (`convex-dual-deploy.yml` deploys `develop` → dev and
`main` → prod on every push, with **no automated test/lint/type-check gate** — see Part 2,
§6). That means:
- Before marking any feature "done," verify it does not change behavior for existing
  users/roles who don't use the new feature (existing queries/mutations keep their
  signatures and return shapes unless the change is explicitly a breaking migration
  the owner approved).
- Check schema changes are additive (new optional fields) unless a migration plan was
  explicitly approved — `convex/schema.ts` is large (2600+ lines) and shared by every
  role; a careless required-field addition breaks every existing document.
- Run whatever local verification is available (`npm run test`, `npm run test:e2e`,
  `npm run lint`) before calling a feature complete, and say plainly if something
  could not be verified (e.g., no UI test performed) rather than claiming success.
- Because pilot mode (`systemSettings.pilotMode`) is the in-app kill switch for
  money/inventory mutations, prefer testing new money-moving logic with pilot mode
  respected, not bypassed.

### Rule 4b — Always branch new feature work; required path to prod is feature → develop → main
Because `main` auto-deploys to prod on every push with no test/lint/type-check gate
(Rule 4, `convex-dual-deploy.yml`), new feature work must never go straight to `main`.
The required sequence is:
1. Commit and push feature work to its own dedicated branch (e.g. `feature/<name>`),
   never directly to `develop` or `main`.
2. Merge/push that branch to `develop` first. This deploys the Convex functions to the
   **dev deployment** (`dev:adamant-armadillo-601`, see `.env.local` /
   `convex-dual-deploy.yml`'s `convex-dev` job) and lets the owner try the feature on
   dev before it goes anywhere near prod.
3. Only merge `develop` into `main` (or otherwise push to `main`) when the owner
   explicitly requests the merge/deploy to prod. A bare "push" request defaults to the
   feature branch (step 1), not `develop` and never `main`. If it's ambiguous which
   target the owner wants, ask rather than assume `develop` or `main`.
- Note this required sequence to the owner up front when starting new feature work,
  not just at push time, so it's a default expectation rather than a last-minute check.

### Rule 5 — Six user categories + two admin tiers, never conflated
The app has exactly **six end-user role categories** plus **two distinct
administrative tiers**. They must never be conflated with each other in code, schema,
or documentation:

| Category | Schema `role` value | Notes |
|---|---|---|
| Farmer | `farmer` | Lists produce, receives payment |
| Vendor | `vendor` | Separate from trader/store — see Part 2 §2 |
| Trader | `trader` | Buys from farmers, sells to buyers, subject to spend cap |
| Transporter | `transporter` | Logistics role |
| Store | `store` | Storage-location-facing end user |
| Buyer | `buyer` | Purchases from traders, never sees prices |
| **Superadmin** | `role: "admin"`, `adminLevel: "super"` (or `undefined`, backward-compat) | Full governance: all communities, all users, all admins |
| **Community Admin** | `role: "admin"`, `adminLevel: "junior"`, `adminCategory: "community"` | Scoped to `assignedCommunityIds` only |

Also present but distinct from both of the above and from each other:
- **Store Admin** (`adminCategory: "store"`, junior) — scoped to `allowedStorageLocationIds`,
  delivery verification only. Do not confuse with the **Store** end-user role.
- **Message Admin** (`adminCategory: "message"`, junior) — inbox/support scope only.
- **Finance Admin** (`adminCategory: "finance"`, junior) — finance scope only.

### Rule 5b — Always analyze by category, separately
Any analysis, impact assessment, or test plan produced for a feature must break out
each of the eight categories above **separately** — six end-user roles, superadmin,
community admin (and note Store Admin / Message Admin / Finance Admin where relevant)
— rather than giving one generic "users are affected" statement. State explicitly
which categories are touched, which are unaffected, and which are untested.

### Rule 6 — Continuous update, always backward-compatibility-tested
This document (Part 1 rules and Part 2 map) may be revised at any time as the app
evolves. When it is revised:
- The new version must not silently drop or weaken a prior rule — call out what
  changed and why.
- Any process/rule change must itself be checked against Rule 4 (does it still let us
  verify backward compatibility on a live app?) before being adopted.
- Part 2 (the map) should be refreshed whenever it's found to be stale, so scope
  decisions in future sessions are based on current reality, not drift.

### Rule 7 — Always design mobile-first
Every UI change — new screens, edits to existing ones, component layout, spacing,
navigation — must be designed and verified for mobile viewport widths first, then
adapted upward for larger screens. Farm2Market's end users (farmers, traders, buyers,
vendors, transporters, store staff) predominantly access the app on phones, so a
desktop-first layout that gets awkwardly squeezed onto mobile is not acceptable. When
building or reviewing any UI, check the smallest supported width first and treat larger
breakpoints as progressive enhancement, not the default.

---

## Part 2 — Codebase Map (refresh as it drifts)

### 1. Stack
- Frontend: Next.js 14 App Router, TypeScript.
- Backend: Convex only (Supabase is forbidden/dormant — `dormant/supabase/DO_NOT_USE.md`).
- Deploy: Vercel (frontend) + two Convex deployments (dev/`develop` branch, prod/`main`
  branch) via `.github/workflows/convex-dual-deploy.yml`. **No test/lint/type-check gate
  runs in CI** — deploys go out on push with `--typecheck=disable`. Treat local
  verification as the only safety net (Rule 4).
- In-app kill switch: `systemSettings.pilotMode` blocks all money/inventory mutations
  server-side when `true`; admin-only to toggle, logged immutably.

### 2. UI dispatch pattern
There are **not** six separate route trees. `app/page.tsx` reads the logged-in user's
`role`/`adminLevel`/`adminCategory` and renders one of
`app/components/{Role}Dashboard.tsx` (Admin, Buyer, Farmer, Vendor, Transporter, Store,
Trader/TraderSafe, Finance). Only farmer and trader have extra dedicated route folders
for sub-features (`app/farmer/*`, `app/trader/*`). Vendor and transporter have **no**
dedicated route tree — just `VendorDashboard.tsx`/`TransporterDashboard.tsx` +
`app/onboarding/vendor|transporter/page.tsx` + `convex/vendorOnboarding.ts` /
`convex/transporterOnboarding.ts`. Keep this in mind before assuming a "missing" route
folder means a missing feature.

Other route groups:
- `app/storeadmin/` — Store Admin's own route tree (`dashboard`,
  `delivery-verification`), separate from the `store` end-user role.
- `app/(community)/` — community-scoped UX (member pages, community admin messaging
  dashboard), gated by its own `layout.tsx`.
- `app/(superadmin)/` — superadmin-only route group, including the large `qr/*`
  subtree for QR community-campaign management.
- `app/admin/` — broader ops console (role management, finance, store management,
  storeadmin audit, plus dev-only seed/reset utility pages — treat those as
  non-production tooling, not user-facing features).
- `app/onboarding/{farmer,trader,buyer,store,transporter,vendor}` — one flow per
  end-user role.
- `app/(public)/` — unauthenticated QR/community join pages.

### 3. Schema role fields (`convex/schema.ts`, users table)
- `role`: `"farmer" | "trader" | "buyer" | "admin" | "vendor" | "transporter" | "store"`
  — exactly one per user.
- `adminLevel`: `"super" | "junior" | undefined` (undefined = super, backward-compat).
- `adminCategory`: `"store" | "message" | "community" | "community_crm" | "finance"`
  — only meaningful when `adminLevel === "junior"`.
- `allowedStorageLocationIds` — Store Admin scope.
- `assignedCommunityIds` — Community Admin scope.
- `accountScope`: `"full" | "community_only"`, `onboardedViaCommunityId` — marks
  users who onboarded via a community QR flow.
- `communities.communityAdminId` — the junior community admin assigned to that
  community.

### 4. Backend module ownership (convex/*.ts, ~70 files)
| Domain | Files |
|---|---|
| Farmer | farmerDashboard, farmerOnboarding, farmerProfile, farmValidation, farmNeeds, farmPlanner, farmToolbox, farmCostTemplates, fertilizerPlanner, tempVerifyFarmerData |
| Trader | traderDashboard, traderOnboarding, traderBuyerNegotiations, negotiations |
| Buyer | buyerDashboard, buyerOnboarding, buyers |
| Vendor | vendorOnboarding |
| Transporter | transporterOnboarding |
| Store | storeOnboarding, storeAdmin, storeadminAudit |
| Community | communities, communityApplications, communityImports, noticeboard, qrAdmins, qrAnalytics, qrAuth, qrCodes, qrForms, qrPublic, campaigns, branding |
| Admin/Superadmin | admin, adminAudit, adminFinance, adminListings, adminRedFlags, adminRoleManagement, updateUserRoleAndAssignment, pilotMode, pilotSetup, serviceLevels |
| Marketplace | listings, inventoryBlocks, marketPrices, pricing |
| CRM | crmAgents, crmAnalytics, crmAuth, crmCalls, crmForms |
| Shared/cross-cutting (Rule 1 — highest caution) | wallet, payments, pesapal, finance, monetisation, farmcoin, notifications, pushNotifications, messages, files, forms, pdfGeneration, rateLimits, usageEvents, locations, auth(+auth/, authentication/), constants, crons, scheduled, errors(+errors/), http, index, introspection, userSettings, userManagement/, utils(+utils/) |

### 5. Non-negotiable invariants (source: `docs/01-architecture-and-design/INVARIANTS.md`,
`docs/09-miscellaneous/founder_invariant_list.md` — read those in full before touching
wallet/payments/admin code)
1. Anonymity: users only see system-generated aliases; admins never see real identities.
2. UTID: every meaningful action generates/references an immutable UTID.
3. Spend cap: trader exposure never exceeds UGX 1,000,000, enforced server-side.
4. Pay-to-lock atomicity: payment + unit lock happen together or not at all.
5. Only admins verify deliveries, reverse transactions, control purchase windows/pilot mode.
6. Closed-loop wallet — no external bank connections.
7. Buyers never see prices, anywhere.
8. Purchase windows checked first, before all other purchase validation.
9. All authorization/business rules enforced server-side (Convex), never trusted from client.
10. Pilot mode blocks all money/inventory mutations when on; checked first.
11. Wallet ledger balance = sum(deposits) − sum(locks) + sum(unlocks); no direct overwrites.
12. WalletLedger / AdminAction / StorageFeeDeduction / RateLimitHit entries are immutable.
13. Users cannot change their own role — admin-only, logged.
14. Every admin action logged with adminId, actionType, utid, reason, targetUtid, timestamp.
15. Partially-implemented (BLOCKED) features must be fully on or fully off, never half-wired.

### 6. Testing / verification available locally
- `npm run test` / `test:unit` — `tsx --test "tests/**/*.test.ts"` (4 unit test files;
  thin relative to ~70 Convex modules).
- `npm run test:e2e` / `test:e2e:ui` / `test:e2e:debug` — Playwright (5 specs, mostly
  QR-community flows).
- `npm run lint` — `next lint`.
- No dedicated `type-check` script currently exists in `package.json`.
- **CI does not run any of the above before deploying** — see §1. This is why Rule 4's
  manual verification step is mandatory, not optional, for every feature.

---

*Last written: 2026-09-12. Added Rule 7 (always design mobile-first) — does not weaken
or replace any prior rule. Update Part 2 whenever it's found stale; update Part 1 only
with explicit owner sign-off per Rule 6.*
