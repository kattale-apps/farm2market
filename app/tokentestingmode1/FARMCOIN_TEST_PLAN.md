# FarmCoin Token Test Plan (Mode 1)

## Purpose
Validate the full FarmCoin economic flow end-to-end:
- Superadmin grants tokens to a trader
- Trader spends a token
- Token returns to the central ledger
- Ledger invariants remain correct
- Overspend is blocked
- Product flow (listing post) triggers FarmCoin spend

## Scope
- Automated Convex script test (required)
- Product-flow spend via trader listing post (primary)
- Optional ETA change scenario (follow-up)
- Manual UI validation checklist

## Safety Rules (Non‑negotiable)
- Test utilities must refuse production environments.
- Only `isTestUser: true` accounts are used.
- Cleanup/reset only affects test users and their data.
- Dry-run mode must be available for destructive actions.
- All destructive operations must be explicitly flagged.

## Automated Test (Convex Script)
### Entry Point
- Script: scripts/run_farmcoin_test.js
- Convex mutation: farmcoinTest:runFarmcoinTokenTest

### Required Guards
- Abort when NODE_ENV is production
- Require `--env=dev` or `--env=test`

### Seed Users (Main Users Table)
- superadmin_test@local (role: admin, adminLevel: super, isTestUser: true)
- trader_test@local (role: trader, verified, isTestUser: true)

### Default Behavior
- Persist test users for repeatable runs

### Cleanup / Reset Modes
- `--reset-ledger`: clears FarmCoin ledger entries tied to test users
- `--reset-listings`: removes test listings, listing units, and inventories for test users
- `--cleanup`: deletes test users and their data (dev/test only)
- `--dry-run`: prints counts without deletion

## Automated Assertions (Layer A: Economic correctness)
- Grant increases trader balance by grant amount
- Spend reduces trader balance by spend amount
- Central balance decreases on grant, increases on spend
- Total supply conserved across grant/spend
- Overspend throws an error

## Automated Assertions (Layer B: Product flow)
- Create inventory lot for test trader
- Create trader listing from inventory
- FarmCoin posting cost is charged
- Ledger entry exists for posting cost

## Manual UI Checklist
### Admin (Superadmin)
- Grant tokens to trader
- Trader appears in grant dropdown
- Ledger shows grant entry
- Central pool balance updates

### Trader
- Balance updates after grant
- Posting a listing spends FarmCoin
- Balance updates after spend
- Ledger entry visible in dashboard
- Cancel before payment lock does **not** spend FarmCoin

## Optional Follow-up Test
- ETA change triggers FarmCoin spend
- Ledger and balances update as expected

## Example Usage
- Run test: npm run test:farmcoin -- --env=dev
- Reset ledger only: npm run test:farmcoin -- --env=dev --reset-ledger
- Cleanup all test data: npm run test:farmcoin -- --env=dev --cleanup --cleanup-only
- Dry-run cleanup: npm run test:farmcoin -- --env=dev --cleanup --cleanup-only --dry-run

## Reporting
Record:
- Test run timestamp
- Seeded user IDs
- Pre/post balances
- Listing ID created
- Any failures or exceptions
