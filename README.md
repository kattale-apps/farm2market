# Farm2Market Uganda

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
my-app/
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

**See `docs/deployment_modes_setup.md` for complete setup instructions.**

### Quick Setup

1. **Create two Convex deployments** (pilot and dev)
2. **Create two Vercel projects** (pilot and dev)
3. **Configure environment variables**:
   - Pilot: `NEXT_PUBLIC_CONVEX_URL` (pilot Convex URL), `NEXT_PUBLIC_DEPLOYMENT_MODE=pilot`
   - Dev: `NEXT_PUBLIC_CONVEX_URL` (dev Convex URL), `NEXT_PUBLIC_DEPLOYMENT_MODE=dev`

## Setup

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
   - See `docs/setup_convex.md` for detailed instructions

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
- **`CURSOR_RULES.md`** - Detailed documentation of all rules and invariants

**Key Principles**:

- Preserve invariants above all else
- File-scope changes only (ask before modifying multiple files)
- Planning first, coding second
- No "helpful" refactors without explicit request
- Reference existing documentation (`INVARIANTS.md`, `architecture.md`, etc.)

**Admin Hierarchy**:

- **StoreAdmin** (`adminLevel === "junior"`): Confirms delivery for assigned storage locations only
- **SuperAdmin** (`adminLevel === "super"` or `undefined`): Full governance and oversight powers

See `CURSOR_RULES.md` for complete rules and guidelines.

## Current Status

- Status: Project restructured for Convex backend
- Environment: Local development setup
- Backend: **Convex ONLY** (Supabase is FORBIDDEN - see `dormant/supabase/DO_NOT_USE.md`)
- Production: Not activated (see [architecture](docs/architecture.md))

## 📚 Documentation

Complete documentation index organized by topic:

### Architecture & Design

- [AUDIT_MODEL](docs/AUDIT_MODEL.md)
- [BUSINESS_LOGIC](docs/BUSINESS_LOGIC.md)
- [DOMAIN_MODEL](docs/DOMAIN_MODEL.md)
- [FINANCIAL_INTEGRATION_MODEL](docs/FINANCIAL_INTEGRATION_MODEL.md)
- [INVARIANTS](docs/INVARIANTS.md)
- [MODULARITY_GUIDE](docs/MODULARITY_GUIDE.md)
- [OBSERVABILITY_MODEL](docs/OBSERVABILITY_MODEL.md)
- [THREAT_MODEL](docs/THREAT_MODEL.md)
- [architecture](docs/architecture.md)
- [audit_non_negotiable_rules](docs/audit_non_negotiable_rules.md)

### Setup & Deployment

