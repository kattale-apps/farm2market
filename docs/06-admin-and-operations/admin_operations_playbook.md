# Admin Operations Playbook - Farm2Market Uganda v1

## Overview

This playbook provides step-by-step procedures for admins to handle common operational scenarios in Farm2Market Uganda v1. Follow these procedures consistently to ensure fair, transparent, and auditable operations.

**Critical Rule**: All admin actions must be logged with UTID, reason, and timestamp. No exceptions.

---

## Table of Contents

1. [Late Deliveries](#late-deliveries)
2. [Failed Deliveries](#failed-deliveries)
3. [Trader Spend Cap Disputes](#trader-spend-cap-disputes)
4. [Buyer Pickup Delays](#buyer-pickup-delays)
5. [Delivery Verification Guidelines](#delivery-verification-guidelines)
6. [Transaction Reversal Guidelines](#transaction-reversal-guidelines)
7. [Admin Reason Code Guidelines](#admin-reason-code-guidelines)
8. [What Admins Must NEVER Do](#what-admins-must-never-do)

---

## Late Deliveries

### Definition

A delivery is considered **late** when:
- The `deliveryDeadline` has passed (6 hours after payment)
- The `deliveryStatus` is still `"pending"` (not yet verified)
- The farmer has not delivered the produce

### Detection

**Query**: `getDeliveriesPastSLA` (from `convex/adminRedFlags.ts`)

**What to Look For**:
- Units with `hoursOverdue > 0`
- `deliveryStatus = "pending"`
- `status = "locked"`

### Procedure

#### Step 1: Investigate

1. **Query Delivery Status**
   ```
   Use: getDeliverySLAStatus
   Filter: status = "late" or deliveryStatus = "pending" with past deadline
   ```

2. **Review Transaction Details**
   - Check `lockUtid` (payment UTID)
   - Check `lockedAt` timestamp
   - Check `deliveryDeadline` timestamp
   - Calculate hours overdue

3. **Check for Communication**
   - Review notifications sent to farmer
   - Check if farmer was notified of deadline
   - Verify farmer received payment confirmation

4. **Review Related Transactions**
   - Check if farmer has other active deliveries
   - Check farmer's delivery history
   - Check if this is a pattern or one-time issue

#### Step 2: Contact Farmer (If Appropriate)

1. **Send UTID-Specific Notification**
   ```
   Use: sendUTIDSpecificNotification
   Target UTID: [lockUtid]
   Title: "Delivery Deadline Approaching/Passed"
   Message: "Your delivery deadline for transaction [lockUtid] has passed. Please contact support immediately to resolve this issue."
   Reason: "Notify farmer of late delivery - [lockUtid]"
   ```

2. **Wait for Response** (if within reasonable time)
   - Allow 1-2 hours for farmer response
   - If no response, proceed to verification

#### Step 3: Verify Delivery

**Use**: `verifyDelivery` mutation

**Decision Matrix**:

| Situation | Outcome | Reason Code |
|-----------|---------|-------------|
| Farmer delivered, admin verified | `"delivered"` | "Farmer delivered on time, verified by admin" |
| Farmer delivered late but within tolerance | `"delivered"` | "Farmer delivered [X] hours late, within acceptable tolerance" |
| Farmer delivered but very late (>12 hours) | `"late"` | "Farmer delivered [X] hours late, exceeds acceptable tolerance" |
| Farmer did not deliver | `"late"` | "Farmer did not deliver within 6-hour SLA, no communication received" |
| Farmer cancelled delivery | `"cancelled"` | "Farmer cancelled delivery, reason: [farmer's reason]" |

**Example**:
```typescript
await verifyDelivery({
  adminId: "admin123",
  lockUtid: "20240215-143022-tra-a3k9x2",
  outcome: "late", // or "delivered" or "cancelled"
  reason: "Farmer did not deliver within 6-hour SLA. Deadline: 2024-02-15T20:30:22Z, Current: 2024-02-16T02:30:22Z (6 hours overdue). No communication received from farmer."
});
```

#### Step 4: Reverse Transaction (If Delivery Failed)

**Only if**: `deliveryStatus = "late"` or `"cancelled"`

**Use**: `reverseDeliveryFailure` mutation

**Example**:
```typescript
await reverseDeliveryFailure({
  adminId: "admin123",
  lockUtid: "20240215-143022-tra-a3k9x2",
  reason: "Delivery failed - farmer did not deliver within SLA. Capital unlocked and unit made available again. Trader notified."
});
```

**What Happens**:
- Capital unlocked in trader's wallet
- Unit unlocked (status → "available")
- Transaction marked as failed
- All actions logged with UTIDs

#### Step 5: Notify Affected Parties

1. **Notify Trader**
   ```
   Use: sendUTIDSpecificNotification
   Target UTID: [lockUtid]
   Title: "Delivery Verification Complete"
   Message: "Delivery for transaction [lockUtid] has been verified as [outcome]. [Additional details]."
   Reason: "Notify trader of delivery verification - [lockUtid]"
   ```

2. **Notify Farmer** (if applicable)
   ```
   Use: sendUTIDSpecificNotification
   Target UTID: [lockUtid]
   Title: "Delivery Status Update"
   Message: "Your delivery for transaction [lockUtid] has been verified as [outcome]. [Additional details]."
   Reason: "Notify farmer of delivery verification - [lockUtid]"
   ```

---

## Failed Deliveries

### Definition

A delivery is considered **failed** when:
- Farmer cannot or will not deliver
- Produce quality is unacceptable
- Delivery location is incorrect or inaccessible
- Other circumstances prevent successful delivery

### Detection

**Query**: `getDeliveriesPastSLA` or `getDeliverySLAStatus`

**What to Look For**:
- Units with `deliveryStatus = "pending"` past deadline
- Farmer communication indicating failure
- Quality issues reported
- Location issues

### Procedure

#### Step 1: Investigate Failure

1. **Review Transaction Details**
   - Check `lockUtid`
   - Check `deliveryDeadline`
   - Check hours overdue

2. **Gather Information**
   - Farmer's reason (if provided)
   - Trader's report (if any)
   - Quality issues (if any)
   - Location issues (if any)
   - Communication history

3. **Determine Failure Type**
   - **Farmer-initiated**: Farmer cannot/will not deliver
   - **Quality issue**: Produce quality unacceptable
   - **Location issue**: Delivery location inaccessible
   - **Other**: Circumstances beyond control

#### Step 2: Verify Delivery as Failed

**Use**: `verifyDelivery` mutation

**Outcome**: `"cancelled"` (for failed deliveries)

**Reason Code Examples**:

| Failure Type | Reason Code |
|--------------|-------------|
| Farmer cannot deliver | "Delivery cancelled - farmer unable to deliver. Reason: [farmer's reason]. Capital unlocked." |
| Quality issue | "Delivery cancelled - produce quality unacceptable. Trader reported quality issues. Capital unlocked." |
| Location issue | "Delivery cancelled - delivery location inaccessible. [Details]. Capital unlocked." |
| Farmer no-show | "Delivery cancelled - farmer did not deliver and did not communicate. Capital unlocked." |

**Example**:
```typescript
await verifyDelivery({
  adminId: "admin123",
  lockUtid: "20240215-143022-tra-a3k9x2",
  outcome: "cancelled",
  reason: "Delivery cancelled - farmer unable to deliver. Farmer reported: 'Vehicle breakdown, cannot deliver today.' Capital unlocked and unit made available again."
});
```

#### Step 3: Reverse Transaction

**Use**: `reverseDeliveryFailure` mutation

**Example**:
```typescript
await reverseDeliveryFailure({
  adminId: "admin123",
  lockUtid: "20240215-143022-tra-a3k9x2",
  reason: "Delivery failed - farmer unable to deliver. Capital unlocked (UGX [amount]) and unit made available again. Trader and farmer notified."
});
```

#### Step 4: Notify Affected Parties

1. **Notify Trader**
   ```
   Title: "Delivery Cancelled"
   Message: "The delivery for transaction [lockUtid] has been cancelled. Your capital (UGX [amount]) has been unlocked and is available in your wallet. The unit has been made available again."
   ```

2. **Notify Farmer**
   ```
   Title: "Delivery Cancelled"
   Message: "The delivery for transaction [lockUtid] has been cancelled. The unit has been made available again. [Additional details]."
   ```

---

## Trader Spend Cap Disputes

### Definition

A trader disputes that they have exceeded their spend cap (UGX 1,000,000) or believes the calculation is incorrect.

### Detection

**Query**: `getTradersNearSpendCap` (from `convex/adminRedFlags.ts`)

**What to Look For**:
- Traders with `exposurePercent >= 80%`
- Traders reporting they cannot make purchases
- Traders questioning exposure calculation

### Procedure

#### Step 1: Investigate Dispute

1. **Query Trader Exposure**
   ```
   Use: getUserRateLimitStatus (for exposure) or calculateTraderExposure
   Trader ID: [traderId]
   ```

2. **Review Exposure Breakdown**
   - `lockedCapital`: Capital locked in pending transactions
   - `lockedOrdersValue`: Value of locked units
   - `inventoryValue`: Value of inventory in storage
   - `totalExposure`: Sum of above
   - `spendCap`: UGX 1,000,000
   - `remainingCapacity`: Available capacity

3. **Verify Calculation**
   - Check all locked units
   - Check all inventory
   - Verify calculations match exposure breakdown
   - Check for any anomalies

4. **Review Transaction History**
   - Check recent transactions
   - Check for duplicate locks
   - Check for stuck transactions
   - Check for reversals that didn't complete

#### Step 2: Identify Issue

**Common Issues**:

| Issue | Cause | Resolution |
|-------|-------|------------|
| Stuck transactions | Delivery not verified, capital still locked | Verify delivery or reverse transaction |
| Duplicate locks | System bug (should not happen) | Investigate and fix |
| Inventory value incorrect | Inventory calculation error | Verify inventory calculations |
| Reversal not processed | Reversal failed or incomplete | Complete reversal |

#### Step 3: Resolve Issue

**If Stuck Transaction**:
1. Verify delivery or reverse transaction
2. Capital will be unlocked
3. Exposure will decrease
4. Trader can make purchases again

**If Calculation Error**:
1. Review calculation logic
2. Verify all components
3. If error found, fix and recalculate
4. Document issue and resolution

**If Legitimate Cap Reached**:
1. Explain exposure breakdown to trader
2. Show which transactions are locking capital
3. Explain that cap is working as designed
4. Suggest waiting for transactions to complete

#### Step 4: Communicate Resolution

**Send Notification to Trader**:
```
Use: sendUTIDSpecificNotification
Target UTID: [relevant UTID] or use role-based notification
Title: "Spend Cap Dispute Resolution"
Message: "Your spend cap dispute has been resolved. [Details of resolution]. Your current exposure is [X] UGX, remaining capacity is [Y] UGX. [Next steps]."
Reason: "Resolve trader spend cap dispute - [traderId]"
```

**Reason Code Examples**:
- "Spend cap dispute resolved - trader had stuck transaction. Delivery verified, capital unlocked, exposure reduced from [X] to [Y] UGX."
- "Spend cap dispute resolved - calculation verified correct. Trader at [X]% of cap, [Y] UGX remaining capacity."
- "Spend cap dispute resolved - trader legitimately at cap. Explained exposure breakdown, suggested waiting for transactions to complete."

---

## Buyer Pickup Delays

### Definition

A buyer has not picked up their purchase within the 48-hour pickup SLA.

### Detection

**Query**: `getBuyersApproachingPickupSLA` (from `convex/adminRedFlags.ts`)

**What to Look For**:
- Purchases with `status = "pending_pickup"`
- `pickupSLA` has passed or is approaching
- `hoursOverdue > 0` or `hoursRemaining < 12`

### Procedure

#### Step 1: Investigate Delay

1. **Query Purchase Details**
   ```
   Use: getBuyerPickupDeadlines
   Filter: status = "pending_pickup" and past deadline
   ```

2. **Review Purchase Details**
   - Check `purchaseUtid`
   - Check `purchasedAt` timestamp
   - Check `pickupSLA` timestamp
   - Calculate hours overdue

3. **Check for Communication**
   - Review notifications sent to buyer
   - Check if buyer was notified of deadline
   - Verify buyer received purchase confirmation

4. **Review Buyer History**
   - Check if buyer has other pending pickups
   - Check buyer's pickup history
   - Check if this is a pattern or one-time issue

#### Step 2: Contact Buyer

1. **Send UTID-Specific Notification**
   ```
   Use: sendUTIDSpecificNotification
   Target UTID: [purchaseUtid]
   Title: "Pickup Deadline Approaching/Passed"
   Message: "Your pickup deadline for purchase [purchaseUtid] is [approaching/passed]. Please arrange pickup immediately. Contact support if you need assistance."
   Reason: "Notify buyer of pickup deadline - [purchaseUtid]"
   ```

2. **Wait for Response** (if within reasonable time)
   - Allow 4-6 hours for buyer response
   - If no response, proceed to resolution

#### Step 3: Determine Resolution

**Decision Matrix**:

| Situation | Action | Reason Code |
|-----------|--------|-------------|
| Buyer picks up within grace period | Mark as picked up | "Buyer picked up [X] hours after deadline, within grace period" |
| Buyer communicates delay | Extend deadline (manual) | "Buyer requested extension, approved. New deadline: [date]" |
| Buyer does not pick up | Mark as expired | "Buyer did not pick up within 48-hour SLA. Purchase expired. Inventory released." |
| Buyer cancels | Mark as cancelled | "Buyer cancelled purchase. Reason: [buyer's reason]. Inventory released." |

**Note**: Currently, there is no automated expiry. Admin must manually update status.

#### Step 4: Update Purchase Status

**If Buyer Picked Up**:
- Update `buyerPurchases.status` to `"picked_up"`
- Log admin action
- Notify trader (inventory released)

**If Purchase Expired**:
- Update `buyerPurchases.status` to `"expired"`
- Update `traderInventory.status` back to `"in_storage"`
- Log admin action
- Notify buyer and trader

**Example Admin Action**:
```typescript
// This would require a new mutation or manual database update
// For now, document the action in adminActions log
await logAdminAction(ctx, adminId, "expire_buyer_purchase", 
  "Buyer did not pick up within 48-hour SLA. Purchase expired. Inventory released back to trader.",
  purchaseUtid,
  {
    purchaseId: purchase._id,
    buyerId: purchase.buyerId,
    inventoryId: purchase.inventoryId,
    hoursOverdue: hoursOverdue,
  }
);
```

#### Step 5: Notify Affected Parties

1. **Notify Buyer**
   ```
   Title: "Pickup Status Update"
   Message: "Your purchase [purchaseUtid] has been [picked up/expired/cancelled]. [Additional details]."
   ```

2. **Notify Trader** (if inventory released)
   ```
   Title: "Inventory Released"
   Message: "Inventory from purchase [purchaseUtid] has been released back to you. Status: [in_storage/expired]."
   ```

---

## Delivery Verification Guidelines

### When to Verify as "Delivered"

**Verify as "delivered" when**:
- ✅ Farmer delivered produce to trader
- ✅ Trader confirms receipt
- ✅ Produce quality is acceptable
- ✅ Delivery was on time or within acceptable tolerance (<12 hours late)
- ✅ All parties agree delivery was successful

**Reason Code Examples**:
- "Farmer delivered on time, trader confirmed receipt. Quality acceptable."
- "Farmer delivered [X] hours late, within acceptable tolerance. Trader confirmed receipt."
- "Farmer delivered, trader confirmed receipt. Minor quality issues resolved."

### When to Verify as "Late"

**Verify as "late" when**:
- ✅ Farmer delivered but very late (>12 hours)
- ✅ Delivery was significantly delayed
- ✅ Trader accepts late delivery but wants it marked as late
- ✅ Delivery happened but outside acceptable timeframe

**Reason Code Examples**:
- "Farmer delivered [X] hours late (>12 hours). Trader accepted delivery but requested late status."
- "Farmer delivered [X] hours late, exceeds acceptable tolerance. Delivery completed but marked as late."

### When to Verify as "Cancelled"

**Verify as "cancelled" when**:
- ✅ Farmer cannot or will not deliver
- ✅ Produce quality is unacceptable
- ✅ Delivery location is inaccessible
- ✅ Transaction must be reversed
- ✅ Both parties agree to cancel

**Reason Code Examples**:
- "Delivery cancelled - farmer unable to deliver. Reason: [farmer's reason]. Capital unlocked."
- "Delivery cancelled - produce quality unacceptable. Trader rejected delivery. Capital unlocked."
- "Delivery cancelled - delivery location inaccessible. [Details]. Capital unlocked."

### Verification Checklist

Before verifying delivery, confirm:
- [ ] Transaction UTID verified
- [ ] Delivery deadline checked
- [ ] Hours overdue calculated (if late)
- [ ] Farmer communication reviewed (if applicable)
- [ ] Trader confirmation received (if applicable)
- [ ] Quality issues assessed (if applicable)
- [ ] Appropriate outcome selected ("delivered", "late", or "cancelled")
- [ ] Reason code written clearly
- [ ] All affected parties notified

---

## Transaction Reversal Guidelines

### When to Reverse Transactions

**Reverse transaction when**:
- ✅ Delivery verified as "late" or "cancelled"
- ✅ Transaction must be undone
- ✅ Capital must be unlocked
- ✅ Unit must be made available again
- ✅ All parties agree reversal is appropriate

**Do NOT reverse when**:
- ❌ Delivery verified as "delivered"
- ❌ Transaction is legitimate and successful
- ❌ Only partial reversal needed (not supported)
- ❌ Reversal would create data inconsistency

### Reversal Procedure

#### Step 1: Verify Prerequisites

1. **Check Delivery Status**
   - Must be `"late"` or `"cancelled"`
   - Cannot reverse if `"delivered"`

2. **Check Unit Status**
   - Must be `"locked"`
   - Cannot reverse if already unlocked

3. **Verify Transaction**
   - Confirm `lockUtid` is correct
   - Verify transaction exists
   - Check wallet ledger entry exists

#### Step 2: Execute Reversal

**Use**: `reverseDeliveryFailure` mutation

**What Happens**:
1. Capital unlocked in trader's wallet
2. Unit unlocked (status → "available")
3. Delivery status set to "cancelled"
4. Reversal UTID generated
5. Admin action logged

**Example**:
```typescript
await reverseDeliveryFailure({
  adminId: "admin123",
  lockUtid: "20240215-143022-tra-a3k9x2",
  reason: "Delivery failed - farmer did not deliver within SLA. Capital unlocked (UGX [amount]) and unit made available again. Trader and farmer notified."
});
```

#### Step 3: Verify Reversal

1. **Check Wallet Ledger**
   - Verify `capital_unlock` entry created
   - Verify balance updated correctly
   - Verify UTID linked correctly

2. **Check Unit Status**
   - Verify unit status is "available"
   - Verify lock fields cleared
   - Verify delivery fields cleared

3. **Check Listing Status**
   - Verify listing status updated (if needed)
   - Verify unit count correct

#### Step 4: Notify Affected Parties

1. **Notify Trader**
   ```
   Title: "Transaction Reversed"
   Message: "Transaction [lockUtid] has been reversed. Your capital (UGX [amount]) has been unlocked and is available in your wallet. The unit has been made available again."
   ```

2. **Notify Farmer**
   ```
   Title: "Transaction Reversed"
   Message: "Transaction [lockUtid] has been reversed. The unit has been made available again. [Additional details]."
   ```

### Reversal Checklist

Before reversing, confirm:
- [ ] Delivery status is "late" or "cancelled"
- [ ] Unit status is "locked"
- [ ] Transaction UTID verified
- [ ] Reason for reversal documented
- [ ] All parties notified (if applicable)
- [ ] Reversal executed
- [ ] Reversal verified (wallet, unit, listing)
- [ ] Admin action logged

---

## Admin Reason Code Guidelines

### Purpose of Reason Codes

Reason codes serve multiple purposes:
- **Audit trail**: Document why admin took action
- **Transparency**: Explain decisions to users
- **Accountability**: Hold admins accountable for decisions
- **Learning**: Help improve processes

### Good Reason Code Characteristics

**✅ DO**:
- Be specific and clear
- Include relevant details (UTIDs, timestamps, amounts)
- Explain the decision
- Reference related transactions
- Use professional language
- Include next steps (if applicable)

**❌ DON'T**:
- Use vague language ("Issue resolved")
- Omit important details
- Use technical jargon users won't understand
- Include sensitive information
- Use unprofessional language
- Make assumptions without verification

### Reason Code Templates

#### Delivery Verification

**Template**:
```
"[Outcome] - [Key details]. [Context]. [Resolution/Next steps]."
```

**Examples**:
- ✅ "Delivered - farmer delivered on time, trader confirmed receipt. Quality acceptable. Transaction complete."
- ✅ "Late - farmer delivered 8 hours late, exceeds acceptable tolerance. Trader accepted delivery but requested late status. Transaction complete."
- ✅ "Cancelled - farmer unable to deliver. Reason: Vehicle breakdown. Capital unlocked (UGX 50,000) and unit made available again. Trader and farmer notified."

#### Transaction Reversal

**Template**:
```
"Reversal - [Reason]. [Actions taken]. [Affected parties]. [Next steps]."
```

**Examples**:
- ✅ "Reversal - delivery failed, farmer did not deliver within SLA. Capital unlocked (UGX 50,000) and unit made available again. Trader and farmer notified."
- ✅ "Reversal - delivery cancelled, produce quality unacceptable. Trader rejected delivery. Capital unlocked (UGX 75,000) and unit made available again. Trader and farmer notified."

#### Spend Cap Dispute

**Template**:
```
"Dispute resolved - [Issue found]. [Resolution]. [Current status]. [Next steps]."
```

**Examples**:
- ✅ "Dispute resolved - trader had stuck transaction. Delivery verified, capital unlocked, exposure reduced from 950,000 to 850,000 UGX. Trader can now make purchases."
- ✅ "Dispute resolved - calculation verified correct. Trader at 95% of cap (950,000 UGX), 50,000 UGX remaining capacity. Explained exposure breakdown."

#### Buyer Pickup Delay

**Template**:
```
"Pickup [status] - [Details]. [Resolution]. [Affected parties]."
```

**Examples**:
- ✅ "Pickup expired - buyer did not pick up within 48-hour SLA (6 hours overdue). Purchase expired, inventory released back to trader. Buyer and trader notified."
- ✅ "Pickup completed - buyer picked up 2 hours after deadline, within grace period. Purchase marked as picked up."

### Reason Code Checklist

Before submitting reason code, verify:
- [ ] Specific and clear
- [ ] Includes relevant details (UTIDs, amounts, timestamps)
- [ ] Explains the decision
- [ ] References related transactions (if applicable)
- [ ] Professional language
- [ ] No sensitive information
- [ ] No assumptions without verification
- [ ] Next steps included (if applicable)

---

## What Admins Must NEVER Do

### 1. Never Override System Rules

**❌ NEVER**:
- Manually modify spend cap limits
- Bypass rate limits
- Override pilot mode
- Skip UTID generation
- Modify wallet balances directly

**✅ ALWAYS**:
- Use system mutations
- Follow system rules
- Let system enforce limits
- Generate UTIDs for all actions
- Use wallet mutations for balance changes

**Why**: System rules exist for security, fairness, and auditability. Overriding them creates inconsistencies and security risks.

---

### 2. Never Expose User Identities

**❌ NEVER**:
- Share real names, emails, or phone numbers
- Include identifying information in notifications
- Expose user identities in reason codes
- Share user data with other users
- Log real identities in admin actions

**✅ ALWAYS**:
- Use aliases only
- Preserve anonymity
- Use UTIDs to reference users
- Keep identities private
- Log only aliases

**Why**: Anonymity is a core system requirement. Exposing identities violates user privacy and system design.

---

### 3. Never Skip Admin Action Logging

**❌ NEVER**:
- Perform actions without logging
- Skip reason codes
- Omit UTIDs
- Forget to log admin actions
- Perform actions outside system

**✅ ALWAYS**:
- Log all admin actions
- Include reason codes
- Reference UTIDs
- Use system mutations
- Document all decisions

**Why**: Admin action logging is required for auditability and accountability. Skipping it creates gaps in the audit trail.

---

### 4. Never Reverse Successful Transactions

**❌ NEVER**:
- Reverse transactions with "delivered" status
- Reverse transactions without verification
- Reverse transactions for convenience
- Reverse transactions without reason
- Reverse transactions without notification

**✅ ALWAYS**:
- Verify delivery status before reversal
- Only reverse failed transactions
- Include clear reason codes
- Notify affected parties
- Follow reversal procedure

**Why**: Reversing successful transactions creates financial inconsistencies and violates user trust.

---

### 5. Never Make Decisions Without Investigation

**❌ NEVER**:
- Verify deliveries without checking details
- Reverse transactions without investigation
- Resolve disputes without review
- Make decisions based on assumptions
- Skip verification steps

**✅ ALWAYS**:
- Investigate before deciding
- Review transaction details
- Check related transactions
- Verify calculations
- Gather all information

**Why**: Decisions made without investigation can be unfair, incorrect, or create inconsistencies.

---

### 6. Never Use Vague Reason Codes

**❌ NEVER**:
- Use "Issue resolved"
- Use "Fixed"
- Use "Done"
- Omit important details
- Use unclear language

**✅ ALWAYS**:
- Be specific and clear
- Include relevant details
- Explain the decision
- Use professional language
- Include next steps

**Why**: Vague reason codes don't provide audit trail value and don't help users understand decisions.

---

### 7. Never Skip Notifications

**❌ NEVER**:
- Perform actions without notifying users
- Skip notifications for reversals
- Forget to notify affected parties
- Use unclear notification messages
- Send notifications without context

**✅ ALWAYS**:
- Notify affected parties
- Use clear notification messages
- Include relevant UTIDs
- Provide context
- Use appropriate notification type

**Why**: Users need to know about actions affecting them. Skipping notifications creates confusion and reduces trust.

---

### 8. Never Modify Data Directly

**❌ NEVER**:
- Modify database records directly
- Bypass system mutations
- Change data without UTIDs
- Skip validation
- Create inconsistent state

**✅ ALWAYS**:
- Use system mutations
- Follow system procedures
- Generate UTIDs
- Validate inputs
- Maintain data consistency

**Why**: Direct data modification bypasses system validation, creates inconsistencies, and breaks audit trails.

---

### 9. Never Share Admin Credentials

**❌ NEVER**:
- Share admin account credentials
- Allow others to use admin account
- Use admin account for non-admin tasks
- Leave admin account logged in
- Use weak passwords

**✅ ALWAYS**:
- Keep credentials private
- Use individual admin accounts
- Log out after use
- Use strong passwords
- Enable two-factor authentication (if available)

**Why**: Admin credentials provide full system access. Sharing them creates security risks and accountability issues.

---

### 10. Never Ignore Red Flags

**❌ NEVER**:
- Ignore overdue deliveries
- Ignore traders near spend cap
- Ignore high storage loss
- Ignore buyer pickup delays
- Ignore error patterns

**✅ ALWAYS**:
- Monitor red flags regularly
- Investigate red flags promptly
- Take corrective action
- Document resolutions
- Learn from patterns

**Why**: Red flags indicate system issues or user problems. Ignoring them can lead to larger problems.

---

## Emergency Procedures

### Critical System Issue

**If critical system issue detected**:

1. **Enable Pilot Mode Immediately**
   ```
   Use: setPilotMode
   pilotMode: true
   reason: "Emergency - [brief description of issue]"
   ```

2. **Assess Situation**
   - Review error logs
   - Check system state
   - Identify root cause

3. **Communicate**
   - Notify stakeholders
   - Send broadcast notification to users
   - Update status (if applicable)

4. **Resolve**
   - Fix issue or revert
   - Test resolution
   - Re-enable system

### Data Corruption Detected

**If data corruption detected**:

1. **Enable Pilot Mode**
2. **Stop All Operations**
3. **Assess Damage**
   - Identify corrupted data
   - Check extent of corruption
   - Verify backup availability
4. **Restore or Fix**
   - Restore from backup (if available)
   - Fix corrupted data (if possible)
   - Verify data integrity
5. **Re-enable System**

### Security Breach Detected

**If security breach detected**:

1. **Enable Pilot Mode**
2. **Assess Breach**
   - Identify breach scope
   - Check affected users
   - Review access logs
3. **Contain Breach**
   - Revoke compromised access
   - Reset affected credentials
   - Isolate affected systems
4. **Notify**
   - Notify security team
   - Notify affected users (if applicable)
   - Document breach
5. **Resolve**
   - Fix security issue
   - Verify security restored
   - Re-enable system

---

## Admin Action Log Review

### Regular Review Schedule

**Daily**:
- Review all admin actions from previous day
- Check for patterns or issues
- Verify reason codes are clear
- Ensure all actions logged

**Weekly**:
- Review admin action trends
- Identify common issues
- Review reason code quality
- Check for training needs

**Monthly**:
- Comprehensive audit of admin actions
- Review decision patterns
- Assess admin performance
- Update procedures if needed

### Review Checklist

For each admin action, verify:
- [ ] Action logged with UTID
- [ ] Reason code clear and specific
- [ ] All affected parties notified
- [ ] Action appropriate for situation
- [ ] No system rules violated
- [ ] No identities exposed
- [ ] Data consistency maintained

---

## Training and Certification

### Admin Training Requirements

**Before Operating**:
- [ ] Complete admin training
- [ ] Understand system architecture
- [ ] Know all admin mutations
- [ ] Understand UTID system
- [ ] Know error codes
- [ ] Understand anonymity requirements
- [ ] Know reversal procedures
- [ ] Practice with test data

### Certification

**Admin Certification Checklist**:
- [ ] Passed admin training
- [ ] Demonstrated understanding of procedures
- [ ] Completed practice scenarios
- [ ] Reviewed playbook
- [ ] Signed admin agreement
- [ ] Access granted

---

## Appendices

### Appendix A: Common Error Codes

| Error Code | Meaning | Admin Action |
|------------|---------|--------------|
| `SPEND_CAP_EXCEEDED` | Trader at spend cap | Review exposure, check for stuck transactions |
| `PURCHASE_WINDOW_CLOSED` | Purchase window not open | Open purchase window if appropriate |
| `PILOT_MODE_ACTIVE` | System in pilot mode | Disable pilot mode if ready for production |
| `RATE_LIMIT_EXCEEDED` | User hit rate limit | Review rate limit hits, check for spam |
| `DELIVERY_SLA_EXPIRED` | Delivery deadline passed | Verify delivery or reverse transaction |
| `PICKUP_SLA_EXPIRED` | Pickup deadline passed | Update purchase status, release inventory |

### Appendix B: Quick Reference

**Key Mutations**:
- `verifyDelivery`: Verify delivery outcome
- `reverseDeliveryFailure`: Reverse failed delivery
- `openPurchaseWindow`: Open purchase window
- `closePurchaseWindow`: Close purchase window
- `setPilotMode`: Enable/disable pilot mode
- `sendBroadcastNotification`: Send to all users
- `sendRoleBasedNotification`: Send to role
- `sendUTIDSpecificNotification`: Send to UTID-related users

**Key Queries**:
- `getDeliveriesPastSLA`: Find overdue deliveries
- `getTradersNearSpendCap`: Find traders near cap
- `getBuyersApproachingPickupSLA`: Find overdue pickups
- `getRedFlagsSummary`: Quick overview of all red flags
- `getAllActiveUTIDs`: View all UTIDs
- `getNotificationHistory`: View notification history

---

*Document Version: 1.0*  
*Last Updated: [Date]*  
*Next Review: [Date]*
