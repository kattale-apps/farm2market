# Sentify FarmCoin Test Plan

## Purpose
Validate buyer and trader delivery confirmation flow, escrow release, Sentify receipt creation, and buyer reward cash-out using existing FarmCoin pricing. Ensure superadmin approvals, audit logs, and notifications work as specified.

## Scope
- Buyer sees trader listings and purchases fixed-price units
- Buyer escrow lock holds funds until confirmations
- Trader confirms delivery per batch UTID
- Buyer confirms delivery per purchase UTID (optional)
- Superadmin confirms delivery per batch UTID (required)
- Escrow releases to trader wallet on superadmin confirm
- Sentify receipt token generated per batch UTID
- Buyer confirmation reward token generated per purchase
- Immediate cash-out from Sentify and buyer reward receipts
- Superadmin inbox receives Pending Sentify Request notification

## Preconditions
- SystemSettings has FarmCoin pricing (used as cash-out rate)
- Buyer wallet has sufficient capital deposit
- Trader listings exist (trader-sourced)
- Purchase window is open
- Superadmin account is available

## Test Data
- Buyer account: `buyer_test`
- Trader account: `trader_test`
- Superadmin account: `admin_super`
- Listing: trader-sourced, fixed price, known ETA

## Test Cases

### 1. Buyer sees separate trader listings
**Steps**
1. Open buyer dashboard
2. Locate “Trader-sourced Listings (Fixed Price)” section
3. Verify listings show UTID, product, units, unit size, price per unit, ETA

**Expected**
- Trader listings are visible and separate from farmer inventory
- Fixed prices are shown for trader listings

### 2. Buyer purchases trader listing units
**Steps**
1. Select a listing
2. Enter unit count <= available units
3. Submit purchase

**Expected**
- Purchase succeeds and returns UTID
- Listing available units reduced
- Buyer wallet ledger shows `capital_lock`

### 3. Trader confirms delivery per batch UTID
**Steps**
1. Open trader dashboard
2. Go to “Delivery Confirmations”
3. Confirm delivery for batch UTID

**Expected**
- Trader confirmation saved
- Buyer sees trader-confirmed status

### 4. Buyer confirms delivery (reward token)
**Steps**
1. Open buyer dashboard
2. Go to “Trader Listing Orders”
3. Confirm delivery on order

**Expected**
- Buyer confirmation saved
- Buyer reward token created and appears in buyer reward wallet

### 5. Superadmin confirms delivery (required)
**Steps**
1. Open finance dashboard
2. Select batch UTID(s)
3. Confirm selected deliveries

**Expected**
- Escrow released to trader wallet
- Sentify receipt token created per batch UTID
- Buyer reward created if missing (override)

### 6. Sentify receipt appears in admin export
**Steps**
1. Export FarmCoin ledger from finance dashboard

**Expected**
- “Sentify Wallet” sheet exists with receipt entries

### 7. Trader cash-out
**Steps**
1. Open trader dashboard
2. Select Sentify receipt
3. Enter phone number, click Sentify Cash-out

**Expected**
- Cash-out succeeds, Sentify balance decreases
- Admin action logged
- Superadmin gets “Pending Sentify Request” notification

### 8. Buyer cash-out
**Steps**
1. Open buyer dashboard
2. Select reward receipt
3. Enter phone number, click Sentify Cash-out

**Expected**
- Cash-out succeeds, reward balance decreases
- Admin action logged
- Superadmin gets “Pending Sentify Request” notification

## Edge Cases
- Attempt superadmin confirmation without trader confirmation → blocked
- Attempt buyer confirmation before trader confirmation → blocked
- Attempt cash-out on same receipt twice → blocked
- Attempt cash-out with missing phone number → blocked

## Post-Conditions
- All ledger entries are auditable by UTID
- Notifications are visible in superadmin inbox
- No negative balances or partial releases