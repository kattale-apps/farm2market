# QR Management Platform

A self-contained module inside this app for creating dynamic QR codes, optional
public landing pages, optional lead-capture forms, and scan/redirect/submission
tracking — for marketing campaigns, product packaging, events, and similar
use cases. It reuses this app's existing Next.js + Convex stack and auth
system; no new services, databases, or infrastructure were introduced.

## What it does

- Admins create a QR code with a **stable public URL** (`/q/{code}`). The QR
  image always encodes that URL, never the destination — so an admin can
  change where it redirects later **without reprinting the QR**.
- A scan opens `/q/{code}` in the visitor's ordinary browser. No account, no
  app install, no login. If the QR has a landing page configured, the visitor
  sees it (logo, heading, description, hero image, buttons, social links,
  optional form); otherwise they're redirected immediately.
- Every scan, redirect, and form submission is tracked (device/browser/OS
  category, referrer, timestamps — no raw IPs or other unnecessary PII).
- Admins can group QR codes into campaigns, apply a color/logo style preset,
  set organization-wide branding defaults, and manage who (which admins) can
  do what via a permission list.
- An analytics dashboard and CSV-exportable reports summarize activity.

## Technology

Same stack as the rest of this app — nothing new was added:

- **Next.js 14 (App Router)** — pages under `app/(superadmin)/superadmin/qr/`
  (admin UI) and `app/(public)/q/[code]/` (public resolution + landing page).
- **Convex** — the same deployment/database as the rest of the app. New
  tables and functions live alongside the existing ones in `convex/`.
- **`qrcode`** npm package (already a dependency) for generating QR images
  client-side, in `app/components/qr/QrCodeDisplay.tsx`.
- Plain inline styles (this app does not use Tailwind, despite some
  unrelated older pages containing dead Tailwind classNames).
- **Capacitor** — no QR-specific configuration needed. The Android app loads
  the same web app via `capacitor.config.ts`'s `server.url`, so `/q/[code]`
  works identically inside the APK's webview and in any external browser.

## Local setup

Uses the exact same setup as the rest of the app — see
`docs/02-setup-and-deployment/setup_convex.md` and the repo root `README.md`
for full instructions. In short:

```bash
npm install
npx convex dev      # pushes convex/schema.ts and all functions, incl. QR ones
npm run dev          # Next.js dev server
```

No QR-specific environment variables are required beyond the app's existing
`NEXT_PUBLIC_CONVEX_URL` (used by the public `/q/[code]` page to call Convex
server-side via `ConvexHttpClient`).

## Database overview

All QR tables live in `convex/schema.ts` alongside the rest of the app's
tables, prefixed `qr*` (plus `campaigns` and `brandingSettings`) so they're
easy to find and — if this module is ever lifted into another app — easy to
extract as a self-contained set:

| Table | Purpose |
|---|---|
| `qrCodes` | One row per QR code: code, destination, style, optional landing page config, optional scheduling window. |
| `campaigns` | Optional grouping for QR codes; simple name/description/date-range. |
| `qrScanEvents` | One row per scan/open of `/q/[code]`. |
| `qrRedirectEvents` | One row per actual redirect (immediate for plain QR codes, on CTA click for landing-page QR codes). Stores a snapshot of the destination URL at that moment. |
| `qrForms` / `qrFormFields` | A form attached to a QR's landing page, and its fields. |
| `qrFormSubmissions` / `qrFormSubmissionValues` | Anonymous visitor submissions and their field values. |
| `brandingSettings` | A single global row for default org name/logo/colors. |
| `users.qrPermissions` | Array of permission strings (e.g. `"qr.create"`) for junior admins; super admins bypass this. |

No table requires a `communityId` or ties into CRM/community concepts —
that's deliberate, so the module stays liftable.

## Permissions

`convex/qrAuth.ts` exports `requireQrAdmin(ctx, userId, permission?)`, called
at the top of every admin-facing QR function. Super admins (`adminLevel ===
"super"`, or unset — same backward-compat convention used elsewhere in this
app) always pass. Junior admins need the specific permission string in their
`qrPermissions` array. The full permission list is `QR_PERMISSIONS` in the
same file. A super admin manages these from **Superadmin → QR → Administrators**.
Admin *accounts* themselves (create/disable/delete) are still managed from
the existing **Role Management** page — this module doesn't duplicate that.

## Adding a new QR style

Open `app/lib/qrStyles.ts` and append an entry to `QR_STYLE_PRESETS`:

```ts
{ id: "myNewStyle", label: "My New Style", darkColor: "#123456", lightColor: "#ffffff" }
```

It appears in the style picker automatically — no other code changes needed.

Note: the `qrcode` library only supports foreground/background color, an
embedded logo, error-correction level, and a simple CSS frame drawn around
the image. It does not support true per-module dot/corner shape rendering
(rounded dots, custom eye shapes) the way some commercial QR tools do. That
would require a custom SVG renderer reading the library's raw module matrix
— a real engineering task, not a config change — and hasn't been built here
to avoid over-engineering a v1.

## Integration / API-readiness

Every QR operation is a plain Convex mutation/query (`convex/qrCodes.ts`,
`convex/qrForms.ts`, `convex/qrPublic.ts`, `convex/campaigns.ts`,
`convex/branding.ts`, `convex/qrAnalytics.ts`, `convex/qrAdmins.ts`) — these
are already callable from any Convex client, including a future separate
frontend. No separate API gateway or microservice was built.

For a plain external HTTP consumer, two example routes exist in
`convex/http.ts`, following the same pattern as this app's existing Pesapal
webhook:

- `GET https://{deployment}.convex.site/api/qr/resolve?code={code}` — resolves
  and tracks a scan, returns the destination/landing config as JSON.
- `POST https://{deployment}.convex.site/api/qr/submit` — submits a form
  (`{ formId, qrCodeId, values: [{ fieldId, value }] }`).

These are thin wrappers around the same functions the web app itself calls —
add more routes the same way only when a real external integration needs
them; don't pre-build a general API gateway.

To lift this module into another app later: copy the `qr*`/`campaigns`/
`brandingSettings` schema tables and the `convex/qr*.ts` + `convex/campaigns.ts`
+ `convex/branding.ts` files, the `app/(public)/q/[code]/` route, and the
admin UI under `app/(superadmin)/superadmin/qr/` — none of it imports
anything from communities/CRM/farming-domain code.

## Deployment

Same as the rest of the app — Vercel (Next.js) + Convex, no separate hosting.
See `docs/02-setup-and-deployment/DEPLOYMENT_GUIDE.md` and
`docs/02-setup-and-deployment/vercel_env_setup.md`. The one thing specific to
this module: whatever production domain the app is deployed to becomes the
public QR domain automatically, since `/q/[code]` is just a normal Next.js
route — printed/shared QR codes should point at that production domain, not
a preview/dev URL, since QR images encode a fixed URL.

## Development phases

1. **Core** — QR creation, dynamic URL, destination change, basic styling,
   logo upload, public landing page, a minimal attached form, scan/redirect
   tracking.
2. **Management** — campaigns, more style presets, branding, granular
   permission enforcement + an admin permissions UI.
3. **Analytics** — dashboard (scans/redirects/submissions/conversion rate,
   daily breakdown, top QR codes/campaigns/destinations, recent activity,
   with date/campaign/QR filters), CSV-exportable reports.
4. **Integration** — example external HTTP endpoints, scheduling windows and
   a landing-page background-color option (further "additional landing-page
   features" and "additional styles" can be added the same low-effort way),
   and this document.

All four phases are complete as of this document.
