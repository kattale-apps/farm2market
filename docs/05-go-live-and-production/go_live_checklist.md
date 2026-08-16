# Farm2Market Uganda v1 - Go-Live Checklist

## Overview

This checklist ensures a safe and controlled launch of Farm2Market Uganda v1. Follow each section in order, verify all items, and document completion before proceeding to the next phase.

**Critical Rule**: Do not proceed to production until all preconditions are verified and documented.

---

## Phase 1: Preconditions Verification

### 1.1 Infrastructure Readiness

- [ ] **Convex Backend Deployed**
  - [ ] Convex project deployed to production
  - [ ] Production environment variables configured
  - [ ] Database schema deployed and verified
  - [ ] All indexes created and verified
  - [ ] Convex dashboard accessible

- [ ] **Next.js Frontend Deployed**
  - [ ] Frontend deployed to Vercel (or production host)
  - [ ] Production environment variables configured
  - [ ] Convex client configured for production
  - [ ] Frontend accessible and responsive

- [ ] **Domain and SSL**
  - [ ] Production domain configured
  - [ ] SSL certificate valid and active
  - [ ] DNS records properly configured
  - [ ] Domain accessible from multiple locations

- [ ] **Monitoring and Logging**
  - [ ] Error tracking configured (if applicable)
  - [ ] Logging system operational
  - [ ] Monitoring dashboards accessible
  - [ ] Alert system configured (if applicable)

---

### 1.2 Data Integrity

- [ ] **Database Schema**
  - [ ] All tables created (`users`, `walletLedger`, `listings`, `listingUnits`, `traderInventory`, `purchaseWindows`, `buyerPurchases`, `storageFeeDeductions`, `adminActions`, `notifications`, `systemSettings`, `rateLimitHits`)
  - [ ] All indexes created and verified
  - [ ] Foreign key relationships verified (if applicable)
  - [ ] Schema matches production requirements

- [ ] **Initial Data**
  - [ ] At least one admin user created
  - [ ] Admin user can log in
  - [ ] Admin user role verified in database
  - [ ] Test users created (if needed for verification)
  - [ ] No orphaned data in database

- [ ] **Data Validation**
  - [ ] All required fields have proper constraints
  - [ ] UTID generation working correctly
  - [ ] Alias generation working correctly
  - [ ] No duplicate aliases exist

---

### 1.3 Security Verification

- [ ] **Authentication**
  - [ ] User authentication working
  - [ ] Role verification working server-side
  - [ ] Admin-only mutations protected
  - [ ] No client-side role checks (all server-side)

- [ ] **Anonymity**
  - [ ] User aliases generated correctly
  - [ ] No real identities exposed in queries
  - [ ] Only aliases returned in responses
  - [ ] Cross-user data filtering working

- [ ] **Authorization**
  - [ ] Admin actions require admin role
  - [ ] Trader mutations require trader role
  - [ ] Farmer mutations require farmer role
  - [ ] Buyer mutations require buyer role
  - [ ] Unauthorized access attempts blocked

---

### 1.4 Core System Functionality

- [ ] **Wallet System**
  - [ ] Capital deposit working
  - [ ] Capital withdrawal working
  - [ ] Profit withdrawal working
  - [ ] Wallet balance queries working
  - [ ] Ledger entries created with UTIDs

- [ ] **Spend Cap Enforcement**
  - [ ] Spend cap set to UGX 1,000,000
  - [ ] Exposure calculation working correctly
  - [ ] Spend cap enforced before wallet debit
  - [ ] Standardized error returned when cap exceeded

- [ ] **Pay-to-Lock System**
  - [ ] Unit locking atomic (all or nothing)
  - [ ] Wallet debit happens atomically with unit lock
  - [ ] First payment wins (race condition prevented)
  - [ ] Delivery deadline set correctly (6 hours)
  - [ ] Delivery status initialized to "pending"

- [ ] **Rate Limiting**
  - [ ] Rate limits configured correctly
  - [ ] Rate limit checks working
  - [ ] Rate limit hits logged
  - [ ] Standardized errors returned

