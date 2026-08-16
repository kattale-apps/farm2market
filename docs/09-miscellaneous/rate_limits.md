# Rate Limiting System

## Overview

Soft rate limits per role to discourage spam and manipulation. All rate limit checks are server-side only, failures are graceful with explicit error messages, and all rate limit hits are logged for admin review.

---

## Implementation

### 1. Rate Limit Constants

**Location**: `convex/constants.ts`

```typescript
export const RATE_LIMITS = {
  // Trader limits
  TRADER_NEGOTIATIONS_PER_HOUR: 20, // Max unit locks per hour
  TRADER_WALLET_OPERATIONS_PER_HOUR: 10, // Max deposits/withdrawals per hour
  
  // Farmer limits
  FARMER_LISTINGS_PER_DAY: 10, // Max listings created per day
  
  // Buyer limits
  BUYER_PURCHASES_PER_HOUR: 5, // Max purchases per hour
} as const;
```

**Why These Limits**:
- **Trader negotiations**: 20/hour allows active trading without spam
- **Trader wallet operations**: 10/hour prevents rapid deposit/withdraw cycles
- **Farmer listings**: 10/day prevents listing spam
- **Buyer purchases**: 5/hour prevents purchase spam

---

### 2. Schema

**Table**: `rateLimitHits`

Tracks all rate limit violations:
- `userId`: User who exceeded limit
- `userRole`: Role of the user
- `actionType`: Type of action (e.g., "lock_unit", "create_listing")
- `limitType`: Type of limit (e.g., "negotiations_per_hour")
- `limitValue`: The limit that was exceeded
- `attemptedAt`: Timestamp of the attempt
- `windowStart/End`: Rate limit window boundaries
- `currentCount`: Current count in the window
- `metadata`: Additional context

**Indexes**:
- `by_user`: Find hits by user
- `by_user_role`: Find hits by role
- `by_action_type`: Find hits by action type
- `by_timestamp`: Find hits by time
- `by_user_timestamp`: Find hits by user and time

---

### 3. Rate Limit Checking

**Function**: `checkRateLimit(ctx, userId, userRole, actionType, metadata)`

**Process**:
1. Admins are not rate limited (return early)
2. Get rate limit configuration for the action
3. Calculate current window (sliding window)
4. Count actions in the window
5. If limit exceeded:
   - Log rate limit hit
   - Calculate reset time
   - Throw explicit error

**Error Message Example**:
```
Rate limit exceeded: You have exceeded the limit of 20 negotiations per hour.
Current count: 21.
Limit resets in approximately 45 minute(s).
This action has been logged for admin review.
If you believe this is an error, please contact support.
```

---

### 4. Mutations Protected

All mutations that move money or inventory are rate limited:

#### 4.1 Trader Mutations

**`lockUnit`** (`convex/payments.ts`):
- **Limit**: 20 negotiations per hour
- **Check**: Before unit locking
- **Why**: Prevents negotiation spam

**`depositCapital`** (`convex/wallet.ts`):
- **Limit**: 10 wallet operations per hour
- **Check**: Before capital deposit
- **Why**: Prevents rapid deposit cycles

**`withdrawProfit`** (`convex/wallet.ts`):
- **Limit**: 10 wallet operations per hour
- **Check**: Before profit withdrawal
- **Why**: Prevents rapid withdrawal cycles

#### 4.2 Farmer Mutations

**`createListing`** (`convex/listings.ts`):
- **Limit**: 10 listings per day
- **Check**: Before listing creation
- **Why**: Prevents listing spam

#### 4.3 Buyer Mutations

**`createBuyerPurchase`** (`convex/buyers.ts`):
- **Limit**: 5 purchases per hour
- **Check**: Before purchase creation
- **Why**: Prevents purchase spam

---

### 5. Admin Queries

#### 5.1 `getRateLimitHits` (Admin Only)

**Purpose**: View all rate limit violations.

**Parameters**:
- `adminId`: Admin viewing the hits
- `limit`: Max results (default: 100)
- `userId`: Filter by user (optional)
- `actionType`: Filter by action type (optional)
- `startTime/endTime`: Filter by time range (optional)

**Returns**:
- Summary statistics (total, by role, by action type, unique users)
- Enriched hits with user aliases
- `hasMore` flag

**Use Cases**:
- Monitor spam attempts
- Investigate manipulation attempts
- Identify problematic users
- Track rate limit effectiveness

#### 5.2 `getUserRateLimitStatus` (Admin Only)

**Purpose**: View current rate limit status for a specific user.

**Parameters**:
- `adminId`: Admin viewing the status
- `userId`: User to check

**Returns**:
- Current counts for each action type
- Remaining capacity
- Recent rate limit hits
- Window information

**Use Cases**:
- Investigate specific user
- Check if user is approaching limits
- Understand user behavior patterns

---

## How This Discourages Spam and Manipulation

### 1. Prevents Rapid-Fire Spam

**Problem**: Malicious users could spam the system with rapid-fire requests:
- Creating hundreds of listings per minute
- Locking units in rapid succession
- Making purchases in quick succession