- [ACTION_PLAN_DEV_SETUP](docs/ACTION_PLAN_DEV_SETUP.md)
- [BILLING_SETUP](docs/BILLING_SETUP.md)
- [CLOUD_FUNCTION_SETUP](docs/CLOUD_FUNCTION_SETUP.md)
- [DEPLOYMENT_CHECKLIST](docs/DEPLOYMENT_CHECKLIST.md)
- [DEPLOYMENT_GUIDE](docs/DEPLOYMENT_GUIDE.md)
- [DEPLOYMENT_STATUS](docs/DEPLOYMENT_STATUS.md)
- [DEPLOY_KEY_SETUP](docs/DEPLOY_KEY_SETUP.md)
- [DEPLOY_NOW](docs/DEPLOY_NOW.md)
- [DEV_DEPLOYMENT_COMPLETE](docs/DEV_DEPLOYMENT_COMPLETE.md)
- [DEV_SETUP_FINAL_STATUS](docs/DEV_SETUP_FINAL_STATUS.md)
- [DEV_SETUP_STATUS](docs/DEV_SETUP_STATUS.md)
- [FCM_SETUP_COMPLETE](docs/FCM_SETUP_COMPLETE.md)
- [FIREBASE_SETUP_INSTRUCTIONS](docs/FIREBASE_SETUP_INSTRUCTIONS.md)
- [GET_DEV_DEPLOY_KEY](docs/GET_DEV_DEPLOY_KEY.md)
- [GOOGLE_PLAY_STORE_SETUP](docs/GOOGLE_PLAY_STORE_SETUP.md)
- [PESAPAL_SETUP](docs/PESAPAL_SETUP.md)
- [PUSH_NOTIFICATIONS_SETUP](docs/PUSH_NOTIFICATIONS_SETUP.md)
- [QUICK_DEPLOY](docs/QUICK_DEPLOY.md)
- [QUICK_FIREBASE_SETUP](docs/QUICK_FIREBASE_SETUP.md)
- [QUICK_START_DEV](docs/QUICK_START_DEV.md)
- [SAFE_SETUP_COMPLETE](docs/SAFE_SETUP_COMPLETE.md)
- [VERCEL_CLI_SETUP](docs/VERCEL_CLI_SETUP.md)
- [VERCEL_DEV_SETUP](docs/VERCEL_DEV_SETUP.md)
- [VERCEL_DEV_SETUP_SIMPLE](docs/VERCEL_DEV_SETUP_SIMPLE.md)
- [current_deployment_status](docs/current_deployment_status.md)
- [deployment_modes_quick_reference](docs/deployment_modes_quick_reference.md)
- [deployment_modes_setup](docs/deployment_modes_setup.md)
- [dev_deployment_info](docs/dev_deployment_info.md)
- [env-examples](docs/env-examples.md)
- [pilot_setup_guide](docs/pilot_setup_guide.md)
- [setup_convex](docs/setup_convex.md)
- [setup_dev_mode](docs/setup_dev_mode.md)
- [troubleshooting_convex](docs/troubleshooting_convex.md)
- [vercel_env_setup](docs/vercel_env_setup.md)

### Development & Implementation

- [AUTHENTICATION_IMPLEMENTATION_DECISION](docs/AUTHENTICATION_IMPLEMENTATION_DECISION.md)
- [BLOCKED7_PHASE5_CONSENT_AND_ACCEPTANCE_IMPLEMENTATION_SPEC](docs/BLOCKED7_PHASE5_CONSENT_AND_ACCEPTANCE_IMPLEMENTATION_SPEC.md)
- [COMMUNITY_APK_IMPLEMENTATION_GUIDE](docs/COMMUNITY_APK_IMPLEMENTATION_GUIDE.md)
- [IMPLEMENTATION_BOUNDARIES](docs/IMPLEMENTATION_BOUNDARIES.md)
- [IMPLEMENTATION_SEQUENCE](docs/IMPLEMENTATION_SEQUENCE.md)
- [IMPLEMENTATION_SUMMARY](docs/IMPLEMENTATION_SUMMARY.md)
- [buyer_purchase_implementation](docs/buyer_purchase_implementation.md)
- [project_reorganization](docs/project_reorganization.md)

### Blocking Issues & Resolution

