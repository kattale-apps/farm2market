# Founder Invariant List - Farm2Market Uganda v1

## Overview

This document lists the **10 critical invariants** that must **NEVER** be broken in Farm2Market Uganda. These are the fundamental rules that make the system work correctly, fairly, and securely.

**What is an Invariant?**: An invariant is a rule that must always be true. If it's broken, the system is fundamentally broken.

**Who This Is For**: Non-technical founders who need to protect the system from changes that could break core functionality.

**Critical Rule**: If you're under pressure to make changes, **check this list first**. Never break these invariants, even if it seems like a quick fix.

---

## The Top 10 Invariants

### 1. Anonymity: Users Never See Real Identities

**What This Means**:
- Users only see system-generated aliases (like "far_abc123", "tra_xyz789")
- No real names, emails, or phone numbers are ever shown
- Farmers don't know trader identities
- Traders don't know farmer identities
- Buyers don't know trader identities

**Why It Matters**:
- Protects user privacy
- Prevents side trading (users can't contact each other directly)
- Ensures platform is the only trading channel
- Required for fair, controlled trading

**Symptoms This Is At Risk**:
- ❌ Users asking "How do I contact the farmer/trader?"
- ❌ Real names or emails appearing in notifications
- ❌ Phone numbers visible in dashboard
- ❌ Users sharing contact information
- ❌ Support requests asking for user identities
- ❌ Any query or notification showing real names/emails

**What NOT to Change Under Pressure**:
- ❌ **NEVER** add "contact seller" features
- ❌ **NEVER** show real names "for convenience"
- ❌ **NEVER** add email/phone fields to dashboards
- ❌ **NEVER** create "user profiles" with real information
- ❌ **NEVER** allow users to share contact information
- ❌ **NEVER** bypass alias system "just this once"

**What Changes Require Full System Review**:
- Any feature that shows user information
- Any notification that includes real identities
- Any query that returns real names/emails
- Any dashboard that displays contact information
- Any "messaging" or "communication" features

---

### 2. UTID Tracking: Every Action Has a Unique Transaction ID

**What This Means**:
- Every payment, purchase, delivery, and admin action gets a unique UTID
- UTIDs are like receipt numbers - they track everything
- You can trace any transaction from start to finish using UTIDs
- Failed attempts don't get UTIDs (only successful actions)

**Why It Matters**:
- Complete audit trail (you can prove what happened)
- Dispute resolution (you can trace any transaction)
- Compliance (regulators can verify transactions)
- System accountability (nothing happens without a record)

**Symptoms This Is At Risk**:
- ❌ Transactions happening without UTIDs
- ❌ "Lost" transactions that can't be traced
- ❌ Disputes that can't be resolved
- ❌ Audit trail gaps
- ❌ Queries returning transactions without UTIDs
- ❌ Admin actions not logged with UTIDs

**What NOT to Change Under Pressure**:
- ❌ **NEVER** skip UTID generation "to speed things up"
- ❌ **NEVER** allow transactions without UTIDs
- ❌ **NEVER** delete UTIDs from database
- ❌ **NEVER** reuse UTIDs
- ❌ **NEVER** create "fast path" that skips UTID generation
- ❌ **NEVER** allow admin actions without UTID logging

**What Changes Require Full System Review**:
- Any new transaction type (must generate UTID)
- Any new mutation (must log UTID)
- Any change to UTID format
- Any feature that creates transactions
- Any "bulk operation" that processes multiple transactions

---

### 3. Spend Cap: Traders Cannot Exceed UGX 1,000,000 Exposure

**What This Means**:
- Every trader has a maximum exposure limit of UGX 1,000,000
- Exposure = locked capital + locked orders + inventory value
- System blocks purchases that would exceed this limit
- This is checked BEFORE any money moves

**Why It Matters**:
- Protects system from over-exposure
- Ensures fair capacity distribution
- Prevents single trader from dominating
- Financial risk management

**Symptoms This Is At Risk**:
- ❌ Traders reporting they can't make purchases (may be at cap)
- ❌ Traders asking to increase their limit
- ❌ System allowing purchases over cap
- ❌ Exposure calculations showing wrong numbers
- ❌ Traders with exposure > 1,000,000 UGX
- ❌ "Special exceptions" being requested

**What NOT to Change Under Pressure**:
- ❌ **NEVER** increase the cap "just for this trader"
- ❌ **NEVER** bypass spend cap checks
- ❌ **NEVER** allow "manual overrides" of the cap
- ❌ **NEVER** change cap calculation logic without review
- ❌ **NEVER** create "premium accounts" with higher caps
- ❌ **NEVER** allow traders to "borrow" capacity

**What Changes Require Full System Review**:
- Any change to the UGX 1,000,000 limit
- Any change to exposure calculation
- Any feature that affects trader capacity
- Any "special account" or "premium" features
- Any change to spend cap enforcement logic

---

### 4. Pay-to-Lock Atomicity: Payment and Lock Happen Together or Not At All

**What This Means**:
- When a trader pays for a unit, two things happen together:
  1. Money is locked in trader's wallet
  2. Unit is locked (marked as sold to that trader)
- These MUST happen together - either both succeed or both fail
- No partial states (can't have money locked without unit locked, or vice versa)

**Why It Matters**:
- Prevents money loss (trader pays but doesn't get unit)
- Prevents double-selling (unit sold to two traders)
- Ensures fairness (first payment wins)
- Prevents race conditions (two traders buying same unit)

**Symptoms This Is At Risk**:
- ❌ Traders reporting "I paid but didn't get the unit"
- ❌ Units showing as "sold" but no payment recorded
- ❌ Payments recorded but units still "available"
- ❌ Multiple traders claiming same unit
- ❌ "Lost" payments or units
- ❌ Disputes about who owns a unit

**What NOT to Change Under Pressure**:
- ❌ **NEVER** separate payment and lock into two steps
- ❌ **NEVER** allow "manual" unit locks without payment
- ❌ **NEVER** allow "manual" payments without unit lock
- ❌ **NEVER** create "fast path" that skips checks
- ❌ **NEVER** allow partial transactions
- ❌ **NEVER** fix "stuck" transactions by manually updating one side

**What Changes Require Full System Review**:
- Any change to payment/lock logic
- Any new payment method
- Any "bulk purchase" feature
- Any change to unit locking process
- Any feature that affects payment flow

---

### 5. Admin Authority: Only Admins Can Make Final Decisions

**What This Means**:
- Only admins can verify deliveries
- Only admins can reverse transactions
- Only admins can open/close purchase windows
- Only admins can enable/disable pilot mode
- System never makes automated decisions (no auto-reversals, no auto-verifications)

**Why It Matters**:
- Ensures human oversight
- Prevents automated errors
- Allows for context-based decisions
- Maintains accountability

**Symptoms This Is At Risk**:
- ❌ System automatically reversing transactions
- ❌ System automatically verifying deliveries
- ❌ Non-admins able to verify deliveries
- ❌ Automated dispute resolution
- ❌ System making decisions without admin input
- ❌ "Smart" features that bypass admin review

**What NOT to Change Under Pressure**:
- ❌ **NEVER** add "auto-verify" features
- ❌ **NEVER** add "auto-reverse" features
- ❌ **NEVER** allow non-admins to verify deliveries
- ❌ **NEVER** create "smart" dispute resolution
- ❌ **NEVER** automate admin decisions
- ❌ **NEVER** skip admin verification "for speed"

**What Changes Require Full System Review**:
- Any automation of admin decisions
- Any feature that bypasses admin review
- Any "smart" or "AI" decision-making
- Any change to admin authority
- Any feature that affects delivery verification

---

### 6. Closed-Loop Wallet: No External Money Movement

**What This Means**:
- Wallet is internal only (not connected to banks)
- Money only moves within the system
- No deposits from external sources
- No withdrawals to external sources
- All money movement is tracked in ledger

**Why It Matters**:
- Simplifies system (no bank integration)
- Reduces regulatory complexity
- Ensures all money is tracked
- Prevents external money laundering

**Symptoms This Is At Risk**:
- ❌ Requests to connect to bank accounts
- ❌ Requests for "real money" deposits
- ❌ Requests for "real money" withdrawals
- ❌ Integration with payment gateways
- ❌ External payment methods
- ❌ "Cash out" features

**What NOT to Change Under Pressure**:
- ❌ **NEVER** connect to bank accounts
- ❌ **NEVER** add external payment methods
- ❌ **NEVER** allow "real money" deposits
- ❌ **NEVER** allow "real money" withdrawals
- ❌ **NEVER** integrate payment gateways
- ❌ **NEVER** create "cash out" features

**What Changes Require Full System Review**:
- Any external payment integration
- Any bank account connection
- Any "real money" features
- Any payment gateway integration
- Any feature that moves money outside system

---

### 7. Buyers Never See Prices

**What This Means**:
- Buyers can see inventory (what's available)
- Buyers can see quantities (how many kilos)
- Buyers can see produce type (maize, beans, etc.)
- Buyers CANNOT see prices (what traders paid)
- No price information in any buyer query or notification

**Why It Matters**:
- Prevents price negotiation outside platform
- Prevents side trading (buyers can't compare prices)
- Ensures platform is only trading channel
- Protects trader pricing strategies

**Symptoms This Is At Risk**:
- ❌ Buyers asking "What did the trader pay?"
- ❌ Prices visible in buyer dashboard
- ❌ Price information in buyer notifications
- ❌ Buyers comparing prices across traders
- ❌ "Price history" features for buyers
- ❌ Any query returning price to buyers

**What NOT to Change Under Pressure**:
- ❌ **NEVER** show prices to buyers "for transparency"
- ❌ **NEVER** add "price comparison" features
- ❌ **NEVER** show "what trader paid" to buyers
- ❌ **NEVER** create buyer price alerts
- ❌ **NEVER** allow buyers to see price history
- ❌ **NEVER** add "negotiate price" features

**What Changes Require Full System Review**:
- Any feature that shows prices to buyers
- Any query that returns price information
- Any notification that includes prices
- Any dashboard that displays prices
- Any "price" or "cost" related feature

---

### 8. Purchase Windows: Buyers Can Only Purchase When Window Is Open

**What This Means**:
- Admin controls when buyers can purchase
- Purchase window must be explicitly opened by admin
- Buyers cannot purchase when window is closed
- This is the FIRST check (before any other validation)

**Why It Matters**:
- Controls trading activity
- Prevents uncontrolled purchases
- Allows admin to manage system load
- Ensures platform control

**Symptoms This Is At Risk**:
- ❌ Buyers purchasing when window is closed
- ❌ System allowing purchases without window check
- ❌ "Always open" purchase windows
- ❌ Automated window opening
- ❌ Buyers bypassing window check
- ❌ Window check happening after other validations

**What NOT to Change Under Pressure**:
- ❌ **NEVER** remove window check "for convenience"
- ❌ **NEVER** create "always open" windows
- ❌ **NEVER** automate window opening
- ❌ **NEVER** allow purchases without window check
- ❌ **NEVER** move window check to after other validations
- ❌ **NEVER** create "special buyer" exceptions

**What Changes Require Full System Review**:
- Any change to purchase window logic
- Any automation of window management
- Any feature that affects window checks
- Any "special access" features
- Any change to buyer purchase flow

---

### 9. Server-Side Enforcement: All Rules Enforced on Server, Not Client

**What This Means**:
- All business rules checked on server (Convex backend)
- Client (frontend) cannot bypass rules
- Role checks happen on server
- Spend cap checks happen on server
- Rate limit checks happen on server
- Client only displays results, never enforces rules

**Why It Matters**:
- Security (client can be manipulated)
- Fairness (all users follow same rules)
- Consistency (rules always enforced)
- Prevents cheating/hacking

**Symptoms This Is At Risk**:
- ❌ Client-side role checks
- ❌ Client-side spend cap checks
- ❌ Client-side rate limit checks
- ❌ "Smart" client that "helps" users
- ❌ Client making decisions
- ❌ Rules that can be bypassed by modifying client

**What NOT to Change Under Pressure**:
- ❌ **NEVER** move rule checks to client "for speed"
- ❌ **NEVER** trust client claims (roles, balances, etc.)
- ❌ **NEVER** create "client-side validation only"
- ❌ **NEVER** allow client to make decisions
- ❌ **NEVER** skip server checks "because client checks"
- ❌ **NEVER** create "offline mode" that bypasses server

**What Changes Require Full System Review**:
- Any client-side business logic
- Any "offline" features
- Any change that moves logic to client
- Any feature that trusts client data
- Any "smart client" features

---

### 10. Pilot Mode Safety: When Enabled, All Mutations Blocked

**What This Means**:
- Pilot mode is a global safety switch
- When enabled, all mutations that move money or inventory are blocked
- Read-only queries still work (users can view data)
- Admin actions still work (admins can manage system)
- This is checked FIRST (before any other operation)

**Why It Matters**:
- Prevents catastrophic failures during testing
- Allows safe system validation
- Protects system state during issues
- Enables quick rollback

**Symptoms This Is At Risk**:
- ❌ Mutations working when pilot mode is enabled
- ❌ Money moving when pilot mode is enabled
- ❌ Inventory moving when pilot mode is enabled
- ❌ Pilot mode check happening after operations
- ❌ "Special" mutations that bypass pilot mode
- ❌ Pilot mode not blocking all mutations

**What NOT to Change Under Pressure**:
- ❌ **NEVER** bypass pilot mode "for this one transaction"
- ❌ **NEVER** create "special" mutations that ignore pilot mode
- ❌ **NEVER** move pilot mode check to after operations
- ❌ **NEVER** allow mutations when pilot mode is enabled
- ❌ **NEVER** create "emergency override" that bypasses pilot mode
- ❌ **NEVER** disable pilot mode checks "for speed"

**What Changes Require Full System Review**:
- Any change to pilot mode logic
- Any new mutation (must check pilot mode)
- Any "emergency" features
- Any change that affects pilot mode enforcement
- Any feature that bypasses pilot mode

---

## What NOT to Change Under Pressure

### Common Pressure Scenarios

**Scenario 1: "We need to fix this quickly"**
- ❌ **NEVER** skip checks or validations
- ❌ **NEVER** bypass system rules
- ❌ **NEVER** create "quick fix" that breaks invariants
- ✅ **ALWAYS** follow proper procedures
- ✅ **ALWAYS** maintain system integrity

**Scenario 2: "This user is important"**
- ❌ **NEVER** make special exceptions
- ❌ **NEVER** bypass rules for specific users
- ❌ **NEVER** show identities "just this once"
- ✅ **ALWAYS** treat all users equally
- ✅ **ALWAYS** follow system rules

**Scenario 3: "We need more features"**
- ❌ **NEVER** add features that break invariants
- ❌ **NEVER** compromise core rules for features
- ❌ **NEVER** add "convenience" features that expose identities
- ✅ **ALWAYS** check invariants before adding features
- ✅ **ALWAYS** maintain system integrity

**Scenario 4: "The system is too slow"**
- ❌ **NEVER** skip server-side checks
- ❌ **NEVER** move logic to client
- ❌ **NEVER** bypass validations
- ✅ **ALWAYS** optimize within system rules
- ✅ **ALWAYS** maintain security

**Scenario 5: "Users are complaining"**
- ❌ **NEVER** break invariants to satisfy complaints
- ❌ **NEVER** expose identities "to help users"
- ❌ **NEVER** bypass rules "to be helpful"
- ✅ **ALWAYS** explain system rules
- ✅ **ALWAYS** find solutions within invariants

---

## What Changes Require a Full System Review

### Automatic Review Required For:

1. **Any Feature That Shows User Information**
   - User profiles
   - Contact information
   - Real names or emails
   - Any identity exposure

2. **Any Feature That Affects Money Movement**
   - New payment methods
   - External integrations
   - Wallet changes
   - Financial features

3. **Any Feature That Affects Transactions**
   - New transaction types
   - Bulk operations
   - Automated processes
   - Transaction changes

4. **Any Feature That Bypasses Rules**
   - Special exceptions
   - Override features
   - Bypass mechanisms
   - "Fast path" features

5. **Any Feature That Affects Admin Authority**
   - Automated decisions
   - Non-admin verification
   - Bypass admin review
   - Smart features

6. **Any Feature That Shows Prices to Buyers**
   - Price displays
   - Price comparisons
   - Price history
   - Cost information

7. **Any Feature That Affects Purchase Windows**
   - Automated windows
   - Always-open windows
   - Window bypasses
   - Special access

8. **Any Feature That Moves Logic to Client**
   - Client-side validation
   - Client-side decisions
   - Offline features
   - Smart clients

9. **Any Feature That Affects Pilot Mode**
   - Bypass mechanisms
   - Special mutations
   - Override features
   - Emergency features

10. **Any Feature That Affects UTID Tracking**
    - New transaction types
    - Bulk operations
    - UTID changes
    - Tracking changes

---

## How to Use This List

### Before Making Any Change

1. **Read This List**
   - Check if change affects any invariant
   - Identify which invariants are at risk
   - Understand the implications

2. **Ask Questions**
   - Does this change expose identities?
   - Does this change bypass rules?
   - Does this change affect money movement?
   - Does this change require UTID tracking?
   - Does this change affect admin authority?

3. **Get Review**
   - If any invariant is at risk, get technical review
   - Don't proceed without understanding implications
   - Ask for alternatives that don't break invariants

4. **Document Decision**
   - If you proceed, document why
   - Explain how invariants are maintained
   - Record any risks or trade-offs

### When Under Pressure

1. **Stop and Check**
   - Don't make hasty decisions
   - Check this list first
   - Identify which invariants are at risk

2. **Find Alternatives**
   - Look for solutions that don't break invariants
   - Ask for technical input
   - Consider long-term implications

3. **Communicate**
   - Explain why you can't break invariants
   - Provide alternatives
   - Set expectations

---

## Red Flags: When to Stop and Review

**Stop Immediately If You See**:
- ❌ Any request to expose user identities
- ❌ Any request to bypass system rules
- ❌ Any request to skip validations
- ❌ Any request for "special exceptions"
- ❌ Any request to move logic to client
- ❌ Any request to automate admin decisions
- ❌ Any request to show prices to buyers
- ❌ Any request to bypass purchase windows
- ❌ Any request to skip UTID tracking
- ❌ Any request to bypass pilot mode

**When You See Red Flags**:
1. Stop the change
2. Review this list
3. Get technical review
4. Find alternatives
5. Document decision

---

## Summary: The 10 Invariants

1. **Anonymity**: Users never see real identities
2. **UTID Tracking**: Every action has a unique transaction ID
3. **Spend Cap**: Traders cannot exceed UGX 1,000,000 exposure
4. **Pay-to-Lock Atomicity**: Payment and lock happen together or not at all
5. **Admin Authority**: Only admins can make final decisions
6. **Closed-Loop Wallet**: No external money movement
7. **Buyers Never See Prices**: No price information to buyers
8. **Purchase Windows**: Buyers can only purchase when window is open
9. **Server-Side Enforcement**: All rules enforced on server, not client
10. **Pilot Mode Safety**: When enabled, all mutations blocked

**Remember**: These invariants are non-negotiable. Breaking any of them breaks the system fundamentally.

---

*Document Version: 1.0*  
*Last Updated: [Date]*  
*Next Review: [Date]*