- [ ] **Pilot Mode**
  - [ ] Pilot mode can be enabled/disabled
  - [ ] Pilot mode blocks mutations correctly
  - [ ] Read-only queries still work in pilot mode
  - [ ] Admin actions still work in pilot mode

---

### 1.5 Admin Functionality

- [ ] **Admin Mutations**
  - [ ] `openPurchaseWindow` working
  - [ ] `closePurchaseWindow` working
  - [ ] `verifyDelivery` working
  - [ ] `reverseDeliveryFailure` working
  - [ ] `setPilotMode` working
  - [ ] All admin actions logged with UTIDs

- [ ] **Admin Queries**
  - [ ] `getAllActiveUTIDs` working
  - [ ] `getWalletLedgerByUTID` working
  - [ ] `getInventoryUnitsByStatus` working
  - [ ] `getDeliverySLAStatusSummary` working
  - [ ] `getBuyerPickupDeadlines` working
  - [ ] `getRedFlagsSummary` working
  - [ ] `getRateLimitHits` working
  - [ ] `getNotificationHistory` working

- [ ] **Admin Notifications**
  - [ ] `sendBroadcastNotification` working
  - [ ] `sendRoleBasedNotification` working
  - [ ] `sendUTIDSpecificNotification` working
  - [ ] Notifications stored correctly
  - [ ] Notification history queryable

---

### 1.6 User Functionality

- [ ] **Trader Dashboard**
  - [ ] `getLedgerBreakdown` working
  - [ ] `getExposureStatus` working
  - [ ] `getTraderActiveUTIDs` working
  - [ ] `getInventoryWithProjectedLoss` working
  - [ ] No cross-user data exposure

- [ ] **Farmer Dashboard**
  - [ ] `getFarmerListings` working
  - [ ] `getActiveNegotiations` working
  - [ ] `getPayToLockConfirmations` working
  - [ ] `getDeliveryDeadlines` working
  - [ ] `getDeliveryStatus` working
  - [ ] No trader identity exposure

- [ ] **Buyer Dashboard**
  - [ ] `getAvailableInventory` working
  - [ ] `getPurchaseWindowStatus` working
  - [ ] `getBuyerOrders` working
  - [ ] `getBuyerActiveOrders` working
  - [ ] No prices shown
  - [ ] No trader identity exposure

---

### 1.7 Error Handling

- [ ] **Standardized Errors**
  - [ ] All mutations return standardized errors
  - [ ] Error codes defined for all common failures
  - [ ] Human-readable messages included
  - [ ] No internal details exposed
  - [ ] No user identities exposed in errors

- [ ] **Error Coverage**
  - [ ] Spend cap exceeded error working
  - [ ] Purchase window closed error working
  - [ ] Pilot mode active error working
  - [ ] Rate limit exceeded error working
  - [ ] Invalid role errors working
  - [ ] Not found errors working

---

## Phase 2: Admin Settings Confirmation

### 2.1 System Settings

- [ ] **Pilot Mode**
  - [ ] Pilot mode status checked
  - [ ] Pilot mode set to `false` (disabled) for production
  - [ ] Reason documented if pilot mode was enabled
  - [ ] Admin who set pilot mode verified

- [ ] **Rate Limits**
  - [ ] Trader negotiations per hour: 20
  - [ ] Trader wallet operations per hour: 10
  - [ ] Farmer listings per day: 10
  - [ ] Buyer purchases per hour: 5
  - [ ] All limits verified in `convex/constants.ts`

- [ ] **Spend Cap**
  - [ ] Maximum trader exposure: UGX 1,000,000
  - [ ] Spend cap constant verified
  - [ ] Spend cap enforcement tested

---

### 2.2 Purchase Windows

- [ ] **Initial Purchase Window**
  - [ ] Purchase window status checked
  - [ ] Purchase window set to `closed` initially
  - [ ] Plan for first purchase window opening documented
  - [ ] Admin who will open first window identified