- [BACKFILL_LOCATION_DATA_PLAN](docs/BACKFILL_LOCATION_DATA_PLAN.md)
- [BLOCKED1_AUTHORIZATION_HANDOFF](docs/BLOCKED1_AUTHORIZATION_HANDOFF.md)
- [BLOCKED1_EXECUTION_KICKOFF](docs/BLOCKED1_EXECUTION_KICKOFF.md)
- [BLOCKED1_PHASE1_CODE_VERIFICATION_REPORT](docs/BLOCKED1_PHASE1_CODE_VERIFICATION_REPORT.md)
- [BLOCKED1_PHASE3_TESTING_RESULTS_REPORT](docs/BLOCKED1_PHASE3_TESTING_RESULTS_REPORT.md)
- [BLOCKED1_PHASE4_OBSERVABILITY_VERIFICATION_REPORT](docs/BLOCKED1_PHASE4_OBSERVABILITY_VERIFICATION_REPORT.md)
- [BLOCKED5_AUTHORIZATION_HANDOFF](docs/BLOCKED5_AUTHORIZATION_HANDOFF.md)
- [BLOCKED5_PHASE1_CODE_VERIFICATION_REPORT](docs/BLOCKED5_PHASE1_CODE_VERIFICATION_REPORT.md)
- [BLOCKED5_PHASE3_TESTING_RESULTS_REPORT](docs/BLOCKED5_PHASE3_TESTING_RESULTS_REPORT.md)
- [BLOCKED5_PHASE4_OBSERVABILITY_VERIFICATION_REPORT](docs/BLOCKED5_PHASE4_OBSERVABILITY_VERIFICATION_REPORT.md)
- [BLOCKED6_AUTHORIZATION_COMPLETION](docs/BLOCKED6_AUTHORIZATION_COMPLETION.md)
- [BLOCKED6_AUTHORIZATION_HANDOFF](docs/BLOCKED6_AUTHORIZATION_HANDOFF.md)
- [BLOCKED6_LEGAL_COUNSEL_ENGAGEMENT](docs/BLOCKED6_LEGAL_COUNSEL_ENGAGEMENT.md)
- [BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT](docs/BLOCKED6_PHASE2_LEGAL_REVIEW_REPORT.md)
- [BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT](docs/BLOCKED6_PHASE3_REGULATORY_VERIFICATION_REPORT.md)
- [BLOCKED7_AUTHORIZATION_HANDOFF](docs/BLOCKED7_AUTHORIZATION_HANDOFF.md)
- [BLOCKED7_PHASE1_INITIATION_AND_SCOPE](docs/BLOCKED7_PHASE1_INITIATION_AND_SCOPE.md)
- [BLOCKED7_PHASE2_CLAUSE_SCAFFOLDING](docs/BLOCKED7_PHASE2_CLAUSE_SCAFFOLDING.md)
- [BLOCKED7_PHASE3_TERMS_OF_SERVICE_DRAFTING](docs/BLOCKED7_PHASE3_TERMS_OF_SERVICE_DRAFTING.md)
- [BLOCKED7_PHASE4_USER_AGREEMENTS_DRAFTING](docs/BLOCKED7_PHASE4_USER_AGREEMENTS_DRAFTING.md)
- [BLOCKED8_AUTHORIZATION_HANDOFF](docs/BLOCKED8_AUTHORIZATION_HANDOFF.md)
- [BLOCKED8_EXECUTION_KICKOFF](docs/BLOCKED8_EXECUTION_KICKOFF.md)
- [CRITICAL_BLOCKED_CAPABILITY_RESOLUTION_PLAN](docs/CRITICAL_BLOCKED_CAPABILITY_RESOLUTION_PLAN.md)
- [CRITICAL_CAPABILITY_EXECUTION_PLAN](docs/CRITICAL_CAPABILITY_EXECUTION_PLAN.md)
- [FINANCIAL_INTELLIGENCE_LAYER_TEST_PLAN](docs/FINANCIAL_INTELLIGENCE_LAYER_TEST_PLAN.md)
- [GO_LIVE_BLOCKER_RESOLUTION_PLAN](docs/GO_LIVE_BLOCKER_RESOLUTION_PLAN.md)

### Go Live & Production

- [FIX_PRODUCTION_BRANCH](docs/FIX_PRODUCTION_BRANCH.md)
- [GLOBAL_GO_LIVE_AUTHORIZATION](docs/GLOBAL_GO_LIVE_AUTHORIZATION.md)
- [GO_LIVE_READINESS](docs/GO_LIVE_READINESS.md)
- [POST_GO_LIVE_UI_CHANGE_POLICY](docs/POST_GO_LIVE_UI_CHANGE_POLICY.md)
- [PRODUCTION_ACTIVATION](docs/PRODUCTION_ACTIVATION.md)
- [PRODUCTION_AUTHENTICATION_SPECIFICATION](docs/PRODUCTION_AUTHENTICATION_SPECIFICATION.md)
- [PRODUCTION_AUTHORIZATION](docs/PRODUCTION_AUTHORIZATION.md)
- [PRODUCTION_OPERATION](docs/PRODUCTION_OPERATION.md)
- [SYSTEM_ACTIVATION_AND_GO_LIVE_CONTROLS](docs/SYSTEM_ACTIVATION_AND_GO_LIVE_CONTROLS.md)
- [SYSTEM_ACTIVATION_READINESS_REVIEW](docs/SYSTEM_ACTIVATION_READINESS_REVIEW.md)
- [day66_pre_activation](docs/day66_pre_activation.md)
- [day67_production_activation](docs/day67_production_activation.md)
- [go_live_checklist](docs/go_live_checklist.md)

