# Farm2Market Uganda v1 - Pilot Configuration

## Overview

This document defines the pilot configuration for Farm2Market Uganda v1. The pilot phase is a controlled, limited-scale launch to validate system functionality, user behavior, and operational procedures before full production rollout.

**Pilot Duration**: Minimum 30 days, maximum 90 days  
**Pilot Goal**: Validate system with real users in controlled environment  
**Exit Criteria**: Must meet all criteria before exiting pilot

---

## User Limits

### Maximum Number of Users

**Farmers**: **10 farmers maximum**
- Rationale: Small enough to manage, large enough to test system
- Allows testing of listing creation, delivery SLAs, and farmer dashboard
- Enables monitoring of farmer behavior patterns
- Prevents system overload during pilot

**Traders**: **5 traders maximum**
- Rationale: Traders are the most active users (most transactions)
- Allows testing of spend cap, exposure calculations, and trader dashboard
- Enables monitoring of trading patterns and capacity utilization
- Prevents financial risk concentration

**Buyers**: **10 buyers maximum**
- Rationale: Buyers need inventory to purchase (dependent on traders)
- Allows testing of purchase windows, pickup SLAs, and buyer dashboard
- Enables monitoring of purchase patterns
- Prevents inventory demand overload

**Admins**: **2-3 admins recommended**
- Rationale: Need redundancy but not too many decision-makers
- Allows testing of admin functions and decision-making
- Enables 24/7 coverage if needed
- Prevents decision conflicts

**Total Pilot Users**: **25-28 users maximum**

---

## Initial Storage Rates

### Storage Fee Configuration

**Default Rate**: **0.5 kilos per day per 100kg block**

**Calculation**:
- 100kg block = 1 block
- Storage fee: 0.5 kg/day per block
- Example: 200kg inventory = 2 blocks × 0.5 kg/day = 1 kg/day lost

**Pilot Adjustments** (if needed):
- Can be adjusted by admin during pilot
- Should be monitored for impact on traders
- Should not exceed 1.0 kg/day per 100kg block during pilot

**Storage Fee Tracking**:
- Fees calculated server-side
- Projected loss visible to traders
- Actual deductions logged with UTIDs
- Admin can monitor storage fee impact

**Rationale**:
- Encourages timely inventory movement
- Prevents inventory hoarding
- Creates incentive for traders to sell quickly
- Low enough to not penalize legitimate storage

---

## Spend Cap Confirmation

### Trader Exposure Limit

**Spend Cap**: **UGX 1,000,000 (One Million Uganda Shillings)**

**What Counts Toward Cap**:
- Locked capital (capital locked in pending transactions)
- Locked orders value (value of locked units)
- Inventory value (value of inventory in storage)

**Calculation**:
```
Total Exposure = Locked Capital + Locked Orders Value + Inventory Value
```

**Enforcement**:
- Checked BEFORE any wallet debit
- Atomic enforcement (cannot bypass)
- Standardized error if exceeded
- No exceptions during pilot

**Pilot Validation**:
- ✅ Spend cap set to UGX 1,000,000
- ✅ Enforcement tested and verified
- ✅ Error messages clear and helpful
- ✅ No way to bypass cap

**Why This Cap**:
- Limits financial risk per trader
- Ensures fair capacity distribution
- Prevents single trader from dominating
- Manageable for pilot phase

**Monitoring During Pilot**:
- Track traders approaching cap (>80%)
- Monitor exposure distribution
- Identify if cap is too low (traders frequently blocked)
- Identify if cap is too high (single trader dominating)

---

## Pilot Mode Usage Rules

### When to Enable Pilot Mode

**Enable Pilot Mode When**:
1. **Before Production Launch**
   - Enable before first real users
   - Test system with read-only queries
   - Validate UI and user experience
   - Test admin functions

2. **During System Updates**
   - Enable before deploying updates
   - Test new features safely
   - Validate system behavior
   - Disable after validation

3. **During Issue Investigation**
   - Enable if critical issue detected
   - Protect system state
   - Investigate safely
   - Disable after resolution

4. **During Maintenance**
   - Enable during maintenance windows
   - Prevent accidental operations
   - Ensure clean maintenance
   - Disable after maintenance

### When NOT to Enable Pilot Mode

**Do NOT Enable Pilot Mode When**:
1. **During Normal Operations**
   - Users need to perform transactions
   - System needs full functionality
   - No issues detected

2. **During Critical Operations**
   - System needs full functionality
   - Users need to complete transactions
   - No maintenance needed

### Pilot Mode Procedures

#### Enabling Pilot Mode