- [ ] **Purchase Window Process**
  - [ ] Process for opening/closing windows documented
  - [ ] Admin trained on purchase window management
  - [ ] Notification plan for window openings documented

---

### 2.3 Admin Users

- [ ] **Admin Accounts**
  - [ ] At least 2 admin users created (for redundancy)
  - [ ] All admin users can log in
  - [ ] All admin users verified in database
  - [ ] Admin user aliases verified
  - [ ] Admin contact information documented

- [ ] **Admin Training**
  - [ ] Admins trained on delivery verification
  - [ ] Admins trained on purchase window management
  - [ ] Admins trained on pilot mode management
  - [ ] Admins trained on notification system
  - [ ] Admins trained on red-flag queries
  - [ ] Admins trained on rollback procedures

---

### 2.4 Notification System

- [ ] **Notification Readiness**
  - [ ] Notification system tested
  - [ ] Test notifications sent and received
  - [ ] Notification history queryable
  - [ ] Admin trained on notification sending

- [ ] **Initial Notifications**
  - [ ] Welcome notification prepared (if applicable)
  - [ ] System launch notification prepared
  - [ ] Notification recipients identified

---

## Phase 3: Pilot Mode Steps

### 3.1 Enable Pilot Mode

- [ ] **Enable Pilot Mode**
  - [ ] Admin logs in
  - [ ] Call `setPilotMode` mutation:
    - `pilotMode: true`
    - `reason: "Pre-production testing and validation"`
  - [ ] Pilot mode status verified
  - [ ] All mutations blocked (tested)
  - [ ] Read-only queries still work (tested)
  - [ ] Admin actions still work (tested)

---

### 3.2 Pilot Mode Testing

- [ ] **Read-Only Testing**
  - [ ] All dashboard queries tested
  - [ ] All introspection queries tested
  - [ ] No mutations possible (verified)
  - [ ] Error messages clear and helpful

- [ ] **Admin Testing**
  - [ ] Admin can send notifications
  - [ ] Admin can manage purchase windows
  - [ ] Admin can verify deliveries (if test data exists)
  - [ ] Admin can view system state

- [ ] **Error Testing**
  - [ ] Pilot mode errors clear and helpful
  - [ ] Users understand why operations blocked
  - [ ] Error messages don't expose internal details

---

### 3.3 Pilot Mode Validation

- [ ] **System State**
  - [ ] No mutations executed during pilot mode
  - [ ] System state remains clean
  - [ ] No test data corruption
  - [ ] All queries return expected results

- [ ] **User Experience**
  - [ ] Users can view dashboards
  - [ ] Users understand pilot mode status
  - [ ] Error messages are clear
  - [ ] Support ready for pilot mode questions

---

### 3.4 Disable Pilot Mode

- [ ] **Pre-Disable Checklist**
  - [ ] All pilot mode testing completed
  - [ ] System state verified clean
  - [ ] All stakeholders notified
  - [ ] Support team ready
  - [ ] Monitoring dashboards ready

- [ ] **Disable Pilot Mode**
  - [ ] Admin logs in
  - [ ] Call `setPilotMode` mutation:
    - `pilotMode: false`
    - `reason: "Pilot testing complete, ready for production"`
  - [ ] Pilot mode status verified disabled
  - [ ] Mutations now work (tested with small test)
  - [ ] System ready for production use

---

## Phase 4: Rollback Plan

### 4.1 Rollback Triggers

**Immediate Rollback Required If**:
- [ ] Critical security vulnerability discovered
- [ ] Data corruption detected
- [ ] System-wide outage
- [ ] Financial discrepancies detected
- [ ] Unauthorized access detected
- [ ] Critical bug affecting all users

**Consider Rollback If**:
- [ ] High error rate (>10% of operations)
- [ ] Multiple users reporting same issue
- [ ] Performance degradation
- [ ] Support overwhelmed with issues

---

### 4.2 Rollback Procedure