**How Rate Limits Prevent**:
- ✅ **Hard limits**: Cannot exceed limit regardless of speed
- ✅ **Sliding window**: Limits reset gradually, not all at once
- ✅ **Server-side enforcement**: Cannot bypass client-side
- ✅ **Immediate blocking**: Spam attempts fail immediately

**Example Scenario**:
```
❌ Without Rate Limits:
- Malicious farmer creates 100 listings in 1 minute
- System overwhelmed with spam listings
- Legitimate listings buried

✅ With Rate Limits:
- Farmer creates 10 listings (limit reached)
- 11th listing attempt fails with rate limit error
- Spam prevented, system protected
```

---

### 2. Prevents Manipulation Attempts

**Problem**: Malicious users could manipulate the system:
- Creating fake listings to inflate supply
- Locking units to block legitimate traders
- Making fake purchases to manipulate inventory

**How Rate Limits Prevent**:
- ✅ **Action limits**: Cannot perform too many actions
- ✅ **Time-based windows**: Limits reset over time, not instantly
- ✅ **Logged violations**: All attempts logged for admin review
- ✅ **Gradual reset**: Cannot immediately retry after limit

**Example Scenario**:
```
❌ Without Rate Limits:
- Malicious trader locks 100 units in 1 hour
- Blocks legitimate traders from accessing units
- System manipulated

✅ With Rate Limits:
- Trader locks 20 units (limit reached)
- 21st lock attempt fails with rate limit error
- Legitimate traders can still access units
- Manipulation prevented
```

---

### 3. Prevents System Overload

**Problem**: High-volume spam could overload the system:
- Database queries overwhelmed
- Server resources exhausted
- System performance degraded

**How Rate Limits Prevent**:
- ✅ **Volume control**: Limits total actions per user
- ✅ **Distributed load**: Spreads actions over time
- ✅ **Resource protection**: Prevents system overload
- ✅ **Performance maintained**: System remains responsive

**Example Scenario**:
```
❌ Without Rate Limits:
- 10 malicious users create 1000 listings each
- System processes 10,000 listing creations
- Database overwhelmed, system slow

✅ With Rate Limits:
- Each user limited to 10 listings per day
- Maximum 100 listings per day (10 users × 10)
- System load manageable
- Performance maintained
```

---

### 4. Enables Admin Monitoring

**Problem**: Without logging, spam and manipulation attempts go unnoticed:
- No visibility into abuse patterns
- Cannot identify problematic users
- Cannot adjust limits based on data

**How Rate Limits Enable**:
- ✅ **Complete logging**: All violations logged
- ✅ **Admin visibility**: Admins can view all hits
- ✅ **Pattern detection**: Can identify abuse patterns
- ✅ **Data-driven adjustments**: Limits can be adjusted based on data

**Example Scenario**:
```
❌ Without Logging:
- Rate limit hit, but no record
- Admin cannot investigate
- Cannot identify problematic users

✅ With Logging:
- Rate limit hit logged with full context
- Admin can view all hits via getRateLimitHits
- Can identify patterns and adjust limits
- Can take action against problematic users
```

---

### 5. Prevents Automated Attacks

**Problem**: Automated scripts could spam the system:
- Bots creating listings
- Scripts locking units
- Automated purchase attempts

**How Rate Limits Prevent**:
- ✅ **Action limits**: Bots cannot exceed limits
- ✅ **Time-based windows**: Limits reset over time
- ✅ **Server-side enforcement**: Cannot bypass with client-side tricks
- ✅ **Logged attempts**: All bot attempts logged

**Example Scenario**:
```
❌ Without Rate Limits:
- Bot creates 1000 listings per hour
- System overwhelmed
- Legitimate users cannot use system

✅ With Rate Limits:
- Bot creates 10 listings (limit reached)
- All further attempts fail
- System protected from automated attacks
- Legitimate users can still use system
```

---

### 6. Prevents Market Manipulation

**Problem**: Malicious users could manipulate market dynamics:
- Creating fake listings to inflate supply
- Locking units to create artificial scarcity
- Making fake purchases to manipulate inventory

**How Rate Limits Prevent**:
- ✅ **Listing limits**: Cannot create too many listings
- ✅ **Negotiation limits**: Cannot lock too many units
- ✅ **Purchase limits**: Cannot make too many purchases
- ✅ **Time-based windows**: Limits reset gradually

**Example Scenario**:
```
❌ Without Rate Limits:
- Malicious trader locks all available units
- Creates artificial scarcity
- Manipulates market prices

✅ With Rate Limits:
- Trader limited to 20 negotiations per hour
- Cannot lock all units
- Market manipulation prevented
- Legitimate traders can still access units
```

---

### 7. Provides Graceful Failure

**Problem**: Without graceful failure, rate limit violations could:
- Confuse users with unclear errors
- Frustrate legitimate users
- Create support burden

