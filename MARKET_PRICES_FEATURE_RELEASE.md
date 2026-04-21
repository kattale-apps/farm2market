# MARKET_PRICES_FEATURE_RELEASE.md

**Feature**: Live Market Price Panel + Vendor Commodity Memory + Paid Excel Price Sheet Downloads  
**Release Date**: April 21, 2026  
**Status**: Ready for deployment  
**Scope**: Public-facing / Buyer-facing / Vendor-facing / SuperAdmin-facing

---

## 1. Feature Overview

Three interconnected features added to Farm2Market Uganda:

1. **Public Market Price Panel** — Anonymous live commodity price cards displayed on the login page.  
   - Desktop: right-hand column alongside login form.  
   - Mobile: below the login form.  
   - Cards show commodity + market name + latest price in UGX + 🛒 Buy button.  
   - Buy button redirects to `/login?intent=buy&role=buyer`, pre-selecting buyer signup.  
   - **No vendor identity disclosed** on the public panel; full details only visible to authenticated buyers.

2. **Vendor Commodity Memory** — Suggestion chips in the `CreateListing` form for vendor and store roles.  
   - Pulls the vendor's 8 most recently used commodities (from their listings + explicit price submissions, last 60 days).  
   - One-tap chip prefills `produceType` and shows last known price.

3. **Paid Excel Market Price Sheet Downloads** — Buyers can purchase daily/weekly/monthly price report Excel files.  
   - Payment options: FarmCoin (`buyer_reward` balance deduction) or Pesapal.  
   - SuperAdmin controls daily/weekly/monthly prices in the Admin Dashboard.  
   - SuperAdmin can download any published snapshot for free directly from the Admin Dashboard.  
   - Each download is audit-logged in `downloadAuditLog`.

---

## 2. Schema Changes (`convex/schema.ts`)

### New tables (additive — no existing tables modified)

| Table | Purpose |
|---|---|
| `marketPriceSubmissions` | Vendor explicit price submissions |
| `dailyPriceSnapshots` | One snapshot per calendar day (building → published → archived) |
| `dailyPriceSnapshotRows` | Aggregated commodity × market rows per snapshot |
| `downloadPurchases` | Buyer entitlements to download price sheets |
| `downloadAuditLog` | Audit trail for every Excel download |

### Extended fields (additive)

| Table | New fields |
|---|---|
| `systemSettings` | `priceSheetDailyPriceUGX`, `priceSheetWeeklyPriceUGX`, `priceSheetMonthlyPriceUGX` (all optional) |
| `farmcoinLedger.source` | Added `"price_sheet_download"` literal to the union |

---

## 3. New / Modified Files

### New files
| File | Description |
|---|---|
| `convex/marketPrices.ts` | All backend logic: queries, mutations, actions, internal mutations |
| `app/components/MarketPricePanel.tsx` | Public price card component (anonymous) |

### Modified files
| File | Change |
|---|---|
| `convex/schema.ts` | Schema additions described above |
| `convex/crons.ts` | Added `freeze daily price snapshot` cron at 21:00 UTC (midnight Uganda) |
| `app/login/page.tsx` | Two-column layout + `intent=buy` param handling |
| `app/components/CreateListing.tsx` | Vendor commodity memory query + suggestion chips |
| `app/components/BuyerDashboard.tsx` | Market Price Reports section (purchase + download) |
| `app/components/AdminDashboard.tsx` | SuperAdmin Market Price Reports section (pricing control + snapshot download) |

---

## 4. Deployment Steps

> **Order matters**: Convex backend must deploy before the frontend.

### Step 1: Deploy Convex backend

```powershell
$env:CONVEX_DEPLOYMENT='adamant-armadillo-601'
npx convex deploy --yes
```

Expected outcome:
- 5 new tables created automatically
- New cron `freeze daily price snapshot` registered
- `convex/marketPrices.ts` functions available

### Step 2: Verify Convex deployment