- [ ] **Step 1: Enable Pilot Mode**
  - [ ] Admin logs in immediately
  - [ ] Call `setPilotMode` mutation:
    - `pilotMode: true`
    - `reason: "Emergency rollback - [brief reason]"`
  - [ ] Verify pilot mode enabled
  - [ ] All mutations now blocked

- [ ] **Step 2: Assess Situation**
  - [ ] Review error logs
  - [ ] Check system state
  - [ ] Identify root cause
  - [ ] Determine if rollback sufficient or code fix needed

- [ ] **Step 3: Communicate**
  - [ ] Notify all stakeholders
  - [ ] Send broadcast notification to users:
    - Title: "System Maintenance"
    - Message: "The system is temporarily unavailable for maintenance. We apologize for any inconvenience."
  - [ ] Update status page (if applicable)

- [ ] **Step 4: Fix or Revert**
  - [ ] If code fix needed: Deploy fix
  - [ ] If revert needed: Revert to previous version
  - [ ] Test fix/revert in staging
  - [ ] Verify system state

- [ ] **Step 5: Re-enable (If Fixed)**
  - [ ] Verify fix working
  - [ ] Test critical paths
  - [ ] Disable pilot mode
  - [ ] Monitor closely

---

### 4.3 Rollback Documentation

- [ ] **Rollback Log**
  - [ ] Timestamp of rollback
  - [ ] Reason for rollback
  - [ ] Admin who executed rollback
  - [ ] Actions taken
  - [ ] Resolution (if applicable)
  - [ ] Lessons learned

---

## Phase 5: First 24-Hour Monitoring Checklist

### 5.1 Hour 0-1: Initial Launch

**Every 15 Minutes**:
- [ ] Check system health (Convex dashboard)
- [ ] Check error rates
- [ ] Check active user count
- [ ] Verify no critical errors
- [ ] Check pilot mode status (should be `false`)

**Immediate Actions If Issues**:
- [ ] Enable pilot mode if critical issue
- [ ] Notify stakeholders
- [ ] Begin rollback procedure if needed

---

### 5.2 Hour 1-4: Early Operations

**Every 30 Minutes**:
- [ ] Check red flags summary (`getRedFlagsSummary`)
  - [ ] Deliveries past SLA: Should be 0 initially
  - [ ] Traders near spend cap: Monitor
  - [ ] High storage loss inventory: Should be 0 initially
  - [ ] Buyers approaching pickup SLA: Should be 0 initially

- [ ] Check error rates
  - [ ] Total errors
  - [ ] Error types
  - [ ] Most common errors

- [ ] Check rate limit hits (`getRateLimitHits`)
  - [ ] Total hits
  - [ ] Users hitting limits
  - [ ] Action types

- [ ] Check system activity
  - [ ] Active listings
  - [ ] Active negotiations
  - [ ] Active purchases
  - [ ] Wallet operations

**Actions If Issues**:
- [ ] Investigate high error rates
- [ ] Review rate limit hits (may indicate spam)
- [ ] Check for unusual patterns
- [ ] Contact users if needed

---

### 5.3 Hour 4-12: Steady State

**Every Hour**:
- [ ] Check red flags summary
- [ ] Check error rates
- [ ] Check rate limit hits
- [ ] Review admin action log
- [ ] Check notification delivery
- [ ] Verify purchase windows (if opened)

**Review**:
- [ ] First transactions completed successfully
- [ ] Delivery deadlines set correctly
- [ ] Wallet operations working
- [ ] No data corruption
- [ ] User feedback (if available)

**Actions If Issues**:
- [ ] Investigate specific issues
- [ ] Review transaction logs
- [ ] Check UTID chains
- [ ] Verify system state

---

### 5.4 Hour 12-24: Extended Monitoring

**Every 2 Hours**:
- [ ] Check red flags summary
- [ ] Check error rates
- [ ] Check rate limit hits
- [ ] Review system state
- [ ] Check for SLA violations

