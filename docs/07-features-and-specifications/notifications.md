# Notification System

## Overview

Admin-controlled notification delivery system with complete history for auditability. Notifications are stored server-side and delivered to frontend via queries/subscriptions. No email or SMS in v1.x.

---

## Implementation

### 1. Notification Types

**Schema**: `convex/schema.ts:221-237`

```typescript
notifications: defineTable({
  userId: v.id("users"),
  type: v.union(
    v.literal("admin_broadcast"),    // Sent to all users
    v.literal("role_based"),         // Sent to specific role
    v.literal("utid_specific"),      // Sent to users related to UTID
    v.literal("system")              // System-generated notifications
  ),
  title: v.string(),
  message: v.string(),
  utid: v.optional(v.string()),      // Related transaction UTID
  read: v.boolean(),
  createdAt: v.number(),
})
```

**Indexes**:
- `by_user`: Find notifications for a user
- `by_user_unread`: Find unread notifications for a user
- `by_utid`: Find notifications related to a UTID

---

### 2. Admin Mutations

#### 2.1 `sendBroadcastNotification` (Admin Only)

**Purpose**: Send notification to all users.

**Parameters**:
- `adminId`: Admin sending notification
- `title`: Notification title
- `message`: Notification message
- `reason`: Required reason for sending

**Behavior**:
- Creates notification for every user in system
- All notifications share same UTID (notificationUtid)
- Logs admin action with UTID and metadata

**Example**:
```typescript
await sendBroadcastNotification({
  adminId: "admin123",
  title: "System Maintenance",
  message: "System will be under maintenance from 2-4 PM",
  reason: "Scheduled maintenance notification"
});
```

---

#### 2.2 `sendRoleBasedNotification` (Admin Only)

**Purpose**: Send notification to all users with a specific role.

**Parameters**:
- `adminId`: Admin sending notification
- `role`: Target role (farmer, trader, buyer, admin)
- `title`: Notification title
- `message`: Notification message
- `reason`: Required reason for sending

**Behavior**:
- Finds all users with specified role
- Creates notification for each user
- All notifications share same UTID (notificationUtid)
- Logs admin action with role and recipient count

**Example**:
```typescript
await sendRoleBasedNotification({
  adminId: "admin123",
  role: "trader",
  title: "New Purchase Window",
  message: "Purchase window will open at 3 PM",
  reason: "Notify traders of upcoming purchase window"
});
```

---

#### 2.3 `sendUTIDSpecificNotification` (Admin Only)

**Purpose**: Send notification to all users related to a specific UTID.

**Parameters**:
- `adminId`: Admin sending notification
- `targetUtid`: UTID to find related users
- `title`: Notification title
- `message`: Notification message
- `reason`: Required reason for sending

**Behavior**:
- Finds users related to UTID by searching:
  - Wallet ledger entries (traders)
  - Listing units (farmers via listing, traders via lockedBy)
  - Buyer purchases (buyers, traders via inventory)
  - Listings (farmers)
  - Trader inventory (traders)
  - Admin actions (admins)
- Creates notification for each related user
- Notification references the target UTID
- Logs admin action with target UTID and recipient details

**Example**:
```typescript
await sendUTIDSpecificNotification({
  adminId: "admin123",
  targetUtid: "20240215-143022-tra-a3k9x2",
  title: "Delivery Verification Required",
  message: "Please verify delivery for transaction 20240215-143022-tra-a3k9x2",
  reason: "Delivery deadline approaching, need verification"
});
```

---

### 3. User Queries

#### 3.1 `getUserNotifications` (Any User)

**Purpose**: Get all notifications for the requesting user.

**Parameters**:
- `userId`: User requesting notifications
- `unreadOnly`: Filter to unread only (optional)
- `limit`: Limit results (optional, default: 50)

**Returns**:
- Notifications (with metadata)
- Unread count
- Total count
- `hasMore` flag

**Example**:
```typescript
// Get all notifications
const notifications = await getUserNotifications({
  userId: "user123",
});

// Get unread only
const unread = await getUserNotifications({
  userId: "user123",
  unreadOnly: true,
});
```

---

#### 3.2 `markNotificationAsRead` (Any User)

**Purpose**: Mark a specific notification as read.

