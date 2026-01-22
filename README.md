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
- Production: Not activated (see `docs/architecture.md`)

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