**How Rate Limits Provide**:
- ✅ **Explicit error messages**: Clear indication of limit exceeded
- ✅ **Reset time information**: Users know when limit resets
- ✅ **Actionable information**: Users know what to do
- ✅ **Support contact**: Users can contact support if needed

**Example Error Message**:
```
Rate limit exceeded: You have exceeded the limit of 20 negotiations per hour.
Current count: 21.
Limit resets in approximately 45 minute(s).
This action has been logged for admin review.
If you believe this is an error, please contact support.
```

---

### 8. Enables Gradual Reset

**Problem**: Hard resets could allow spam bursts:
- Limits reset all at once
- Users can spam immediately after reset
- System vulnerable to burst attacks

**How Rate Limits Enable**:
- ✅ **Sliding window**: Limits reset gradually
- ✅ **Time-based windows**: Old actions expire over time
- ✅ **No burst attacks**: Cannot spam immediately after reset
- ✅ **Smooth distribution**: Actions spread over time

**Example Scenario**:
```
❌ With Hard Reset:
- Limit: 20 negotiations per hour
- User makes 20 negotiations at 2:00 PM
- Limit resets at 3:00 PM
- User makes 20 more negotiations at 3:00 PM
- Burst attack possible

✅ With Sliding Window:
- Limit: 20 negotiations per hour
- User makes 20 negotiations at 2:00 PM
- At 3:00 PM, negotiations from 2:00-2:01 PM expire
- User can make 1 more negotiation
- Burst attack prevented
```

---

## Summary: Spam and Manipulation Prevention

### 1. Prevents Rapid-Fire Spam ✅
- Hard limits on actions
- Sliding window enforcement
- Server-side only
- Immediate blocking

### 2. Prevents Manipulation Attempts ✅
- Action limits per role
- Time-based windows
- Logged violations
- Gradual reset

### 3. Prevents System Overload ✅
- Volume control
- Distributed load
- Resource protection
- Performance maintained

### 4. Enables Admin Monitoring ✅
- Complete logging
- Admin visibility
- Pattern detection
- Data-driven adjustments

### 5. Prevents Automated Attacks ✅
- Action limits
- Time-based windows
- Server-side enforcement
- Logged attempts

### 6. Prevents Market Manipulation ✅
- Listing limits
- Negotiation limits
- Purchase limits
- Time-based windows

### 7. Provides Graceful Failure ✅
- Explicit error messages
- Reset time information
- Actionable information
- Support contact

### 8. Enables Gradual Reset ✅
- Sliding window
- Time-based windows
- No burst attacks
- Smooth distribution

---

## Rate Limit Configuration

### Current Limits

| Role | Action | Limit | Window |
|------|--------|-------|--------|
| Trader | Negotiations (lock_unit) | 20 | 1 hour |
| Trader | Wallet operations | 10 | 1 hour |
| Farmer | Listings | 10 | 24 hours |
| Buyer | Purchases | 5 | 1 hour |

### Adjusting Limits

Limits are defined in `convex/constants.ts`:
```typescript
export const RATE_LIMITS = {
  TRADER_NEGOTIATIONS_PER_HOUR: 20,
  TRADER_WALLET_OPERATIONS_PER_HOUR: 10,
  FARMER_LISTINGS_PER_DAY: 10,
  BUYER_PURCHASES_PER_HOUR: 5,
} as const;
```

**To Adjust**:
1. Update constants in `convex/constants.ts`
2. Deploy changes
3. Monitor rate limit hits via admin queries
4. Adjust based on data

---

## Admin Monitoring

### Viewing Rate Limit Hits

**Query**: `getRateLimitHits`

**Example**:
```typescript
// Get all rate limit hits
const hits = await getRateLimitHits({
  adminId: "admin123",
  limit: 100,
});

// Filter by user
const userHits = await getRateLimitHits({
  adminId: "admin123",
  userId: "user456",
});

// Filter by action type
const listingHits = await getRateLimitHits({
  adminId: "admin123",
  actionType: "create_listing",
});
```

### Viewing User Status

**Query**: `getUserRateLimitStatus`

**Example**:
```typescript
// Get user's rate limit status
const status = await getUserRateLimitStatus({
  adminId: "admin123",
  userId: "user456",
});

// Check if user is approaching limits
if (status.statuses.some(s => s.isAtLimit)) {
  // User has hit a limit
}
```

---

## Implementation Checklist

- ✅ Rate limit constants defined
- ✅ Schema updated with `rateLimitHits` table
- ✅ `checkRateLimit` utility function created
- ✅ Rate limit checks added to `lockUnit`
- ✅ Rate limit checks added to `depositCapital`
- ✅ Rate limit checks added to `withdrawProfit`
- ✅ Rate limit checks added to `createListing`
- ✅ Rate limit checks added to `createBuyerPurchase`
- ✅ Admin queries created (`getRateLimitHits`, `getUserRateLimitStatus`)
- ✅ Explicit error messages
- ✅ All hits logged
- ✅ Server-side only enforcement

---

*Implementation Date: Rate limiting system added*  
*Status: Server-side only, graceful failures, admin-visible logging*