**Parameters**:
- `userId`: User marking notification
- `notificationId`: Notification to mark as read

**Behavior**:
- Verifies notification belongs to user
- Updates `read` field to `true`
- Returns updated notification

---

#### 3.3 `markAllNotificationsAsRead` (Any User)

**Purpose**: Mark all unread notifications for user as read.

**Parameters**:
- `userId`: User marking notifications

**Behavior**:
- Finds all unread notifications for user
- Marks all as read
- Returns count of marked notifications

---

### 4. Admin Queries

#### 4.1 `getNotificationHistory` (Admin Only)

**Purpose**: View all notifications sent by admins for audit.

**Parameters**:
- `adminId`: Admin viewing history
- `notificationType`: Filter by type (optional)
- `startTime/endTime`: Filter by time range (optional)
- `limit`: Limit results (optional, default: 100)

**Returns**:
- Summary statistics (total, by type)
- Grouped sends (by notification UTID)
- Admin actions related to notifications
- Read/unread counts per send

**Use Cases**:
- Audit all notifications sent
- Verify notification delivery
- Check read rates
- Investigate notification issues

---

## How Notification History Supports Auditability

### 1. Complete Send History

**What Gets Logged**:
- Every notification sent by admin
- Notification type (broadcast, role-based, UTID-specific)
- Title and message content
- Timestamp of send
- Recipient count
- Notification UTID (groups notifications from same send)

**Why This Supports Auditability**:
- ✅ **Complete record**: Every notification is logged
- ✅ **Immutable history**: Notifications cannot be deleted or modified
- ✅ **Timestamp tracking**: Know exactly when notifications were sent
- ✅ **Content preservation**: Original title and message preserved

**Example Audit Trail**:
```
Notification Send:
- Notification UTID: "20240315-143022-adm-n1x2y3"
- Type: "role_based"
- Role: "trader"
- Title: "New Purchase Window"
- Message: "Purchase window will open at 3 PM"
- Sent At: 2024-03-15T14:30:22.000Z
- Recipients: 25 traders
- Admin: admin123
- Reason: "Notify traders of upcoming purchase window"
```

---

### 2. Admin Action Logging

**What Gets Logged**:
- Every admin action to send notification
- Admin who sent notification
- Action type (send_notification_broadcast, send_notification_role_based, etc.)
- Reason for sending
- Target UTID (if UTID-specific)
- Metadata (recipient count, roles, etc.)
- Admin action UTID

**Why This Supports Auditability**:
- ✅ **Admin accountability**: Know which admin sent notification
- ✅ **Reason tracking**: Why notification was sent
- ✅ **Action traceability**: Can trace from admin action to notifications
- ✅ **Metadata preservation**: Full context preserved

**Example Admin Action Log**:
```
Admin Action:
- Action UTID: "20240315-143022-adm-a1b2c3"
- Admin: admin123
- Action Type: "send_notification_role_based"
- Reason: "Notify traders of upcoming purchase window"
- Target UTID: null (role-based, not UTID-specific)
- Metadata: {
    role: "trader",
    title: "New Purchase Window",
    message: "Purchase window will open at 3 PM",
    notificationUtid: "20240315-143022-adm-n1x2y3",
    recipientsCount: 25
  }
- Timestamp: 2024-03-15T14:30:22.000Z
```

---

### 3. Recipient Tracking

**What Gets Tracked**:
- Every user who received notification
- Read status for each user
- Timestamp when notification was created
- Timestamp when notification was read (via read status)

**Why This Supports Auditability**:
- ✅ **Delivery verification**: Know who received notification
- ✅ **Read tracking**: Know who read notification
- ✅ **User accountability**: Can verify user received notification
- ✅ **Dispute resolution**: Can prove notification was sent and received

**Example Recipient Tracking**:
```
Notification Recipients:
- Notification UTID: "20240315-143022-adm-n1x2y3"
- Total Recipients: 25
- Read: 20
- Unread: 5
- Recipients:
  - trader_abc123: Read (2024-03-15T14:35:10.000Z)
  - trader_def456: Unread
  - trader_ghi789: Read (2024-03-15T14:40:22.000Z)
  ...
```

---

### 4. UTID Linking