1. **Pre-Enable Checklist**
   - [ ] All stakeholders notified
   - [ ] Support team ready
   - [ ] Monitoring dashboards ready
   - [ ] Reason for enabling documented

2. **Enable Pilot Mode**
   ```
   Mutation: setPilotMode
   Parameters:
   - pilotMode: true
   - reason: "[Clear reason for enabling]"
   ```

3. **Verify Pilot Mode Active**
   - [ ] Check pilot mode status
   - [ ] Test that mutations are blocked
   - [ ] Verify read-only queries work
   - [ ] Verify admin actions work

#### Disabling Pilot Mode

1. **Pre-Disable Checklist**
   - [ ] All testing completed
   - [ ] System state verified clean
   - [ ] All stakeholders notified
   - [ ] Support team ready

2. **Disable Pilot Mode**
   ```
   Mutation: setPilotMode
   Parameters:
   - pilotMode: false
   - reason: "[Clear reason for disabling]"
   ```

3. **Verify Pilot Mode Disabled**
   - [ ] Check pilot mode status
   - [ ] Test that mutations work
   - [ ] Verify system fully operational
   - [ ] Monitor for issues

### Pilot Mode Best Practices

**DO**:
- ✅ Enable pilot mode for testing
- ✅ Use clear reason codes
- ✅ Notify users when enabling
- ✅ Monitor system during pilot mode
- ✅ Disable promptly when ready

**DON'T**:
- ❌ Leave pilot mode enabled unnecessarily
- ❌ Enable pilot mode during active operations
- ❌ Use vague reason codes
- ❌ Forget to notify users
- ❌ Skip verification steps

---

## Criteria to Exit Pilot

### Minimum Pilot Duration

**Minimum**: **30 days**
- Allows collection of meaningful data
- Enables pattern identification
- Provides sufficient transaction volume
- Allows for multiple cycles (listings → deliveries → purchases)

**Maximum**: **90 days**
- Prevents indefinite pilot phase
- Ensures timely production launch
- Maintains momentum
- Prevents pilot fatigue

### Exit Criteria Checklist

#### 1. System Stability ✅

**Requirements**:
- [ ] **Zero critical bugs** for 7 consecutive days
- [ ] **Error rate < 1%** of all operations
- [ ] **No data corruption** incidents
- [ ] **No security breaches**
- [ ] **System uptime > 99%**

**Validation**:
- Review error logs for 7 days
- Check system health metrics
- Verify data integrity
- Review security logs

**If Not Met**:
- Extend pilot until criteria met
- Fix critical issues
- Re-test for 7 days
- Re-evaluate

---

#### 2. Transaction Success Rate ✅

**Requirements**:
- [ ] **Pay-to-lock success rate > 95%**
- [ ] **Delivery on-time rate > 80%**
- [ ] **Purchase success rate > 95%**
- [ ] **Admin verification response time < 2 hours**

**Validation**:
- Review transaction logs
- Calculate success rates
- Review delivery performance
- Review admin response times

**If Not Met**:
- Identify root causes
- Improve processes
- Re-test
- Re-evaluate

---

#### 3. User Engagement ✅

**Requirements**:
- [ ] **At least 50% of users active** (performed at least 1 transaction)
- [ ] **At least 3 farmers created listings**
- [ ] **At least 2 traders made purchases**
- [ ] **At least 2 buyers made purchases**

**Validation**:
- Review user activity logs
- Count active users by role
- Verify minimum participation

**If Not Met**:
- Increase user engagement
- Provide training
- Address barriers
- Re-evaluate

---

#### 4. Financial Integrity ✅

**Requirements**:
- [ ] **Zero financial discrepancies**
- [ ] **All wallet balances accurate**
- [ ] **All UTIDs tracked correctly**
- [ ] **No missing transactions**

**Validation**:
- Audit wallet ledger
- Verify UTID chains
- Reconcile balances
- Check for orphaned transactions

**If Not Met**:
- Investigate discrepancies
- Fix issues
- Re-audit
- Re-evaluate

---

#### 5. Admin Operations ✅

**Requirements**:
- [ ] **All deliveries verified within 24 hours**
- [ ] **All reversals completed correctly**
- [ ] **All admin actions logged with UTIDs**
- [ ] **No admin errors or mistakes**

**Validation**:
- Review admin action log
- Check delivery verification times
- Verify reversal procedures
- Review admin decision quality

**If Not Met**:
- Improve admin training
- Refine procedures
- Re-test
- Re-evaluate

---

#### 6. System Performance ✅

**Requirements**:
- [ ] **Query response time < 2 seconds** (95th percentile)
- [ ] **Mutation execution time < 5 seconds** (95th percentile)
- [ ] **No system overload incidents**
- [ ] **System handles peak load**

