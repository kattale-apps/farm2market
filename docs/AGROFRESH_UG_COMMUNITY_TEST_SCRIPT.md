# AGROFRESH UG COMMUNITY – TEST SCRIPT (QA / UAT)

## 1. Environment Setup Test
**Test Case ID:** ENV-01  
**Objective:** Confirm app environment is working

**Steps:**
1. Open web app.
2. Log in as:
   - Farmer user
   - Community Admin user
3. Confirm network requests are successful.
4. Confirm no console errors on load.

**Expected Result:**
- App loads without errors.
- Both roles can log in successfully.

---

## 2. Form UI & Accordion Behavior
**Test Case ID:** UI-01  
**Objective:** Verify accordion sections and persistence

**Steps:**
1. Open AGROFRESH UG Community onboarding form.
2. Click each accordion section:
   - Farmer Registration Information
   - Farm Specifics
   - 2.1 – 2.10 Enterprise sections
3. Enter sample data in one section.
4. Collapse and re-open the section.

**Expected Result:**
- Sections expand/collapse smoothly.
- Data persists after collapse.
- No section auto-clears data.
- No missing sections.
- Section names exactly match validation form.

---

## 3. Preloaded Data Validation
**Test Case ID:** DATA-01  
**Objective:** Confirm preloaded fields work and are editable

**Steps:**
1. Open onboarding form.
2. Check:
   - Phone Number
   - Email
   - County
   - District/Sub-county
   - Village
3. Edit preloaded values.
4. Save draft or submit form.
5. Re-open form.

**Expected Result:**
- Fields are preloaded.
- Fields are editable.
- Edited values persist.
- No duplicate farmer records created.
- Updated values sync to farmer profile.

---

## 4. Field Validation & Input Types
**Test Case ID:** VAL-01  
**Objective:** Confirm strict field types & validation

**Steps:**
1. Enter letters into numeric fields (e.g., farm size).
2. Skip required fields.
3. Select Local Market and confirm Transport field appears.
4. Select Farm-gate and confirm Transport disappears.
5. Enter feet/meters and verify acres auto-calculation.

**Expected Result:**
- Numeric fields reject text.
- Required fields block submission.
- Conditional fields appear correctly.
- Unit conversion works.
- Dropdowns match validation document values.

---

## 5. Submission & Status Flow
**Test Case ID:** FLOW-01  
**Objective:** Verify submission → pending status

**Steps:**
1. Complete form.
2. Click Submit.
3. Observe confirmation message.
4. Re-open community card.

**Expected Result:**
- Confirmation message shows: “Pending confirmation by community admin.”
- Membership status shows: PENDING.
- Fields are locked for editing.
- Community card opens but only shows:
  - Form data
  - Pending status

---

## 6. Admin Dashboard – Pending Approval
**Test Case ID:** ADMIN-01  
**Objective:** Verify admin can see pending applications

**Steps:**
1. Log in as community admin.
2. Open AGROFRESH UG Admin Dashboard.
3. View Members table.
4. Locate newly submitted farmer.

**Expected Result:**
- Farmer appears with status PENDING.
- All columns display correctly.
- Pagination works.
- Page size selector works (max 20).

---

## 7. Admin Actions (Approve / Reject / Revoke)
**Test Case ID:** ADMIN-02  
**Objective:** Verify admin actions

**Steps:**
1. Click Approve on a pending farmer.
2. Refresh farmer view.
3. Click Reject on another farmer.
4. Revoke an approved farmer.

**Expected Result:**
- Approved farmer status becomes APPROVED.
- Rejected farmer status becomes REJECTED.
- Revoked farmer status becomes REVOKED.
- Status updates immediately on farmer UI.
- Action log is recorded with timestamp + admin ID.

---

## 8. Role-Based Visibility
**Test Case ID:** RBAC-01  
**Objective:** Verify visibility based on status

**Steps:**
1. Log in as approved farmer.
2. Open community card.
3. Log in as pending farmer.
4. Open community card.

**Expected Result:**
- Approved farmer sees:
  - Full community profile
  - Services
  - Internal content
- Pending farmer sees:
  - Only submitted form
  - Membership status

---

## 9. Community Tagging on Posts
**Test Case ID:** UI-02  
**Objective:** Verify community tag appears on posts

**Steps:**
1. Log in as approved member.
2. Create a post.
3. Observe alias display.

**Expected Result:**
- AGROFRESH UG logo tag appears next to alias.
- Tag is clickable.
- Clicking tag opens community profile.

---

## 10. Exports (CSV / Excel / PDF)
**Test Case ID:** EXP-01  
**Objective:** Verify exports are correct and clean

**Steps:**
1. As admin, export CSV.
2. Export Excel.
3. Export PDF.
4. Open files.

**Expected Result:**
- No duplicate farmers.
- One row per farmer.
- Column names match validation form fields.
- Status included.
- Preloaded data included.
- Pagination not affecting export (export all records).

---

## 11. Performance & Edge Cases
**Test Case ID:** PERF-01

**Steps:**
1. Load 100+ community members.
2. Set page size to 20.
3. Navigate pages quickly.
4. Export large dataset.

**Expected Result:**
- UI does not freeze.
- Pagination remains responsive.
- Export completes successfully.
- No server timeout.

---

## 12. Security & Permissions
**Test Case ID:** SEC-01

**Steps:**
1. Log in as farmer.
2. Try to access admin endpoints.
3. Try to approve another farmer.

**Expected Result:**
- Access denied.
- Proper 401/403 responses.
- No admin controls visible to farmers.

---

## Bonus: Automated Test Ideas (for later)
You can turn the above into:
- Playwright / Cypress for UI flows
- Jest / Vitest for form validation
- API tests for:
  - submitApplication
  - approveMember
  - exportMembers

**Example automation target:**
- “Test farmer submits form → admin approves → farmer sees full community view → tag appears on post.”
