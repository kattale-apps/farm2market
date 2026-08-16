# Project Reorganization Summary

**Date**: Project restructured according to Convex-based architecture

## Changes Made

### 1. Backend Migration
- **From**: Supabase (dormant)
- **To**: Convex (active)
- **Location**: All Supabase code moved to `dormant/supabase/`
- **Active Backend**: `convex/` directory

### 2. Project Structure

#### Created:
- `app/` - Next.js App Router structure
  - `layout.tsx` - Root layout
  - `page.tsx` - Home page
  - `globals.css` - Global styles

- `convex/` - Convex backend (schema-first design)
  - `schema.ts` - Complete database schema with all tables
  - `auth.ts` - User authentication & role enforcement
  - `wallet.ts` - Closed loop wallet system
  - `listings.ts` - Farmer listings (auto-split into 10kg units)
  - `payments.ts` - Atomic pay-to-lock system
  - `admin.ts` - Admin authority & purchase windows
  - `utils.ts` - UTID generation, exposure calculations
  - `constants.ts` - System constants (spend caps, SLAs, etc.)

- Configuration files:
  - `package.json` - Next.js + Convex dependencies
  - `tsconfig.json` - TypeScript configuration
  - `next.config.js` - Next.js configuration (Vercel-compatible)
  - `convex.json` - Convex configuration
  - `.gitignore` - Updated for Next.js + Convex

#### Moved to Dormant:
- `supabase/` → `dormant/supabase/`
- Old `index.html` → Deleted (replaced by Next.js)

### 3. Core Features Implemented

#### Schema (convex/schema.ts)
- `users` - User roles (farmer, trader, buyer, admin)
- `walletLedger` - Closed loop wallet system
- `listings` - Farmer produce listings
- `listingUnits` - 10kg units (auto-split)
- `traderInventory` - 100kg blocks for buyers
- `purchaseWindows` - Admin-controlled buying windows
- `buyerPurchases` - Buyer transactions
- `storageFeeDeductions` - Storage fee tracking
- `adminActions` - Admin action log
- `notifications` - Internal notifications

#### Business Logic
- **Anonymity**: System-generated aliases (no real identities)
- **UTID**: Every action generates/references a UTID
- **Spend Cap**: UGX 1,000,000 max trader exposure (enforced atomically)
- **Pay-to-Lock**: Atomic unit locking + wallet debit
- **Role Enforcement**: Server-side only (never trust client)
- **Admin Authority**: Final decisions, all actions logged

### 4. Architecture Compliance

✅ **Backend**: Convex only (no Supabase/Firebase/SQL)  
✅ **Framework**: Next.js App Router  
✅ **Language**: TypeScript everywhere  
✅ **Schema**: Schema-first design  
✅ **Deployment**: Vercel-compatible  

### 5. Next Steps

1. **Setup Convex**:
   ```bash
   npx convex dev
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start development**:
   ```bash
   npm run dev
   ```

4. **Review schema**: Check `convex/schema.ts` for all table definitions

5. **Implement remaining features**:
   - Storage fee calculations
   - Buyer purchase flow
   - Delivery/pickup SLA tracking
   - Notification system

## Files to Review

- `README.md` - Updated with new architecture
- `convex/schema.ts` - Complete database schema
- `convex/payments.ts` - Critical pay-to-lock atomic operation
- `convex/wallet.ts` - Wallet system implementation
- `docs/architecture.md` - System governance (unchanged)

## Notes

- All business logic lives in Convex functions
- No client-side role assumptions - always verify server-side
- UTID generation is centralized in `convex/utils.ts`
- Spend cap enforcement happens BEFORE payment (see `convex/payments.ts`)
- Admin actions are always logged with UTID and reason