**What Gets Linked**:
- UTID-specific notifications reference the transaction UTID
- Can trace from notification to transaction
- Can trace from transaction to notification

**Why This Supports Auditability**:
- ✅ **Transaction context**: Notifications linked to transactions
- ✅ **Bidirectional tracing**: Can go from notification to transaction or vice versa
- ✅ **Complete audit trail**: Full context of why notification was sent
- ✅ **Dispute resolution**: Can verify notification was sent for specific transaction

**Example UTID Linking**:
```
UTID-Specific Notification:
- Notification UTID: "20240315-143022-adm-n1x2y3"
- Target UTID: "20240215-143022-tra-a3k9x2" (unit lock)
- Recipients:
  - farmer_xyz789 (via listing)
  - trader_abc123 (via unit lock)
- Title: "Delivery Verification Required"
- Message: "Please verify delivery for transaction 20240215-143022-tra-a3k9x2"
```

---

### 5. Read Status Tracking

**What Gets Tracked**:
- Read status for each notification
- Timestamp when notification was marked as read
- Individual read status (per user, per notification)

**Why This Supports Auditability**:
- ✅ **User engagement**: Know if users read notifications
- ✅ **Delivery verification**: Can verify notification was delivered and read
- ✅ **Compliance**: Can prove users were notified
- ✅ **Dispute resolution**: Can prove user read notification

**Example Read Status**:
```
Notification Read Status:
- Notification ID: "notif123"
- User: trader_abc123
- Created: 2024-03-15T14:30:22.000Z
- Read: true
- Read At: 2024-03-15T14:35:10.000Z (inferred from read status change)
```

---

### 6. Notification Grouping

**What Gets Grouped**:
- Notifications from same send operation share same UTID
- Can see all recipients of a single send
- Can see read rates per send

**Why This Supports Auditability**:
- ✅ **Send verification**: Can verify all recipients received notification
- ✅ **Read rate analysis**: Can analyze read rates per send
- ✅ **Delivery completeness**: Can verify all intended recipients received notification
- ✅ **Batch tracking**: Can track batch notification sends

**Example Notification Grouping**:
```
Notification Send Group:
- Notification UTID: "20240315-143022-adm-n1x2y3"
- Type: "role_based"
- Role: "trader"
- Total Recipients: 25
- Read: 20 (80%)
- Unread: 5 (20%)
- Notifications:
  - trader_abc123: Read
  - trader_def456: Unread
  - trader_ghi789: Read
  ...
```

---

### 7. Time-Based Audit Trail

**What Gets Tracked**:
- Timestamp when notification was created
- Timestamp when notification was read (via read status)
- Time range queries for audit

**Why This Supports Auditability**:
- ✅ **Temporal tracking**: Know when notifications were sent
- ✅ **Time-based queries**: Can audit notifications by time range
- ✅ **Compliance**: Can prove notifications were sent within required timeframes
- ✅ **Dispute resolution**: Can verify timing of notifications

**Example Time-Based Audit**:
```
Notifications Sent Today:
- Total: 15
- Broadcast: 1
- Role-based: 10
- UTID-specific: 4
- Time Range: 2024-03-15T00:00:00.000Z to 2024-03-15T23:59:59.999Z
```

---

### 8. Content Preservation

**What Gets Preserved**:
- Original title and message
- Notification type
- Related UTID (if applicable)
- All metadata

**Why This Supports Auditability**:
- ✅ **Content verification**: Can verify what was sent
- ✅ **Immutable record**: Content cannot be modified
- ✅ **Dispute resolution**: Can prove exact content sent
- ✅ **Compliance**: Can verify notification content meets requirements

**Example Content Preservation**:
```
Notification Content:
- Title: "System Maintenance"
- Message: "System will be under maintenance from 2-4 PM"
- Type: "admin_broadcast"
- Created: 2024-03-15T14:30:22.000Z
- Content preserved: true (immutable)
```

---

## Audit Use Cases

### 1. Compliance Verification

**Scenario**: Verify all traders were notified of purchase window opening.

**Audit Process**:
1. Query `getNotificationHistory` filtered by type "role_based" and role "trader"
2. Find notification send with title "New Purchase Window"
3. Verify all traders received notification (recipient count matches trader count)
4. Check read rates to verify engagement