**Deep Review**:
- [ ] All UTIDs tracked correctly (`getAllActiveUTIDs`)
- [ ] Wallet ledger balanced (`getWalletLedgerByUTID`)
- [ ] Delivery SLAs tracked (`getDeliverySLAStatusSummary`)
- [ ] Purchase windows managed correctly
- [ ] Notifications delivered

**Actions If Issues**:
- [ ] Investigate and resolve issues
- [ ] Document patterns
- [ ] Update procedures if needed
- [ ] Communicate with users if needed

---

### 5.5 Critical Metrics to Monitor

- [ ] **Error Rates**
  - [ ] Total errors per hour
  - [ ] Error rate percentage
  - [ ] Most common error codes
  - [ ] Error trends (increasing/decreasing)

- [ ] **Transaction Success Rates**
  - [ ] Successful unit locks
  - [ ] Successful purchases
  - [ ] Successful wallet operations
  - [ ] Failed transactions and reasons

- [ ] **System Performance**
  - [ ] Query response times
  - [ ] Mutation execution times
  - [ ] Database performance
  - [ ] Frontend load times

- [ ] **User Activity**
  - [ ] Active users
  - [ ] New user registrations
  - [ ] User role distribution
  - [ ] User engagement metrics

- [ ] **Financial Metrics**
  - [ ] Total capital deposited
  - [ ] Total capital locked
  - [ ] Total profit withdrawn
  - [ ] Trader exposure levels

- [ ] **SLA Compliance**
  - [ ] Deliveries on time
  - [ ] Deliveries past SLA
  - [ ] Pickups on time
  - [ ] Pickups past SLA

---

### 5.6 Red Flag Monitoring

**Check Every Hour**:
- [ ] `getDeliveriesPastSLA`
  - [ ] Count of overdue deliveries
  - [ ] Average hours overdue
  - [ ] Total locked capital at risk

- [ ] `getTradersNearSpendCap`
  - [ ] Traders at >80% exposure
  - [ ] Traders at >90% exposure
  - [ ] Traders at >95% exposure

- [ ] `getHighStorageLossInventory`
  - [ ] Inventory with >10% loss
  - [ ] Total kilos at risk
  - [ ] Total value at risk

- [ ] `getBuyersApproachingPickupSLA`
  - [ ] Purchases approaching deadline
  - [ ] Purchases past deadline
  - [ ] Total inventory stuck

**Actions If Red Flags**:
- [ ] Investigate root cause
- [ ] Take corrective action
- [ ] Notify affected users
- [ ] Document issue and resolution

---

### 5.7 Support Readiness

- [ ] **Support Team**
  - [ ] Support team on standby
  - [ ] Support channels monitored
  - [ ] Escalation path defined
  - [ ] Support documentation accessible

- [ ] **Common Issues**
  - [ ] FAQ prepared
  - [ ] Troubleshooting guide ready
  - [ ] Error code reference available
  - [ ] Contact information available

- [ ] **Communication**
  - [ ] User communication channels ready
  - [ ] Notification templates prepared
  - [ ] Status update process defined
  - [ ] Emergency contact list ready

---

## Phase 6: Post-Launch Validation

### 6.1 First Transaction Validation

- [ ] **First Listing Created**
  - [ ] Farmer can create listing
  - [ ] Listing UTID generated
  - [ ] Units created correctly
  - [ ] Listing visible to traders

- [ ] **First Unit Locked**
  - [ ] Trader can lock unit
  - [ ] Lock UTID generated
  - [ ] Capital locked in wallet
  - [ ] Delivery deadline set
  - [ ] Delivery status set to "pending"

- [ ] **First Purchase Window Opened**
  - [ ] Admin can open purchase window
  - [ ] Window UTID generated
  - [ ] Buyers can see window status
  - [ ] Buyers can make purchases

- [ ] **First Purchase Made**
  - [ ] Buyer can purchase inventory
  - [ ] Purchase UTID generated
  - [ ] Inventory locked correctly
  - [ ] Pickup deadline set

---

