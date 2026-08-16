# Negotiation UX Flow Documentation

## Overview

The negotiation system allows traders to make offers on farmer listings, and farmers to accept, reject, or counter-offer. Only after a negotiation is accepted can the trader proceed to pay-to-lock. Delivery time countdown starts from 6 hours after payment (not from negotiation acceptance).

---

## User Flow

### 1. Trader Makes an Offer

**Entry Point**: Trader views available listings in their dashboard

**Steps**:
1. Trader sees listing with:
   - Produce type and quantity
   - Farmer's asking price per kilo
   - UTID (Unique Transaction ID)
   - Available units
   - Farmer alias (anonymity preserved)

2. Trader clicks "Make Offer" button

3. Trader enters their offer price per kilo (can be same, higher, or lower than farmer's price)

4. System creates negotiation with status "pending"
   - Generates negotiation UTID
   - Links negotiation to first available unit
   - Sets 24-hour expiration timer

5. Trader sees confirmation:
   - "Offer made successfully! UTID: [negotiation-utid]. Waiting for farmer's response."

**UI Elements**:
- Offer input field (pre-filled with farmer's price)
- "Submit Offer" button
- "Cancel" button
- UTID displayed prominently

---

### 2. Farmer Views Offers

**Entry Point**: Farmer dashboard → "Active Negotiations" section

**What Farmer Sees**:
- List of all pending/countered/accepted negotiations
- For each negotiation:
  - Produce type and unit number
  - Trader alias (anonymity preserved)
  - Farmer's original price per kilo
  - Trader's offer price per kilo
  - Current negotiated price (may be counter-offer)
  - Negotiation UTID
  - Status (pending, countered, accepted)

**Status Indicators**:
- **Pending**: Yellow background - Trader made offer, waiting for farmer
- **Countered**: Yellow background - Farmer made counter-offer, waiting for trader
- **Accepted**: Green background - Offer accepted, trader can pay-to-lock

---

### 3. Farmer Responds to Offer

**Options Available**:

#### A. Accept Offer
- Farmer clicks "Accept Offer" button
- System updates negotiation status to "accepted"
- Generates acceptance UTID
- Trader receives notification (in their dashboard)
- **Result**: Trader can now proceed to pay-to-lock

#### B. Reject Offer
- Farmer clicks "Reject" button
- System updates negotiation status to "rejected"
- Unit becomes available again for other traders
- Negotiation is removed from active negotiations
- **Result**: Negotiation ends, unit available for new offers

#### C. Counter-Offer
- Farmer clicks "Counter-Offer" button
- Input field appears for farmer to enter new price
- Farmer enters counter-offer price per kilo
- Farmer clicks "Submit Counter-Offer"
- System updates negotiation:
  - Status changes to "countered"
  - Current price updated to counter-offer price
- Trader receives notification (in their dashboard)
- **Result**: Waiting for trader to accept/reject counter-offer

**UI Elements**:
- Three action buttons: Accept, Reject, Counter-Offer
- Counter-offer input field (when countering)
- Clear status indicators
- UTID displayed for audit trail

---

### 4. Trader Responds to Counter-Offer

**Entry Point**: Trader dashboard → "Your Active Negotiations" section

**What Trader Sees**:
- Negotiations with status "countered"
- Current price (farmer's counter-offer)
- Original trader offer price
- Farmer's original listing price

**Options**:

#### A. Accept Counter-Offer
- Trader clicks "Accept Counter-Offer" button
- System updates negotiation status to "accepted"
- Generates acceptance UTID
- **Result**: Trader can now proceed to pay-to-lock

#### B. Let Negotiation Expire
- If trader doesn't respond within 24 hours, negotiation expires
- Unit becomes available again
- **Result**: Negotiation ends

---

### 5. Pay-to-Lock (After Acceptance)

**Entry Point**: Trader dashboard → "Accepted Offers - Ready to Lock" section

**Prerequisites**:
- Negotiation status must be "accepted"
- Unit must still be available (not locked by another trader)

**What Trader Sees**:
- List of accepted negotiations
- For each:
  - Produce type and unit number
  - Final negotiated price per kilo
  - Total price (price × unit size)
  - Acceptance UTID
  - "Pay-to-Lock" button

**Steps**:
1. Trader clicks "Pay-to-Lock" button
2. System validates:
   - Negotiation is accepted
   - Unit is still available
   - Trader has sufficient capital
   - Trader exposure doesn't exceed cap
3. System performs atomic operation:
   - Locks capital in trader's wallet
   - Locks unit to trader
   - Generates lock UTID
   - **Sets delivery deadline: payment time + 6 hours**
4. Trader sees confirmation:
   - "Unit locked successfully! UTID: [lock-utid]"
   - Balance after payment
   - **"Delivery deadline: 6 hours from now"**

**Critical**: Delivery countdown starts from payment time, NOT from negotiation acceptance.

---

### 6. Delivery Time Countdown

**Entry Point**: Farmer dashboard → "Delivery Deadlines" section

**What Farmer Sees**:
- List of locked units awaiting delivery
- For each:
  - Produce type and quantity
  - Trader alias
  - Lock UTID
  - **Clear countdown timer showing time remaining**
  - Deadline timestamp

**Countdown Display**:
- **Format**: "X hours Y minutes remaining"
- **Color Coding**:
  - Green: Time remaining (not overdue)
  - Red: OVERDUE (past deadline)
- **Calculation**: Server-side, real-time
- **Start Time**: Payment time (when trader paid-to-lock)
- **Duration**: Exactly 6 hours

**Example Display**:
```
Maize - 10kg
Trader: Trader_ABC
Deadline: 2024-02-15 20:00:00
⏰ 4 hours 23 minutes remaining
UTID: 20240215-143022-tra-a3k9x2
```

**Overdue Display**:
```
Maize - 10kg
Trader: Trader_ABC
Deadline: 2024-02-15 20:00:00
⚠️ OVERDUE by 1.5 hours
UTID: 20240215-143022-tra-a3k9x2
```

---

## Key UX Principles

### 1. Clear Status Indicators
- Color-coded backgrounds (yellow for pending, green for accepted)
- Status text clearly displayed
- Icons where appropriate (✅ for accepted, ⚠️ for overdue)

### 2. UTID Visibility
- All UTIDs displayed prominently
- Monospace font for easy reading
- Full UTID shown (not truncated)
- UTID links negotiations to payments to deliveries

### 3. Price Transparency
- All prices shown clearly (farmer's, trader's offer, current negotiated)
- Currency formatting (UGX)
- Per-kilo and total prices displayed

### 4. Action Clarity
- Buttons clearly labeled
- Disabled states when actions unavailable
- Loading states during operations
- Success/error messages with clear text

### 5. Time Awareness
- Countdown timers prominently displayed
- Clear indication of deadline start time (payment time)
- Overdue status clearly marked
- Server-side time calculations (no client manipulation)

### 6. Anonymity Preservation
- Only aliases shown (no real identities)
- UTIDs for transaction tracking
- No personal information exposed

---

## State Transitions

### Negotiation States

```
[No Negotiation]
    ↓ (Trader makes offer)
[pending]
    ↓ (Farmer accepts)
[accepted] → (Trader pays) → [Unit Locked]
    ↓ (Farmer rejects)
[rejected] → [Unit Available]
    ↓ (Farmer counters)
[countered]
    ↓ (Trader accepts counter)
[accepted] → (Trader pays) → [Unit Locked]
    ↓ (Trader doesn't respond)
[expired] → [Unit Available]
```

### Delivery Timeline

```
[Payment Made] → [Delivery Deadline Set: Payment Time + 6 hours]
    ↓
[Countdown Active] → [Farmer Delivers] → [Admin Verifies] → [Delivered]
    ↓ (if deadline passes)
[OVERDUE] → [Admin Reviews] → [Late/Cancelled]
```

---

## Error Handling

### Common Errors and UX

1. **"No active negotiation found. Please make an offer first."**
   - Shown when trader tries to pay-to-lock without accepted negotiation
   - **Action**: Trader must make offer and wait for acceptance

2. **"Cannot lock unit. Negotiation status is: [status]"**
   - Shown when negotiation not yet accepted
   - **Action**: Wait for farmer to accept offer

3. **"This negotiation belongs to another trader."**
   - Shown when trader tries to lock unit from another trader's negotiation
   - **Action**: Make your own offer

4. **"No available units found for this listing"**
   - Shown when all units are locked
   - **Action**: Look for other listings

5. **"Please enter a valid price per kilo"**
   - Shown when offer/counter-offer price is invalid
   - **Action**: Enter positive number

---

## Mobile Responsiveness

All UI elements use responsive design:
- Font sizes: `clamp()` for scaling
- Padding: `clamp()` for spacing
- Grid layouts: `repeat(auto-fit, minmax(...))` for flexible columns
- Buttons: Full width on mobile, auto width on desktop
- Text: Word-break for long UTIDs

---

## Accessibility

- Clear color contrast for status indicators
- Text labels for all buttons
- Error messages in plain language
- UTIDs in monospace for readability
- Time information in multiple formats (hours, minutes, timestamp)

---

## Testing Checklist

- [ ] Trader can make offer on available listing
- [ ] Farmer sees offer in negotiations list
- [ ] Farmer can accept offer
- [ ] Farmer can reject offer
- [ ] Farmer can counter-offer
- [ ] Trader sees counter-offer
- [ ] Trader can accept counter-offer
- [ ] Trader can pay-to-lock after acceptance
- [ ] Delivery countdown starts from payment time (6 hours)
- [ ] Countdown displays correctly (hours and minutes)
- [ ] Overdue status shows correctly
- [ ] UTIDs displayed throughout flow
- [ ] Error messages are clear and actionable
- [ ] Mobile layout works correctly
- [ ] Status indicators are color-coded correctly

---

## Future Enhancements

1. **Negotiation Expiration Notifications**
   - Notify traders when negotiations are about to expire
   - Notify farmers when offers are about to expire

2. **Negotiation History**
   - View past negotiations (accepted, rejected, expired)
   - Track negotiation patterns

3. **Bulk Negotiations**
   - Make offers on multiple units at once
   - Accept/reject multiple offers

4. **Negotiation Analytics**
   - Average time to acceptance
   - Most common counter-offer patterns
   - Success rate of negotiations

---

## Related Documentation

- [Farmer Dashboard Queries](./farmer_dashboard_queries.md)
- [Trader Dashboard Queries](./trader_dashboard_queries.md)
- [Delivery SLA Tracking](./delivery_sla_tracking.md)
- [Pay-to-Lock System](../BUSINESS_LOGIC.md#workflow-4-trader-unit-lock-pay-to-lock)