### Admin & Operations

- [ADMIN_ROLES_AND_DASHBOARD_RULES](docs/ADMIN_ROLES_AND_DASHBOARD_RULES.md)
- [admin_delivery_verification](docs/admin_delivery_verification.md)
- [admin_operations_playbook](docs/admin_operations_playbook.md)
- [admin_red_flags](docs/admin_red_flags.md)
- [delivery_failure_reversal](docs/delivery_failure_reversal.md)
- [delivery_sla_tracking](docs/delivery_sla_tracking.md)

### Features & Specifications

- [MARKET_PRICES_FEATURE_RELEASE](docs/MARKET_PRICES_FEATURE_RELEASE.md)
- [PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT](docs/PILOT_MODE_ENFORCEMENT_VERIFICATION_REPORT.md)
- [buyer_dashboard_queries](docs/buyer_dashboard_queries.md)
- [farmer_dashboard_queries](docs/farmer_dashboard_queries.md)
- [negotiation_ux_flow](docs/negotiation_ux_flow.md)
- [notifications](docs/notifications.md)
- [onboarding_buyers](docs/onboarding_buyers.md)
- [onboarding_farmers](docs/onboarding_farmers.md)
- [onboarding_traders](docs/onboarding_traders.md)
- [pilot_configuration](docs/pilot_configuration.md)
- [pilot_mode](docs/pilot_mode.md)
- [pilot_simulation](docs/pilot_simulation.md)
- [trader_dashboard_queries](docs/trader_dashboard_queries.md)

### Testing & Verification

- [AGROFRESH_UG_COMMUNITY_TEST_SCRIPT](docs/AGROFRESH_UG_COMMUNITY_TEST_SCRIPT.md)
- [BACKUP_AND_RESTORE_VERIFICATION_REPORT](docs/BACKUP_AND_RESTORE_VERIFICATION_REPORT.md)
- [PENTEST_REPORT_TEMPLATE](docs/PENTEST_REPORT_TEMPLATE.md)

### Miscellaneous

- [APP_ICON_SUMMARY](docs/APP_ICON_SUMMARY.md)
- [BILLING_REQUIRED](docs/BILLING_REQUIRED.md)
- [BUILD_APK_GUIDE](docs/BUILD_APK_GUIDE.md)
- [COMMUNITY_APK_SUMMARY](docs/COMMUNITY_APK_SUMMARY.md)
- [CURSOR_RULES](docs/CURSOR_RULES.md)
- [EXECUTION_AUTHORIZATION_AND_KICKOFF](docs/EXECUTION_AUTHORIZATION_AND_KICKOFF.md)
- [GOOGLE_PLAY_STORE_LISTING](docs/GOOGLE_PLAY_STORE_LISTING.md)
- [GOOGLE_PLAY_SUBMISSION_GUIDE](docs/GOOGLE_PLAY_SUBMISSION_GUIDE.md)
- [ICON_IMAGE_GUIDE](docs/ICON_IMAGE_GUIDE.md)
- [INCIDENT_AND_EMERGENCY_RESPONSE](docs/INCIDENT_AND_EMERGENCY_RESPONSE.md)
- [PARALLEL_EXECUTION_STATUS](docs/PARALLEL_EXECUTION_STATUS.md)
- [PRIVACY_POLICY](docs/PRIVACY_POLICY.md)
- [ROE](docs/ROE.md)
- [USE_NEW_ICON](docs/USE_NEW_ICON.md)
- [VISION](docs/VISION.md)
- [exposure_calculation_refactor](docs/exposure_calculation_refactor.md)
- [failure_scenarios_analysis](docs/failure_scenarios_analysis.md)
- [founder_invariant_list](docs/founder_invariant_list.md)
- [rate_limits](docs/rate_limits.md)
- [standardized_errors](docs/standardized_errors.md)
- [system_introspection_queries](docs/system_introspection_queries.md)

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
