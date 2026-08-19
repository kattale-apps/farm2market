# Farm2Market Uganda

[![Convex Dual Deploy](https://github.com/kattale-apps/farm2market/actions/workflows/convex-dual-deploy.yml/badge.svg)](https://github.com/kattale-apps/farm2market/actions/workflows/convex-dual-deploy.yml)

**Controlled, negotiation-driven agricultural trading platform with strict, non-negotiable rules.**

<!-- Last deployment: 2024 - Pilot mode with shared password authentication -->

This repository is the canonical source of truth for the application. All system behavior must be reflected in files here.

## Architecture

### Tech Stack

- **Frontend**: Next.js 14 (App Router)
- **Backend**: Convex (serverless backend)
- **Language**: TypeScript everywhere
- **Deployment**: Vercel-compatible

### Core Principles

1. **Backend**: Convex only - **Supabase is FORBIDDEN and DEPRECATED**
   - ❌ **DO NOT use Supabase** - It violates core architecture constraints
   - ❌ **DO NOT reactivate** dormant Supabase code in `dormant/supabase/`
   - ✅ **ONLY use Convex** - All backend logic must be in Convex functions
   - See `dormant/supabase/DO_NOT_USE.md` for detailed explanation
2. **Business Logic**: All business logic lives in Convex functions
3. **User Roles**: Exactly one role per user (farmer, trader, buyer, admin)
4. **Anonymity**: System-generated aliases only - no real names or identities
5. **UTID**: Every meaningful action generates or references a UTID
6. **Wallet System**: Closed loop, ledger-based (NOT a bank)
7. **Spend Cap**: Trader exposure max UGX 1,000,000 (enforced atomically)
8. **Pay-to-Lock**: Unit locking and wallet debit are atomic operations

## Project Structure

```
farm2market/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   └── globals.css        # Global styles
├── convex/                # Convex backend
│   ├── schema.ts          # Database schema (schema-first design)
│   ├── auth.ts            # Authentication & authorization
│   ├── wallet.ts          # Wallet system (closed loop)
│   ├── listings.ts        # Farmer listings & inventory
│   ├── payments.ts        # Pay-to-lock system (atomic)
│   ├── admin.ts           # Admin authority & actions
│   ├── utils.ts           # Utility functions (UTID, exposure calc)
│   ├── constants.ts       # System constants
│   └── _generated/        # Auto-generated Convex files
├── docs/                  # Documentation
│   ├── architecture.md    # System architecture & governance
│   ├── day66_pre_activation.md
│   └── day67_production_activation.md
├── dormant/               # Dormant/unused code (DO NOT USE)
│   └── supabase/          # ⚠️ FORBIDDEN - Supabase code (see DO_NOT_USE.md)
├── package.json
├── tsconfig.json
├── next.config.js
├── convex.json            # Convex configuration
└── README.md
```

## Deployment Modes

This application supports **two separate deployment modes** with separate URLs:

- **Pilot Mode**: Stable deployment that continues running in its current state
- **Dev Mode**: Development deployment where you can build full functionality without affecting pilot

Both deployments run simultaneously with completely separate:

- Frontend URLs (Vercel)
- Backend deployments (Convex)
- Databases
- Environment variables

**See [deployment_modes_setup](docs/02-setup-and-deployment/deployment_modes_setup.md) for complete setup instructions.**

### Quick Setup

1. **Create two Convex deployments** (pilot and dev)
2. **Create two Vercel projects** (pilot and dev)
3. **Configure environment variables**:
   - Pilot: `NEXT_PUBLIC_CONVEX_URL` (pilot Convex URL), `NEXT_PUBLIC_DEPLOYMENT_MODE=pilot`
   - Dev: `NEXT_PUBLIC_CONVEX_URL` (dev Convex URL), `NEXT_PUBLIC_DEPLOYMENT_MODE=dev`

## Setup / Configuration

### Prerequisites

- Node.js 18+
- npm or yarn
- Convex account (sign up at https://dashboard.convex.dev)

### Installation

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Set up Convex**:

   ```bash
   npx convex dev
   ```

   This will:
   - Create a Convex project (if needed)
   - Generate `.env.local` with `NEXT_PUBLIC_CONVEX_URL`
   - Start the Convex development server

   **Or manually set the Convex URL**:
   - Create `.env.local` with: `NEXT_PUBLIC_CONVEX_URL=https://chatty-camel-373.convex.cloud`
   - For Vercel: Add this as an environment variable in project settings
   - See [setup_convex](docs/02-setup-and-deployment/setup_convex.md) for detailed instructions

3. **Start Next.js dev server**:

   ```bash
   npm run dev
   ```

4. **Open** http://localhost:3000

## Development

### Convex Functions

All business logic lives in `convex/`:

- **Schema**: `convex/schema.ts` - defines all tables and indexes
- **Auth**: `convex/auth.ts` - user creation, role verification
- **Wallet**: `convex/wallet.ts` - closed loop wallet system
- **Listings**: `convex/listings.ts` - farmer listings, auto-split into 10kg units
- **Payments**: `convex/payments.ts` - atomic pay-to-lock system
- **Admin**: `convex/admin.ts` - admin actions, purchase windows

### Key Features

#### 1. User Roles (Exactly One Per User)

- `farmer`: Lists produce, receives payments
- `trader`: Buys from farmers, sells to buyers
- `buyer`: Purchases from traders (no price visibility)
- `admin`: Final authority, controls purchase windows

#### 2. Anonymity (Non-Negotiable)

- All users interact via system-generated aliases
- No real names, phone numbers, or identities exposed
- Aliases are stable but non-identifying

#### 3. UTID (Unique Transaction ID)

- Every meaningful action generates a UTID
- Format: `YYYYMMDD-HHMMSS-ROLE-RANDOM`
- Immutable, server-generated, human-readable
- Anchors wallet entries, listings, negotiations, admin actions

#### 4. Wallet System (Closed Loop)

- Internal ledger only (NOT a bank)
- Traders have:
  - `capital` ledger (locked by default)
  - `profit` ledger (always withdrawable)
- No balance overwrites - ledger entries only
- All entries reference UTIDs

#### 5. Spend Cap Enforcement

- Trader exposure max: UGX 1,000,000
- Exposure = capital committed + locked orders + inventory value
- Enforcement happens BEFORE payment
- Violations fail atomically

#### 6. Pay-to-Lock (Critical)

- Unit locking and wallet debit are atomic
- First successful payment wins
- Race conditions are impossible
- Partial state changes are forbidden

#### 7. Listings & Inventory

- Farmers list produce → auto-split into 10kg units
- Units lock only on successful payment
- Trader inventory aggregates into 100kg blocks for buyers
- Buyers never see prices

#### 8. Time-Based Rules

- Farmer delivery SLA: 6 hours after trader payment
- Buyer pickup SLA: 48 hours after purchase
- Storage fees apply as kilo-shaving per day

#### 9. Admin Authority

- Admin decisions are final in v1.x
- No automated dispute resolution
- All admin actions logged with UTID, reason, timestamp
- Admin controls purchase windows (buyers can only buy during open windows)

## Rules of Operation

- No execution without artifacts
- No deployment without explicit authorization
- No assumptions without evidence
- All business logic in Convex functions
- Server-side role enforcement (never trust client)
- Atomic operations for critical paths (pay-to-lock)

## 🛡️ Cursor AI Rules

This project uses **Cursor rules** to guide AI-assisted development and ensure system integrity.

- **`.cursorrules`** - Active rules file that Cursor reads automatically
- **[CURSOR_RULES](docs/09-miscellaneous/CURSOR_RULES.md)** - Detailed documentation of all rules and invariants

**Key Principles**:

- Preserve invariants above all else
- File-scope changes only (ask before modifying multiple files)
- Planning first, coding second
- No "helpful" refactors without explicit request
- Reference existing documentation ([INVARIANTS](docs/01-architecture-and-design/INVARIANTS.md), [architecture](architecture.md), etc.)

**Admin Hierarchy**:

- **StoreAdmin** (`adminLevel === "junior"`): Confirms delivery for assigned storage locations only
- **SuperAdmin** (`adminLevel === "super"` or `undefined`): Full governance and oversight powers

See [CURSOR_RULES](docs/09-miscellaneous/CURSOR_RULES.md) for complete rules and guidelines.

## Current Status

- Status: Project restructured for Convex backend
- Environment: Local development setup
- Backend: **Convex ONLY** (Supabase is FORBIDDEN - see `dormant/supabase/DO_NOT_USE.md`)
- Production: Not activated (see [architecture](architecture.md))

## 📚 Documentation

Complete documentation index organized by topic:

### Architecture & Design

- [AUDIT_MODEL](docs/01-architecture-and-design/AUDIT_MODEL.md)
- [BUSINESS_LOGIC](docs/01-architecture-and-design/BUSINESS_LOGIC.md)
- [DOMAIN_MODEL](docs/01-architecture-and-design/DOMAIN_MODEL.md)
- [FINANCIAL_INTEGRATION_MODEL](docs/01-architecture-and-design/FINANCIAL_INTEGRATION_MODEL.md)
- [INVARIANTS](docs/01-architecture-and-design/INVARIANTS.md)
- [MODULARITY_GUIDE](docs/01-architecture-and-design/MODULARITY_GUIDE.md)
- [OBSERVABILITY_MODEL](docs/01-architecture-and-design/OBSERVABILITY_MODEL.md)
- [THREAT_MODEL](docs/01-architecture-and-design/THREAT_MODEL.md)
- [audit_non_negotiable_rules](docs/01-architecture-and-design/audit_non_negotiable_rules.md)

### Setup & Deployment

- [ACTION_PLAN_DEV_SETUP](docs/02-setup-and-deployment/ACTION_PLAN_DEV_SETUP.md)
- [BILLING_SETUP](docs/02-setup-and-deployment/BILLING_SETUP.md)
- [CLOUD_FUNCTION_SETUP](docs/02-setup-and-deployment/CLOUD_FUNCTION_SETUP.md)
- [DEPLOYMENT_CHECKLIST](docs/02-setup-and-deployment/DEPLOYMENT_CHECKLIST.md)
- [DEPLOYMENT_GUIDE](docs/02-setup-and-deployment/DEPLOYMENT_GUIDE.md)
- [DEPLOYMENT_STATUS](docs/02-setup-and-deployment/DEPLOYMENT_STATUS.md)
- [DEPLOY_KEY_SETUP](docs/02-setup-and-deployment/DEPLOY_KEY_SETUP.md)
- [DEPLOY_NOW](docs/02-setup-and-deployment/DEPLOY_NOW.md)
- [DEV_DEPLOYMENT_COMPLETE](docs/02-setup-and-deployment/DEV_DEPLOYMENT_COMPLETE.md)
- [DEV_SETUP_FINAL_STATUS](docs/02-setup-and-deployment/DEV_SETUP_FINAL_STATUS.md)
- [DEV_SETUP_STATUS](docs/02-setup-and-deployment/DEV_SETUP_STATUS.md)
- [FCM_SETUP_COMPLETE](docs/02-setup-and-deployment/FCM_SETUP_COMPLETE.md)
- [FIREBASE_SETUP_INSTRUCTIONS](docs/02-setup-and-deployment/FIREBASE_SETUP_INSTRUCTIONS.md)
- [GET_DEV_DEPLOY_KEY](docs/02-setup-and-deployment/GET_DEV_DEPLOY_KEY.md)
- [GOOGLE_PLAY_STORE_SETUP](docs/02-setup-and-deployment/GOOGLE_PLAY_STORE_SETUP.md)
- [PESAPAL_SETUP](docs/02-setup-and-deployment/PESAPAL_SETUP.md)
- [PUSH_NOTIFICATIONS_SETUP](docs/02-setup-and-deployment/PUSH_NOTIFICATIONS_SETUP.md)
- [QUICK_DEPLOY](docs/02-setup-and-deployment/QUICK_DEPLOY.md)
- [QUICK_FIREBASE_SETUP](docs/02-setup-and-deployment/QUICK_FIREBASE_SETUP.md)
- [QUICK_START_DEV](docs/02-setup-and-deployment/QUICK_START_DEV.md)
- [SAFE_SETUP_COMPLETE](docs/02-setup-and-deployment/SAFE_SETUP_COMPLETE.md)
- [VERCEL_CLI_SETUP](docs/02-setup-and-deployment/VERCEL_CLI_SETUP.md)
- [VERCEL_DEV_SETUP](docs/02-setup-and-deployment/VERCEL_DEV_SETUP.md)
- [VERCEL_DEV_SETUP_SIMPLE](docs/02-setup-and-deployment/VERCEL_DEV_SETUP_SIMPLE.md)
- [current_deployment_status](docs/02-setup-and-deployment/current_deployment_status.md)
- [deployment_modes_quick_reference](docs/02-setup-and-deployment/deployment_modes_quick_reference.md)
- [deployment_modes_setup](docs/02-setup-and-deployment/deployment_modes_setup.md)
- [dev_deployment_info](docs/02-setup-and-deployment/dev_deployment_info.md)
- [env-examples](docs/02-setup-and-deployment/env-examples.md)
- [pilot_setup_guide](docs/02-setup-and-deployment/pilot_setup_guide.md)
- [setup_convex](docs/02-setup-and-deployment/setup_convex.md)
- [setup_dev_mode](docs/02-setup-and-deployment/setup_dev_mode.md)
- [troubleshooting_convex](docs/02-setup-and-deployment/troubleshooting_convex.md)
- [vercel_env_setup](docs/02-setup-and-deployment/vercel_env_setup.md)

### Development & Implementation

- [AUTHENTICATION_IMPLEMENTATION_DECISION](docs/03-development-and-implementation/AUTHENTICATION_IMPLEMENTATION_DECISION.md)
- [BLOCKED7_PHASE5_CONSENT_AND_ACCEPTANCE_IMPLEMENTATION_SPEC](docs/03-development-and-implementation/BLOCKED7_PHASE5_CONSENT_AND_ACCEPTANCE_IMPLEMENTATION_SPEC.md)
- [COMMUNITY_APK_IMPLEMENTATION_GUIDE](docs/03-development-and-implementation/COMMUNITY_APK_IMPLEMENTATION_GUIDE.md)
- [IMPLEMENTATION_BOUNDARIES](docs/03-development-and-implementation/IMPLEMENTATION_BOUNDARIES.md)
- [IMPLEMENTATION_SEQUENCE](docs/03-development-and-implementation/IMPLEMENTATION_SEQUENCE.md)
- [IMPLEMENTATION_SUMMARY](docs/03-development-and-implementation/IMPLEMENTATION_SUMMARY.md)
- [buyer_purchase_implementation](docs/03-development-and-implementation/buyer_purchase_implementation.md)
- [project_reorganization](docs/03-development-and-implementation/project_reorganization.md)

### Blocking Issues & Resolution

- [BACKFILL_LOCATION_DATA_PLAN](docs/04-blocking-issues-and-resolution/BACKFILL_LOCATION_DATA_PLAN.md)
- [BLOCKED1_AUTHORIZATION_HANDOFF](docs/04-blocking-issues-and-resolution/BLOCKED1_AUTHORIZATION_HANDOFF.md)
- [BLOCKED1_EXECUTION_KICKOFF](docs/04-blocking-issues-and-resolution/BLOCKED1_EXECUTION_KICKOFF.md)
- [BLOCKED1_PHASE1_CODE_VERIFICATION_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED1_PHASE1_CODE_VERIFICATION_REPORT.md)
- [BLOCKED1_PHASE3_TESTING_RESULTS_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED1_PHASE3_TESTING_RESULTS_REPORT.md)
- [BLOCKED1_PHASE4_OBSERVABILITY_VERIFICATION_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED1_PHASE4_OBSERVABILITY_VERIFICATION_REPORT.md)
- [BLOCKED5_AUTHORIZATION_HANDOFF](docs/04-blocking-issues-and-resolution/BLOCKED5_AUTHORIZATION_HANDOFF.md)
- [BLOCKED5_PHASE1_CODE_VERIFICATION_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED5_PHASE1_CODE_VERIFICATION_REPORT.md)
- [BLOCKED5_PHASE3_TESTING_RESULTS_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED5_PHASE3_TESTING_RESULTS_REPORT.md)
- [BLOCKED5_PHASE4_OBSERVABILITY_VERIFICATION_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED5_PHASE4_OBSERVABILITY_VERIFICATION_REPORT.md)
- [BLOCKED6_AUTHORIZATION_COMPLETION](docs/04-blocking-issues-and-resolution/BLOCKED6_AUTHORIZATION_COMPLETION.md)
- [BLOCKED6_AUTHORIZATION_HANDOFF](docs/04-blocking-issues-and-resolution/BLOCKED6_AUTHORIZATION_HANDOFF.md)
- [BLOCKED6_LEGAL_COUNSEL_ENGAGEMENT](docs/04-blocking-issues-and-resolution/BLOCKED6_LEGAL_COUNSEL_ENGAGEMENT.md)
- [BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md)
- [BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT](docs/04-blocking-issues-and-resolution/BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT.md)
- [BLOCKED7_AUTHORIZATION_HANDOFF](docs/04-blocking-issues-and-resolution/BLOCKED7_AUTHORIZATION_HANDOFF.md)
- [BLOCKED7_PHASE1_INITIATION_AND_SCOPE](docs/04-blocking-issues-and-resolution/BLOCKED7_PHASE1_INITIATION_AND_SCOPE.md)
- [BLOCKED7_PHASE2_CLAUSE_SCAFFOLDING](docs/04-blocking-issues-and-resolution/BLOCKED7_PHASE2_CLAUSE_SCAFFOLDING.md)
- [BLOCKED7_PHASE3_TERMS_OF_SERVICE_DRAFTING](docs/04-blocking-issues-and-resolution/BLOCKED7_PHASE3_TERMS_OF_SERVICE_DRAFTING.md)
- [BLOCKED7_PHASE4_USER_AGREEMENTS_DRAFTING](docs/04-blocking-issues-and-resolution/BLOCKED7_PHASE4_USER_AGREEMENTS_DRAFTING.md)
- [BLOCKED8_AUTHORIZATION_HANDOFF](docs/04-blocking-issues-and-resolution/BLOCKED8_AUTHORIZATION_HANDOFF.md)
- [BLOCKED8_EXECUTION_KICKOFF](docs/04-blocking-issues-and-resolution/BLOCKED8_EXECUTION_KICKOFF.md)
- [CRITICAL_BLOCKED_CAPABILITY_RESOLUTION_PLAN](docs/04-blocking-issues-and-resolution/CRITICAL_BLOCKED_CAPABILITY_RESOLUTION_PLAN.md)
- [CRITICAL_CAPABILITY_EXECUTION_PLAN](docs/04-blocking-issues-and-resolution/CRITICAL_CAPABILITY_EXECUTION_PLAN.md)
- [FINANCIAL_INTELLIGENCE_LAYER_TEST_PLAN](docs/04-blocking-issues-and-resolution/FINANCIAL_INTELLIGENCE_LAYER_TEST_PLAN.md)
- [GO_LIVE_BLOCKER_RESOLUTION_PLAN](docs/04-blocking-issues-and-resolution/GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)

### Go Live & Production

- [FIX_PRODUCTION_BRANCH](docs/05-go-live-and-production/FIX_PRODUCTION_BRANCH.md)
- [GLOBAL_GO_LIVE_AUTHORIZATION](docs/05-go-live-and-production/GLOBAL_GO_LIVE_AUTHORIZATION.md)
- [GO_LIVE_READINESS](docs/05-go-live-and-production/GO_LIVE_READINESS.md)
- [POST_GO_LIVE_UI_CHANGE_POLICY](docs/05-go-live-and-production/POST_GO_LIVE_UI_CHANGE_POLICY.md)
- [PRODUCTION_ACTIVATION](docs/05-go-live-and-production/PRODUCTION_ACTIVATION.md)
- [PRODUCTION_AUTHENTICATION_SPECIFICATION](docs/05-go-live-and-production/PRODUCTION_AUTHENTICATION_SPECIFICATION.md)
- [PRODUCTION_AUTHORIZATION](docs/05-go-live-and-production/PRODUCTION_AUTHORIZATION.md)
- [PRODUCTION_OPERATION](docs/05-go-live-and-production/PRODUCTION_OPERATION.md)
- [SYSTEM_ACTIVATION_AND_GO_LIVE_CONTROLS](docs/05-go-live-and-production/SYSTEM_ACTIVATION_AND_GO_LIVE_CONTROLS.md)
- [SYSTEM_ACTIVATION_READINESS_REVIEW](docs/05-go-live-and-production/SYSTEM_ACTIVATION_READINESS_REVIEW.md)
- [day66_pre_activation](docs/05-go-live-and-production/day66_pre_activation.md)
- [day67_production_activation](docs/05-go-live-and-production/day67_production_activation.md)
- [go_live_checklist](docs/05-go-live-and-production/go_live_checklist.md)

### Admin & Operations

- [ADMIN_ROLES_AND_DASHBOARD_RULES](docs/06-admin-and-operations/ADMIN_ROLES_AND_DASHBOARD_RULES.md)
- [admin_delivery_verification](docs/06-admin-and-operations/admin_delivery_verification.md)
- [admin_operations_playbook](docs/06-admin-and-operations/admin_operations_playbook.md)
- [admin_red_flags](docs/06-admin-and-operations/admin_red_flags.md)
- [delivery_failure_reversal](docs/06-admin-and-operations/delivery_failure_reversal.md)
- [delivery_sla_tracking](docs/06-admin-and-operations/delivery_sla_tracking.md)

### Features & Specifications

- [MARKET_PRICES_FEATURE_RELEASE](docs/07-features-and-specifications/MARKET_PRICES_FEATURE_RELEASE.md)
- [PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT](docs/07-features-and-specifications/PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT.md)
- [buyer_dashboard_queries](docs/07-features-and-specifications/buyer_dashboard_queries.md)
- [farmer_dashboard_queries](docs/07-features-and-specifications/farmer_dashboard_queries.md)
- [negotiation_ux_flow](docs/07-features-and-specifications/negotiation_ux_flow.md)
- [notifications](docs/07-features-and-specifications/notifications.md)
- [onboarding_buyers](docs/07-features-and-specifications/onboarding_buyers.md)
- [onboarding_farmers](docs/07-features-and-specifications/onboarding_farmers.md)
- [onboarding_traders](docs/07-features-and-specifications/onboarding_traders.md)
- [pilot_configuration](docs/07-features-and-specifications/pilot_configuration.md)
- [pilot_mode](docs/07-features-and-specifications/pilot_mode.md)
- [pilot_simulation](docs/07-features-and-specifications/pilot_simulation.md)
- [trader_dashboard_queries](docs/07-features-and-specifications/trader_dashboard_queries.md)

### Testing & Verification

- [AGROFRESH_UG_COMMUNITY_TEST_SCRIPT](docs/08-testing-and-verification/AGROFRESH_UG_COMMUNITY_TEST_SCRIPT.md)
- [BACKUP_AND_RESTORE_VERIFICATION_REPORT](docs/08-testing-and-verification/BACKUP_AND_RESTORE_VERIFICATION_REPORT.md)
- [PENTEST_REPORT_TEMPLATE](docs/08-testing-and-verification/PENTEST_REPORT_TEMPLATE.md)

### Miscellaneous

- [APP_ICON_SUMMARY](docs/09-miscellaneous/APP_ICON_SUMMARY.md)
- [BILLING_REQUIRED](docs/09-miscellaneous/BILLING_REQUIRED.md)
- [BUILD_APK_GUIDE](docs/09-miscellaneous/BUILD_APK_GUIDE.md)
- [COMMUNITY_APK_SUMMARY](docs/09-miscellaneous/COMMUNITY_APK_SUMMARY.md)
- [CURSOR_RULES](docs/09-miscellaneous/CURSOR_RULES.md)
- [EXECUTION_AUTHORIZATION_AND_KICKOFF](docs/09-miscellaneous/EXECUTION_AUTHORIZATION_AND_KICKOFF.md)
- [GOOGLE_PLAY_STORE_LISTING](docs/09-miscellaneous/GOOGLE_PLAY_STORE_LISTING.md)
- [GOOGLE_PLAY_SUBMISSION_GUIDE](docs/09-miscellaneous/GOOGLE_PLAY_SUBMISSION_GUIDE.md)
- [ICON_IMAGE_GUIDE](docs/09-miscellaneous/ICON_IMAGE_GUIDE.md)
- [INCIDENT_AND_EMERGENCY_RESPONSE](docs/09-miscellaneous/INCIDENT_AND_EMERGENCY_RESPONSE.md)
- [PARALLEL_EXECUTION_STATUS](docs/09-miscellaneous/PARALLEL_EXECUTION_STATUS.md)
- [PRIVACY_POLICY](docs/09-miscellaneous/PRIVACY_POLICY.md)
- [ROE](docs/09-miscellaneous/ROE.md)
- [USE_NEW_ICON](docs/09-miscellaneous/USE_NEW_ICON.md)
- [VISION](docs/09-miscellaneous/VISION.md)
- [exposure_calculation_refactor](docs/09-miscellaneous/exposure_calculation_refactor.md)
- [failure_scenarios_analysis](docs/09-miscellaneous/failure_scenarios_analysis.md)
- [founder_invariant_list](docs/09-miscellaneous/founder_invariant_list.md)
- [rate_limits](docs/09-miscellaneous/rate_limits.md)
- [standardized_errors](docs/09-miscellaneous/standardized_errors.md)
- [system_introspection_queries](docs/09-miscellaneous/system_introspection_queries.md)

## ⚠️ Important: Supabase Is Forbidden

**Supabase is NOT used in this project and MUST NOT be used.**

- All Supabase code has been moved to `dormant/supabase/` and is **permanently dormant**
- Using Supabase violates core architecture constraints
- See `dormant/supabase/DO_NOT_USE.md` for detailed explanation
- **All backend development must use Convex only**

## Out of Scope (v1.x)

- Reputation systems
- Automated disputes
- Credit, loans, or financing
- SMS, USSD, or WhatsApp
- Multi-admin approval flows
- Mobile apps

## License

Private - Farm2Market Uganda