**Validation**:
- Review performance metrics
- Check response times
- Review system load
- Test peak capacity

**If Not Met**:
- Optimize performance
- Scale infrastructure
- Re-test
- Re-evaluate

---

#### 7. User Experience ✅

**Requirements**:
- [ ] **User satisfaction > 80%** (if surveyed)
- [ ] **Support requests manageable** (< 5 per day)
- [ ] **Error messages clear and helpful**
- [ ] **No major UX issues reported**

**Validation**:
- Review user feedback
- Check support request volume
- Review error message quality
- Check UX issue reports

**If Not Met**:
- Address UX issues
- Improve error messages
- Provide better support
- Re-evaluate

---

#### 8. Documentation Complete ✅

**Requirements**:
- [ ] **All procedures documented**
- [ ] **Admin playbook complete**
- [ ] **User guides available**
- [ ] **Troubleshooting guides ready**

**Validation**:
- Review documentation completeness
- Check procedure coverage
- Verify guide availability

**If Not Met**:
- Complete documentation
- Review and update
- Re-evaluate

---

### Exit Decision Process

#### Step 1: Review All Criteria

1. **Compile Metrics**
   - System stability metrics
   - Transaction success rates
   - User engagement data
   - Financial audit results
   - Admin operations review
   - Performance metrics
   - User experience feedback
   - Documentation status

2. **Evaluate Each Criterion**
   - Check if all criteria met
   - Identify any gaps
   - Document findings

#### Step 2: Make Exit Decision

**If All Criteria Met**:
- ✅ Proceed with exit decision
- Document exit rationale
- Plan production launch
- Execute exit procedures

**If Criteria Not Met**:
- ⚠️ Extend pilot phase
- Address gaps
- Re-test
- Re-evaluate

#### Step 3: Execute Exit

1. **Final System Check**
   - [ ] All criteria verified
   - [ ] System state clean
   - [ ] No pending issues
   - [ ] Documentation complete

2. **Disable Pilot Mode**
   ```
   Mutation: setPilotMode
   Parameters:
   - pilotMode: false
   - reason: "Pilot phase complete. All exit criteria met. System ready for production launch."
   ```

3. **Notify Stakeholders**
   - Notify all users
   - Notify support team
   - Notify operations team
   - Update status

4. **Monitor Closely**
   - Monitor first 24 hours closely
   - Watch for issues
   - Be ready to re-enable pilot mode if needed

---

## Pilot Configuration Summary

### User Limits

| Role | Maximum | Rationale |
|------|---------|-----------|
| Farmers | 10 | Test listing and delivery flows |
| Traders | 5 | Test trading and spend cap |
| Buyers | 10 | Test purchase and pickup flows |
| Admins | 2-3 | Ensure redundancy and coverage |
| **Total** | **25-28** | Manageable scale for pilot |

### Storage Rates

| Configuration | Value | Notes |
|--------------|-------|-------|
| Default Rate | 0.5 kg/day per 100kg block | Can be adjusted during pilot |
| Maximum Rate | 1.0 kg/day per 100kg block | Should not exceed during pilot |
| Calculation | Server-side | Projected loss visible to traders |

### Spend Cap

| Configuration | Value | Notes |
|--------------|-------|-------|
| Maximum Exposure | UGX 1,000,000 | Per trader |
| Enforcement | Before wallet debit | Atomic, cannot bypass |
| Monitoring | Traders >80% exposure | Admin red-flag query |

### Pilot Mode Rules

| Scenario | Action | Reason Code Template |
|----------|--------|---------------------|
| Pre-launch testing | Enable | "Pre-production testing and validation" |
| System updates | Enable | "Testing system updates before deployment" |
| Issue investigation | Enable | "Investigating [issue description]" |
| Maintenance | Enable | "Scheduled maintenance window" |
| Normal operations | Disable | "Pilot testing complete, ready for production" |

### Exit Criteria

| Criterion | Requirement | Validation Method |
|-----------|-------------|-------------------|
| System Stability | Zero critical bugs for 7 days | Error log review |
| Transaction Success | >95% success rate | Transaction log analysis |
| User Engagement | >50% active users | User activity review |
| Financial Integrity | Zero discrepancies | Wallet audit |
| Admin Operations | All actions logged | Admin action review |
| System Performance | <2s query, <5s mutation | Performance metrics |
| User Experience | >80% satisfaction | User feedback |
| Documentation | Complete | Documentation review |

---

## Pilot Monitoring

### Daily Monitoring

**Check Every Day**:
- [ ] System health (error rates, performance)
- [ ] User activity (active users, transactions)
- [ ] Red flags (deliveries past SLA, traders near cap)
- [ ] Admin actions (verifications, reversals)
- [ ] Support requests (volume, types)