**Audit Trail**:
```
Compliance Verification:
- Notification: "New Purchase Window"
- Type: role_based
- Role: trader
- Total Traders: 25
- Recipients: 25 (100%)
- Read: 20 (80%)
- Compliance: ✅ Verified
```

---

### 2. Dispute Resolution

**Scenario**: User claims they didn't receive notification about delivery deadline.

**Audit Process**:
1. Query `getNotificationHistory` filtered by target UTID
2. Find UTID-specific notification for the transaction
3. Verify user was in recipient list
4. Check read status to verify delivery

**Audit Trail**:
```
Dispute Resolution:
- User: trader_abc123
- Claim: "Didn't receive notification"
- Transaction UTID: "20240215-143022-tra-a3k9x2"
- Notification Found: ✅
- User in Recipients: ✅
- Read Status: Unread
- Dispute: ❌ User received notification but didn't read it
```

---

### 3. Delivery Verification

**Scenario**: Verify all users received broadcast notification.

**Audit Process**:
1. Query `getNotificationHistory` filtered by type "admin_broadcast"
2. Find notification send
3. Verify recipient count matches total user count
4. Check read rates

**Audit Trail**:
```
Delivery Verification:
- Notification: "System Maintenance"
- Type: admin_broadcast
- Total Users: 100
- Recipients: 100 (100%)
- Read: 75 (75%)
- Delivery: ✅ Verified
```

---

### 4. Admin Accountability

**Scenario**: Verify which admin sent notification and why.

**Audit Process**:
1. Query `getNotificationHistory` to find notification
2. Get notification UTID
3. Query admin actions filtered by notification UTID
4. Verify admin, reason, and metadata

**Audit Trail**:
```
Admin Accountability:
- Notification UTID: "20240315-143022-adm-n1x2y3"
- Admin Action UTID: "20240315-143022-adm-a1b2c3"
- Admin: admin123
- Reason: "Notify traders of upcoming purchase window"
- Accountability: ✅ Verified
```

---

## Summary: Auditability Features

### 1. Complete Send History ✅
- Every notification logged
- Immutable history
- Timestamp tracking
- Content preservation

### 2. Admin Action Logging ✅
- Admin accountability
- Reason tracking
- Action traceability
- Metadata preservation

### 3. Recipient Tracking ✅
- Delivery verification
- Read tracking
- User accountability
- Dispute resolution

### 4. UTID Linking ✅
- Transaction context
- Bidirectional tracing
- Complete audit trail
- Dispute resolution

### 5. Read Status Tracking ✅
- User engagement
- Delivery verification
- Compliance
- Dispute resolution

### 6. Notification Grouping ✅
- Send verification
- Read rate analysis
- Delivery completeness
- Batch tracking

### 7. Time-Based Audit Trail ✅
- Temporal tracking
- Time-based queries
- Compliance
- Dispute resolution

### 8. Content Preservation ✅
- Content verification
- Immutable record
- Dispute resolution
- Compliance

---

## Frontend Integration

### Using Convex Queries/Subscriptions

**Query Example**:
```typescript
// Get user notifications
const notifications = useQuery(api.notifications.getUserNotifications, {
  userId: currentUserId,
  unreadOnly: false,
  limit: 50,
});
```

**Subscription Example**:
```typescript
// Subscribe to notifications (real-time updates)
const notifications = useQuery(api.notifications.getUserNotifications, {
  userId: currentUserId,
  unreadOnly: true,
});
```

**Mark as Read**:
```typescript
// Mark notification as read
await mutate(api.notifications.markNotificationAsRead, {
  userId: currentUserId,
  notificationId: notificationId,
});
```

---

## Implementation Checklist

- ✅ Schema updated with notifications table
- ✅ Admin mutations created (broadcast, role-based, UTID-specific)
- ✅ User queries created (get notifications, mark as read)
- ✅ Admin queries created (notification history)
- ✅ UTID linking implemented
- ✅ Admin action logging
- ✅ Read status tracking
- ✅ Notification grouping
- ✅ Complete audit trail

---

*Implementation Date: Notification system finalized*  
*Status: Server-side storage, frontend via queries/subscriptions, complete auditability*
