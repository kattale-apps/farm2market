# Financial Intelligence Layer — Test Plan

## Build Status: ✅ PASS (0 errors, 0 type errors)

---

## Phase 1: Foundation (Schema + Backend + UI)

### 1A. Schema & Backend

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Tracker templates seed | Open admin Business Trackers page → select a community | 6 templates appear (Daily Revenue, Expense Tracker, Inventory Tracker, P&L Summary, Cash Flow, Harvest Record) |
| 2 | Create tracker from template | Click a template card → click "Create from Template" | Form created for community; appears in Active Trackers list |
| 3 | Custom tracker creation | Fill custom builder fields → add calculated field with formula (e.g. `{Revenue} - {Cost}`) → Create | Form created with calculated auto-field |
| 4 | Draft auto-save | Member opens tracker → fills some fields → waits 1 sec | Draft saved silently; refresh keeps data |
| 5 | Submit draft | Member fills all fields → clicks Submit | Status changes to SUBMITTED; appears in "My Submissions" |
| 6 | Calculated field computation | Member enters values for fields referenced in formula → observe result field | Auto-calculated value appears immediately |

### 1B. Admin Business Trackers UI

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 7 | Navigate to Business Trackers | Admin Dashboard → click 📊 Business Trackers card | `/admin/business-trackers` loads with "Financial Overview" header + "Know Your Numbers" slogan |
| 8 | Community selector | Switch community in dropdown | Active trackers and templates update for selected community |
| 9 | View tracker data | Click "View Data" on an active tracker | Inline table shows member submissions with field values |
| 10 | Link to Performance Insights | Click "📈 View Performance Insights" button | Navigates to `/admin/performance-insights` |

### 1C. Member UI + Tab Bar

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 11 | Tab bar visible | Open any community page (noticeboard, messages, profile) | Fixed bottom tab bar with 5 tabs (Board, Chat, Trackers, Insights, Profile) |
| 12 | Trackers hub | Click Trackers tab | Lists active trackers for community with category badges |
| 13 | Fill tracker | Click a tracker → fill fields → Submit | SUBMITTED entry saved |
| 14 | View submissions | Click "View My Submissions" link | Past entries shown grouped by tracker |
| 15 | My Insights page | Click Insights tab | Personal analytics with aggregated totals, "Know Your Numbers" slogan |

---

## Phase 2: Analytics + Recharts

### Admin Performance Insights

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 16 | Insights page loads | `/admin/performance-insights` → select community | Overview cards show per-tracker totals |
| 17 | Bar chart renders | Scroll to "Submissions by Tracker" | Colored bar chart with tracker names on X-axis |
| 18 | Pie chart renders | Scroll to "Category Distribution" | Pie chart showing category breakdown (if >1 category) |
| 19 | Member drill-down | Click a tracker card | Member Breakdown table + bar chart appears |
| 20 | PDF export (insights) | Click "📄 Export PDF" | Downloads `performance_insights_YYYY-MM-DD.pdf` with tables |

---

## Phase 3: Dashboard Analytics & PDF Exports

### Farmer Dashboard

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 21 | Excel button removed | Open Farmer Dashboard → "Your Transactions" section | Only "Export PDF" button visible; no "Export Excel" |
| 22 | Analytics section visible | Scroll to "📊 Farm Analytics" section | 4 KPI cards (Listings, Negotiations, Transactions, Total Earnings) + "Know Your Numbers" |
| 23 | Analytics PDF export | Click "📄 Export Analytics PDF" | Downloads `farmer_analytics_YYYY-MM-DD.pdf` with Listings Overview, Negotiations Summary, Earnings Summary tables |

### Trader Dashboard

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 24 | Analytics section visible | Pro View → scroll to "📊 Trader Analytics" section | 4 KPI cards (Active UTIDs, Inventory Items, Buy Offers, Balance) + "Know Your Numbers" |
| 25 | Analytics PDF export | Click "📄 Export Analytics PDF" | Downloads `trader_analytics_YYYY-MM-DD.pdf` with Capital & Exposure, Inventory Summary, UTID Activity, FarmCoin tables |

### Buyer Dashboard

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 26 | Analytics section visible | Scroll to "📊 Buyer Analytics" section | 4 KPI cards (Balance, Transactions, Total Spent, FarmCoin) + "Know Your Numbers" |
| 27 | Analytics PDF export | Click "📄 Export Analytics PDF" | Downloads `buyer_analytics_YYYY-MM-DD.pdf` with Wallet Summary, Transaction Summary, Cash Flow Summary, Orders Overview tables |

---

## Files Created/Modified

### New Files
- `convex/forms.ts` — Extended with 10+ mutations/queries
- `app/admin/business-trackers/page.tsx` — Admin Financial Overview
- `app/admin/performance-insights/page.tsx` — Admin Analytics with Recharts
- `app/components/CommunityTabBar.tsx` — Bottom nav for community pages
- `app/(community)/community-only/trackers/page.tsx` — Tracker hub
- `app/(community)/community-only/trackers/fill/page.tsx` — Form fill
- `app/(community)/community-only/trackers/view/page.tsx` — Submissions view
- `app/(community)/community-only/my-insights/page.tsx` — Personal analytics

### Modified Files
- `convex/schema.ts` — Added communityForms.category, formFields.isCalculated/formula, formResponses.status, trackerTemplates table
- `app/components/AdminDashboard.tsx` — Added "Know Your Numbers" slogan + Business Trackers nav card
- `app/components/FarmerDashboard.tsx` — Removed Excel export, added Farm Analytics section + PDF export
- `app/components/TraderDashboard.tsx` — Added Trader Analytics section + PDF export
- `app/components/BuyerDashboard.tsx` — Added Buyer Analytics section + PDF export
- `app/(community)/community-only/noticeboard/page.tsx` — Added CommunityTabBar
- `app/(community)/community-only/messages/page.tsx` — Added CommunityTabBar
- `app/(community)/community-only/profile/page.tsx` — Added CommunityTabBar

### Dependencies Added
- `recharts` v3.7.0