In the [Convex dashboard](https://dashboard.convex.dev):
- Tables → confirm `marketPriceSubmissions`, `dailyPriceSnapshots`, `dailyPriceSnapshotRows`, `downloadPurchases`, `downloadAuditLog` exist
- Crons → confirm `freeze daily price snapshot` is scheduled at 21:00 UTC
- Functions → confirm `marketPrices:getPublicPriceCards` and others are listed

### Step 3: Deploy frontend to Vercel

**Option A — GitHub auto-deploy (if connected)**
```bash
git add -A
git commit -m "feat: market prices panel, vendor memory, paid Excel downloads"
git push origin main
```
Vercel will detect the push and auto-deploy.

**Option B — Manual Vercel deploy**
```powershell
npx vercel --prod
```

### Step 4: Post-deploy smoke checks

- [ ] Load `/login` → price panel visible (right column desktop, below form mobile)
- [ ] Price panel cards contain no vendor alias or stall number text
- [ ] Click 🛒 Buy on any card → URL becomes `/login?intent=buy&role=buyer`, role pre-selected
- [ ] Log in as vendor → go to CreateListing → suggestion chips appear after first listing exists
- [ ] Log in as buyer → BuyerDashboard → "📊 Market Price Reports" section visible with pricing cards
- [ ] Log in as SuperAdmin → AdminDashboard → "📈 Market Price Reports" subsection visible
- [ ] SuperAdmin: save price sheet prices → success message shown
- [ ] SuperAdmin: download a snapshot (after cron runs at least once) → Excel file downloads

---

## 5. Rollback Procedure

The schema changes are **additive only** — no existing tables or fields were removed. To rollback:

1. Revert modified files to their previous git state:
   ```bash
   git revert HEAD   # or: git checkout <prev-sha> -- <file>
   ```
2. Redeploy Convex: `npx convex deploy --yes`
3. Redeploy frontend: push to main or `npx vercel --prod`

The 5 new tables will remain in Convex (they are empty and harmless) but can be deleted manually from the Convex dashboard if required.

---

## 6. Testing Checklist

### Backward compatibility
- [ ] Run `npm run test:e2e` — all 3 existing QR community specs must pass unchanged
- [ ] Login flow for farmer/trader/buyer/vendor unaffected
- [ ] Existing vendor listing creation still works (suggestion chips are additive UI only)

### New feature smoke tests
- [ ] `tests/market-prices.e2e.spec.ts` — all 4 smoke tests pass (see Phase 10)

### Manual checks
- [ ] Price panel shows "🌱 Market prices coming soon" when no snapshot published yet (expected on first deploy)
- [ ] After vendor creates a listing, `buildDailySnapshot` is triggered within seconds (via scheduler)
- [ ] After cron runs (21:00 UTC), snapshot status changes to "published"
- [ ] Buyer FarmCoin purchase: deducts balance, creates `downloadPurchases` entry, download triggers
- [ ] Pesapal purchase flow: redirects to Pesapal, pending entry created in `downloadPurchases`

---

## 7. Known Limitations / Future Work

1. **Pesapal IPN for price sheet**: The Pesapal IPN/callback handler in `convex/pesapal.ts` does not yet call `internal.marketPrices.confirmDownloadPurchasePesapal`. Pesapal-paid downloads will remain in "pending" status until this is wired. FarmCoin payments are fully functional. **Priority**: address in next sprint.

2. **Weekly/Monthly scope when partial data**: If only some days in a week/month have published snapshots, the Excel will contain those days. UI shows a note to this effect.

3. **Login page left column**: The plan reserves the left column for something farm-related in future. Currently shows the login form on both mobile (full-width) and desktop (left column).

---

## 8. Assumptions

1. Market emojis are static (mapped by `marketType` string: `city_market` → 🏙️, `roadside_market` → 🛣️, etc.)
2. Commodity emojis use a built-in static map (subset of common Uganda commodities)
3. Buyer FarmCoin spend uses `buyer_reward` accountType (NOT the trader `spendFarmcoinTokens` function)
4. SuperAdmin is identified by `adminLevel === "super" || adminLevel === undefined` (consistent with `convex/admin.ts` pattern)
5. Snapshot fallback: if today's snapshot isn't published, login panel shows yesterday's. No data = "coming soon" state.
6. `pilotMode` does NOT block the public price panel (it's read-only and auth-free)