### Weekly Review

**Review Every Week**:
- [ ] Exit criteria progress
- [ ] User engagement trends
- [ ] System performance trends
- [ ] Admin operations quality
- [ ] Documentation updates needed

### Monthly Assessment

**Assess Every Month**:
- [ ] Overall pilot progress
- [ ] Exit criteria status
- [ ] User feedback summary
- [ ] System improvements needed
- [ ] Pilot extension decision (if needed)

---

## Pilot Configuration Enforcement

### User Limit Enforcement

**Current Status**: User limits are **not automatically enforced** in code.

**Recommendation**: 
- Monitor user counts manually during pilot
- Use admin queries to check user counts
- Do not exceed limits
- If limits approached, stop new user registrations

**Future Enhancement**: Could add user limit checks to `createUser` mutation if needed.

### Storage Rate Enforcement

**Current Status**: Storage rates are **configurable** via constants.

**Enforcement**:
- Default rate: 0.5 kg/day per 100kg block
- Can be adjusted in `convex/constants.ts`
- Admin can monitor storage fee impact
- Traders see projected loss

### Spend Cap Enforcement

**Current Status**: Spend cap is **automatically enforced**.

**Enforcement**:
- Hard limit: UGX 1,000,000
- Checked before every wallet debit
- Cannot be bypassed
- Standardized error if exceeded

### Pilot Mode Enforcement

**Current Status**: Pilot mode is **automatically enforced**.

**Enforcement**:
- Blocks all mutations that move money or inventory
- Checked before every mutation
- Cannot be bypassed
- Standardized error if active

---

## Pilot Success Metrics

### Key Performance Indicators (KPIs)

**System Health**:
- Error rate: Target < 1%
- Uptime: Target > 99%
- Response time: Target < 2s (queries), < 5s (mutations)

**Transaction Success**:
- Pay-to-lock success: Target > 95%
- Delivery on-time: Target > 80%
- Purchase success: Target > 95%

**User Engagement**:
- Active users: Target > 50%
- Transactions per user: Target > 2
- User retention: Target > 70%

**Financial**:
- Zero discrepancies: Required
- Accurate balances: Required
- Complete UTID tracking: Required

**Admin Operations**:
- Verification time: Target < 2 hours
- Zero admin errors: Required
- All actions logged: Required

---

## Pilot Risk Management

### Identified Risks

1. **User Limit Exceeded**
   - **Risk**: Too many users registered
   - **Mitigation**: Manual monitoring, stop registrations if limit approached
   - **Impact**: Low (system can handle more, but pilot should be controlled)

2. **Storage Rate Too High**
   - **Risk**: Traders losing too much value
   - **Mitigation**: Monitor storage fee impact, adjust if needed
   - **Impact**: Medium (affects trader profitability)

3. **Spend Cap Too Low**
   - **Risk**: Traders frequently blocked
   - **Mitigation**: Monitor exposure, adjust if needed (but cap is non-negotiable)
   - **Impact**: Medium (affects trader activity)

4. **Pilot Mode Left Enabled**
   - **Risk**: System blocked when should be operational
   - **Mitigation**: Clear procedures, monitoring, alerts
   - **Impact**: High (blocks all operations)

5. **Exit Criteria Not Met**
   - **Risk**: Premature production launch
   - **Mitigation**: Strict exit criteria, thorough review
   - **Impact**: High (could cause production issues)

---

## Pilot Configuration Checklist

### Pre-Pilot Setup

- [ ] User limits defined and documented
- [ ] Storage rates configured
- [ ] Spend cap confirmed (UGX 1,000,000)
- [ ] Pilot mode procedures documented
- [ ] Exit criteria defined
- [ ] Monitoring plan created
- [ ] Admin team trained
- [ ] Support team ready

### Pilot Launch

- [ ] Pilot mode enabled
- [ ] Initial users onboarded (within limits)
- [ ] System monitoring active
- [ ] Admin team ready
- [ ] Support team ready
- [ ] Documentation accessible

### During Pilot

- [ ] Daily monitoring active
- [ ] Weekly reviews conducted
- [ ] Monthly assessments completed
- [ ] User limits monitored
- [ ] Exit criteria tracked
- [ ] Issues addressed promptly

### Pilot Exit

- [ ] All exit criteria met
- [ ] Final system check completed
- [ ] Pilot mode disabled
- [ ] Stakeholders notified
- [ ] Production launch executed
- [ ] Post-launch monitoring active

---

*Document Version: 1.0*  
*Last Updated: [Date]*  
*Next Review: [Date]*