### 6.2 System State Validation

- [ ] **UTID Tracking**
  - [ ] All UTIDs tracked correctly
  - [ ] UTID chains complete
  - [ ] No orphaned UTIDs
  - [ ] UTID queries working

- [ ] **Wallet Integrity**
  - [ ] All wallet entries have UTIDs
  - [ ] Balances calculated correctly
  - [ ] No missing ledger entries
  - [ ] Exposure calculated correctly

- [ ] **Data Consistency**
  - [ ] No orphaned records
  - [ ] Foreign key relationships intact
  - [ ] Status fields consistent
  - [ ] Timestamps correct

---

### 6.3 User Experience Validation

- [ ] **Dashboard Functionality**
  - [ ] Traders can view dashboard
  - [ ] Farmers can view dashboard
  - [ ] Buyers can view dashboard
  - [ ] No cross-user data exposure

- [ ] **Error Handling**
  - [ ] Errors clear and helpful
  - [ ] No internal details exposed
  - [ ] Users understand errors
  - [ ] Support not overwhelmed

- [ ] **Notifications**
  - [ ] Users receive notifications
  - [ ] Notifications readable
  - [ ] Notification history queryable
  - [ ] Users can mark as read

---

## Phase 7: Documentation and Handoff

### 7.1 Documentation

- [ ] **System Documentation**
  - [ ] Architecture documented
  - [ ] API documentation complete
  - [ ] Error codes documented
  - [ ] Admin procedures documented

- [ ] **Runbooks**
  - [ ] Go-live checklist (this document)
  - [ ] Rollback procedure
  - [ ] Common issues and resolutions
  - [ ] Admin operation guides

- [ ] **Training Materials**
  - [ ] Admin training complete
  - [ ] User guides available
  - [ ] Support team trained
  - [ ] Troubleshooting guides ready

---

### 7.2 Handoff

- [ ] **Team Handoff**
  - [ ] Operations team briefed
  - [ ] Support team briefed
  - [ ] Admin team briefed
  - [ ] Escalation paths defined

- [ ] **Access and Credentials**
  - [ ] Admin credentials secured
  - [ ] Access logs reviewed
  - [ ] Password policies enforced
  - [ ] Two-factor authentication (if applicable)

---

## Sign-Off

### Pre-Launch Sign-Off

**Technical Lead**:
- [ ] All preconditions verified
- [ ] System tested and validated
- [ ] Ready for production launch
- [ ] Signature: _________________ Date: ___________

**Product Owner**:
- [ ] Requirements met
- [ ] User experience validated
- [ ] Ready for production launch
- [ ] Signature: _________________ Date: ___________

**Operations Lead**:
- [ ] Monitoring ready
- [ ] Support ready
- [ ] Procedures documented
- [ ] Ready for production launch
- [ ] Signature: _________________ Date: ___________

---

### Post-Launch Sign-Off (After 24 Hours)

**Technical Lead**:
- [ ] System stable
- [ ] No critical issues
- [ ] Performance acceptable
- [ ] Signature: _________________ Date: ___________

**Product Owner**:
- [ ] User feedback positive
- [ ] No major issues
- [ ] System meeting expectations
- [ ] Signature: _________________ Date: ___________

**Operations Lead**:
- [ ] Monitoring effective
- [ ] Support manageable
- [ ] Procedures working
- [ ] Signature: _________________ Date: ___________

---

## Emergency Contacts

**Technical Escalation**:
- Primary: _________________ Phone: _________________
- Secondary: _________________ Phone: _________________

**Business Escalation**:
- Primary: _________________ Phone: _________________
- Secondary: _________________ Phone: _________________

**Support Lead**:
- Primary: _________________ Phone: _________________
- Secondary: _________________ Phone: _________________

---

## Notes and Observations

**Pre-Launch Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Launch Notes**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

**Post-Launch Notes (24 Hours)**:
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________

---

*Document Version: 1.0*  
*Last Updated: [Date]*  
*Next Review: [Date]*
