# POST_GO_LIVE_UI_CHANGE_POLICY.md

## Post-Go-Live UI Change Policy

**Status**: Active  
**Applies From**: Production Go-Live Date  
**Authority**: System Operator (CEO / Engineering Lead / CTO)  
**Scope**: User Interface (UI) and User Experience (UX) only  
**Excludes**: Backend logic, enforcement, ledger behavior, authorization, or legal controls

---

## 1. Purpose

This policy governs **permitted UI and UX changes after production go-live**, ensuring that:

* Farmer usability can improve continuously
* Low-literacy accessibility is supported
* Informational transparency is enhanced
* Legal, evidentiary, and infrastructural integrity remain unchanged

This policy exists to **enable iteration without re-authorization**.

---

## 2. Core Principle

> **The user interface is a presentation layer only.
> Legal authority, enforcement, and evidentiary weight reside exclusively in server-side systems.**

Accordingly:

* UI changes may evolve freely
* Backend behavior remains authoritative
* No UI change may alter legal meaning or system guarantees

---

## 3. Explicitly Permitted UI Changes

The following UI changes are **explicitly authorized post-go-live** and **do not require additional execution approval or authorization**.

### 3.1 Location Display (Farmer)

The UI **may display the geographic location of a farmer**, including but not limited to:

* Village, parish, sub-county, district
* GPS-derived coordinates (if available)
* Map-based visualization
* Text-based location descriptors

**Conditions**:

* Location is informational only
* Location does not alter transaction validation
* Location display does not imply ownership, custody, or legal control

---

### 3.2 Location Display (Storage House / Facility)

The UI **may display the geographic location of storage houses or aggregation facilities**, including:

* Facility name and location
* Distance indicators
* Map pins or diagrams
* Storage status indicators (informational)

**Conditions**:

* Display does not imply custodianship of funds
* Display does not alter ledger or transaction execution
* Storage location is descriptive, not authoritative

---

### 3.3 Produce Selection via Icons (Low-Literacy Design)

The UI **may allow farmers to select produce types using visual icons**, images, or symbols, including:

* Crop icons (e.g. maize, beans, coffee, rice)
* Color-coded or shape-based selection
* Multi-language or icon-only flows
* Assisted selection interfaces

**Explicit Authorization**:

* Icons may replace or supplement text
* Illiteracy-aware design is encouraged
* Selection remains mapped to server-defined produce identifiers

**Constraint**:

* Icon selection must map to existing backend enums or identifiers
* UI may not create new produce categories without backend authorization

---

### 3.4 Additional Informational UI Enhancements

The UI may include **additional informational details**, such as:

* Quantity units and explanations
* Status indicators ("listed", "locked", "completed")
* Transaction timelines
* UTID visibility and copy functions
* Plain-language explanations of what a transaction record means
* Help text, tooltips, and educational prompts

**Conditions**:

* Information is read-only or advisory
* No client-side enforcement is introduced
* No business logic is reimplemented in the UI

---

## 4. Explicitly Prohibited UI Changes

The following are **not permitted** under this policy and require separate authorization:

* Client-side enforcement of pilot mode, authorization, or limits
* UI-only validation that bypasses server checks
* UI creation of new financial flows
* UI-driven ledger mutation logic
* UI changes that redefine consent, liability, or legal meaning
* UI storage of authoritative transaction state

---

## 5. Legal and Evidentiary Safeguards

All UI changes must comply with the following safeguards:

1. **Server Authority Rule**
   All enforcement, validation, and recording occurs server-side.

2. **Non-Modification Rule**
   UI changes must not modify:

   * UTID generation
   * Audit logs
   * Ledger immutability
   * Authorization checks

3. **Non-Representation Rule**
   UI must not represent:

   * Custody of funds
   * Fiduciary responsibility
   * Banking or payment services
     unless already authorized elsewhere.

---

## 6. Change Classification

UI changes under this policy are classified as:

**Class U-1: Informational / Presentational Changes**

* Do not require:

  * Legal review
  * Authorization handoff
  * Execution plan update
* May be deployed continuously

---

## 7. Governance and Oversight

**Approval Authority**:
System Operator (CEO / Engineering Lead / CTO)

**Review Requirement**:

* Informal internal review only
* No formal authorization record required

**Audit Position**:

* UI changes are non-material to legal characterization
* UI changes do not affect evidentiary validity of records

---

## 8. Policy Summary

Under this policy, after go-live, the system **may freely evolve its UI** to:

* Show farmer locations
* Show storage house locations
* Use icons for produce selection
* Support low-literacy users
* Improve clarity and trust

All while **preserving full legal, technical, and regulatory integrity**.

---

**Policy Status**: ACTIVE  
**Effective Date**: Production Go-Live Date  
**Authority**: Isaac Tom Musumba  
**Capacity**: System Operator (CEO / Engineering Lead / CTO)

---

*This policy enables continuous UI/UX improvement while preserving legal, technical, and regulatory integrity. UI changes are presentation-layer only and do not require re-authorization.*
