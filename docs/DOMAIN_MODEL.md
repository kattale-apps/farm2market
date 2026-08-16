# DOMAIN_MODEL.md

**Production System Domain Model**

**Status**: Production system preparing for full public go-live  
**Authority**: Single human (CEO / Engineering Lead / CTO)  
**Last Updated**: Current system state

**Context**: 
- VISION.md exists with unresolved BLOCKED items
- BUSINESS_LOGIC.md is authoritative source for workflows, risks, and irreversible actions
- This document defines entities, states, and transitions only (no workflows, no business logic, no code)

---

## 1. Entity List

| Entity Name | Description | Owner | BLOCKED Notes |
|-------------|-------------|-------|---------------|
| User | User account with role, email, alias | User (self) | Role inference from email prefix is BLOCKED FOR PRODUCTION |
| Listing | Farmer listing of produce for sale | Farmer | None |
| ListingUnit | 10kg unit within a listing | Farmer (via listing) | None |
| WalletLedger | Ledger entry for capital/profit transactions | Trader (for trader entries) | None |
| TraderInventory | Inventory block aggregated from delivered units | Trader | Storage fee automation status UNKNOWN |
| BuyerPurchase | Purchase of inventory by buyer | Buyer | BLOCKED: Purchase function NOT IMPLEMENTED |
| PurchaseWindow | Global purchase window state | Admin | None |
| StorageFeeDeduction | Storage fee deduction record | System | BLOCKED: Automation implementation status UNKNOWN |
| AdminAction | Log of admin actions | Admin | Delivery verification function status UNKNOWN |
| SystemSettings | Global system configuration | System Operator | None |
| Notification | Notification to user | User (recipient) | None |
| RateLimitHit | Rate limit violation record | System | None |

---

## 2. Entity State Tables

### User Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| active | User account is active | Yes | No |
| suspended | User account is suspended | No | No |
| deleted | User account is deleted | No | Yes |

**Role States (Explicit, Not Inferred)**:
| Role | Description | Owner | BLOCKED Notes |
|------|-------------|-------|---------------|
| farmer | User can create listings | User (assigned by admin or system) | Role inference from email prefix is BLOCKED FOR PRODUCTION |
| trader | User can deposit capital and lock units | User (assigned by admin or system) | Role inference from email prefix is BLOCKED FOR PRODUCTION |
| buyer | User can purchase inventory | User (assigned by admin or system) | Role inference from email prefix is BLOCKED FOR PRODUCTION |
| admin | User can verify deliveries, reverse transactions, control purchase window | User (assigned by admin or system) | Role inference from email prefix is BLOCKED FOR PRODUCTION |

### Listing Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| active | Listing created, units available | Yes | No |
| partially_locked | Some units locked, some available | No | No |
| fully_locked | All units locked | No | No |
| delivered | All units delivered | No | Yes |
| cancelled | Listing cancelled | No | Yes |

### ListingUnit Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| available | Unit available for locking | Yes | No |
| locked | Unit locked by trader | No | No |
| delivered | Unit delivered to trader | No | No |
| cancelled | Unit cancelled | No | Yes |

**Delivery Status (Sub-state)**:
| Status | Description | Owner | BLOCKED Notes |
|--------|-------------|-------|---------------|
| pending | Delivery deadline not yet passed | System | Delivery verification function status UNKNOWN |
| delivered | Delivery verified as on-time | Admin | Delivery verification function status UNKNOWN |
| late | Delivery verified as late | Admin | Delivery verification function status UNKNOWN |
| cancelled | Delivery cancelled | Admin | Delivery verification function status UNKNOWN |

### WalletLedger Entity

| Type | Description | Owner | Reversible |
|------|-------------|-------|------------|
| capital_deposit | Capital deposited by trader | Trader | No |
| capital_lock | Capital locked when unit is locked | Trader | Yes (via admin reversal) |
| capital_unlock | Capital unlocked after reversal | Trader | No |
| profit_credit | Profit credited to trader | Trader | No |
| profit_withdrawal | Profit withdrawn from ledger | Trader | No |

**Note**: WalletLedger entries are immutable. No state transitions. Entries are created and remain.

### TraderInventory Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| pending_delivery | Inventory created, awaiting delivery | Yes | No |
| in_storage | Inventory in storage, available for sale | No | No |
| sold | Inventory sold to buyer | No | Yes |
| expired | Inventory expired | No | Yes |

### BuyerPurchase Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| pending_pickup | Purchase created, awaiting pickup | Yes | No |
| picked_up | Purchase picked up by buyer | No | Yes |
| expired | Purchase expired (48-hour SLA passed) | No | Yes |

**BLOCKED**: BuyerPurchase entity states are BLOCKED until purchase function is implemented.

### PurchaseWindow Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| open | Purchase window is open | No | No |
| closed | Purchase window is closed | Yes | No |

### StorageFeeDeduction Entity

**Note**: StorageFeeDeduction is a record, not a stateful entity. Entries are created and remain immutable.

**BLOCKED**: Storage fee automation implementation status is UNKNOWN. Entity may not be created automatically.

### AdminAction Entity

**Note**: AdminAction is a log record, not a stateful entity. Entries are created and remain immutable.

**BLOCKED**: Delivery verification actions may be BLOCKED if delivery verification function is not implemented.

### SystemSettings Entity

| Setting | Description | Owner | Values |
|---------|-------------|-------|--------|
| pilotMode | Blocks all money-moving mutations | System Operator | true / false |

**Note**: SystemSettings is a singleton. Only one record exists.

### Notification Entity

| State | Description | Initial State | Terminal State |
|-------|-------------|---------------|----------------|
| unread | Notification not read | Yes | No |
| read | Notification read | No | Yes |

### RateLimitHit Entity

**Note**: RateLimitHit is a log record, not a stateful entity. Entries are created and remain immutable.

---

## 3. State Transition Tables

### User Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | active | User account creation | System (automated) | Yes (admin can delete) | Production authentication BLOCKED |
| active | suspended | Admin suspends user | Admin | Yes (admin can unsuspend) | None |
| suspended | active | Admin unsuspends user | Admin | Yes (admin can suspend again) | None |
| active | deleted | Admin deletes user | Admin | No (account cannot be restored) | None |
| suspended | deleted | Admin deletes user | Admin | No (account cannot be restored) | None |

**Role Assignment Transitions**:
| From Role | To Role | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|-----------|---------|-------------------|-------------------|------------|---------------|
| (none) | farmer | Role assignment | Admin or System (via email inference) | Yes (admin can change) | Role inference BLOCKED FOR PRODUCTION |
| (none) | trader | Role assignment | Admin or System (via email inference) | Yes (admin can change) | Role inference BLOCKED FOR PRODUCTION |
| (none) | buyer | Role assignment | Admin or System (via email inference) | Yes (admin can change) | Role inference BLOCKED FOR PRODUCTION |
| (none) | admin | Role assignment | Admin or System (via email inference) | Yes (admin can change) | Role inference BLOCKED FOR PRODUCTION |
| farmer | trader | Admin changes role | Admin | Yes (admin can change back) | None |
| trader | buyer | Admin changes role | Admin | Yes (admin can change back) | None |
| buyer | admin | Admin changes role | Admin | Yes (admin can change back) | None |
| admin | farmer | Admin changes role | Admin | Yes (admin can change back) | None |
| (any role) | (any other role) | Admin changes role | Admin | Yes (admin can change back) | None |

### Listing Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | active | Farmer creates listing | Farmer | Yes (farmer can cancel if no units locked) | None |
| active | partially_locked | Trader locks first unit | Trader (automated) | No (units cannot be unlocked except via admin reversal) | None |
| active | fully_locked | Trader locks last unit | Trader (automated) | No (units cannot be unlocked except via admin reversal) | None |
| partially_locked | fully_locked | Trader locks last remaining unit | Trader (automated) | No (units cannot be unlocked except via admin reversal) | None |
| active | cancelled | Farmer cancels listing | Farmer | No (cancellation is irreversible) | If units are locked, requires admin authorization |
| partially_locked | cancelled | Admin cancels listing | Admin | No (cancellation is irreversible) | None |
| fully_locked | delivered | All units delivered | System (when all units marked delivered) | No (delivery is irreversible) | Delivery verification function status UNKNOWN |
| fully_locked | cancelled | Admin cancels listing | Admin | No (cancellation is irreversible) | None |

### ListingUnit Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | available | Listing created and unit split | System (automated) | No (unit splitting is irreversible) | None |
| available | locked | Trader locks unit (pay-to-lock) | Trader (automated, atomic) | Yes (admin can reverse if delivery fails) | None |
| locked | available | Admin reverses transaction | Admin | No (reversal is irreversible) | Requires delivery verification as late/cancelled |
| locked | delivered | Delivery verified as delivered | Admin | No (delivery is irreversible) | Delivery verification function status UNKNOWN |
| locked | cancelled | Admin cancels delivery | Admin | No (cancellation is irreversible) | Delivery verification function status UNKNOWN |
| available | cancelled | Listing cancelled | Farmer or Admin | No (cancellation is irreversible) | None |

**Delivery Status Transitions**:
| From Status | To Status | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|-------------|-----------|-------------------|-------------------|------------|---------------|
| (none) | pending | Unit locked | System (automated) | No | None |
| pending | delivered | Admin verifies delivery as on-time | Admin | Yes (admin can change status) | Delivery verification function status UNKNOWN |
| pending | late | Admin verifies delivery as late | Admin | Yes (admin can change status) | Delivery verification function status UNKNOWN |
| pending | cancelled | Admin cancels delivery | Admin | Yes (admin can change status) | Delivery verification function status UNKNOWN |
| delivered | late | Admin changes status | Admin | Yes (admin can change status) | Delivery verification function status UNKNOWN |
| late | delivered | Admin changes status | Admin | Yes (admin can change status) | Delivery verification function status UNKNOWN |
| (any status) | cancelled | Admin cancels delivery | Admin | Yes (admin can change status) | Delivery verification function status UNKNOWN |

### WalletLedger Entity Transitions

**Note**: WalletLedger entries are immutable. No state transitions. Entries are created atomically and remain.

| Entry Type | Created By | Required Authority | Reversible | BLOCKED Notes |
|------------|------------|-------------------|------------|---------------|
| capital_deposit | Trader deposits capital | Trader (automated) | No (deposit is irreversible) | None |
| capital_lock | Trader locks unit | Trader (automated, atomic) | Yes (admin can unlock via reversal) | None |
| capital_unlock | Admin reverses transaction | Admin | No (unlock is irreversible) | Requires delivery verification as late/cancelled |
| profit_credit | System credits profit | System (automated) | No (credit is irreversible) | None |
| profit_withdrawal | Trader withdraws profit | Trader (automated) | No (withdrawal is irreversible) | External transfer status UNKNOWN |

### TraderInventory Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | pending_delivery | Inventory created from delivered units | System (automated) | Yes (admin can remove inventory) | Delivery verification function status UNKNOWN |
| pending_delivery | in_storage | Delivery verified, inventory in storage | System (automated) | No (storage state is irreversible) | Delivery verification function status UNKNOWN |
| in_storage | sold | Buyer purchases inventory | Buyer (automated) | No (sale is irreversible) | Purchase function NOT IMPLEMENTED (BLOCKED) |
| in_storage | expired | Inventory expires | System (automated) | No (expiration is irreversible) | None |
| pending_delivery | expired | Inventory expires before delivery | System (automated) | No (expiration is irreversible) | None |

### BuyerPurchase Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | pending_pickup | Buyer purchases inventory | Buyer (automated) | No (purchase is irreversible) | **BLOCKED: Purchase function NOT IMPLEMENTED** |
| pending_pickup | picked_up | Buyer picks up purchase | Buyer or Admin | No (pickup is irreversible) | **BLOCKED: Purchase function NOT IMPLEMENTED** |
| pending_pickup | expired | Pickup deadline passes (48 hours) | System (automated) | No (expiration is irreversible) | **BLOCKED: Purchase function NOT IMPLEMENTED** |

**BLOCKED**: All BuyerPurchase transitions are BLOCKED until purchase function is implemented.

### PurchaseWindow Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | closed | System initialized | System (automated) | Yes (admin can open) | None |
| closed | open | Admin opens purchase window | Admin | Yes (admin can close) | None |
| open | closed | Admin closes purchase window | Admin | Yes (admin can open) | None |

### StorageFeeDeduction Entity Transitions

**Note**: StorageFeeDeduction is a record, not a stateful entity. Entries are created and remain immutable.

| Created By | Required Authority | Reversible | BLOCKED Notes |
|-----------|-------------------|------------|---------------|
| System (automated) | System (automated) | No (deduction is irreversible) | **BLOCKED: Automation implementation status UNKNOWN** |

### AdminAction Entity Transitions

**Note**: AdminAction is a log record, not a stateful entity. Entries are created and remain immutable.

| Action Type | Created By | Required Authority | Reversible | BLOCKED Notes |
|-------------|-----------|-------------------|------------|---------------|
| delivery_verification | Admin verifies delivery | Admin | No (log entry is irreversible) | **BLOCKED: Delivery verification function status UNKNOWN** |
| transaction_reversal | Admin reverses transaction | Admin | No (log entry is irreversible) | None |
| purchase_window_control | Admin opens/closes window | Admin | No (log entry is irreversible) | None |
| pilot_mode_control | Admin enables/disables pilot mode | Admin | No (log entry is irreversible) | None |
| user_role_change | Admin changes user role | Admin | No (log entry is irreversible) | None |

### SystemSettings Entity Transitions

| Setting | From Value | To Value | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|---------|------------|----------|-------------------|-------------------|------------|---------------|
| pilotMode | false | true | Admin enables pilot mode | Admin | Yes (admin can disable) | None |
| pilotMode | true | false | Admin disables pilot mode | Admin | Yes (admin can enable) | None |

### Notification Entity Transitions

| From State | To State | Triggering Action | Required Authority | Reversible | BLOCKED Notes |
|------------|----------|-------------------|-------------------|------------|---------------|
| (none) | unread | Notification created | System (automated) | No (creation is irreversible) | None |
| unread | read | User reads notification | User | No (read state is irreversible) | None |

### RateLimitHit Entity Transitions

**Note**: RateLimitHit is a log record, not a stateful entity. Entries are created and remain immutable.

| Created By | Required Authority | Reversible | BLOCKED Notes |
|-----------|-------------------|------------|---------------|
| System (automated) | System (automated) | No (log entry is irreversible) | None |

---

## 4. Authority Boundaries

### Role-Based Entity Access

| Role | Can Create | Can Read | Can Update | Can Delete | BLOCKED Notes |
|------|------------|----------|-------------|------------|---------------|
| **Farmer** | Listing, ListingUnit (via listing creation) | Own listings, own units | Own listings (cancel if no units locked) | Own listings (if no units locked) | None |
| **Trader** | WalletLedger (capital_deposit, capital_lock, profit_withdrawal), TraderInventory (via delivery) | Own wallet ledger, available listings, available units, own inventory | None (no direct updates) | None | None |
| **Buyer** | BuyerPurchase | Available inventory (when window open) | None | None | **BLOCKED: Purchase function NOT IMPLEMENTED** |
| **Admin** | AdminAction, PurchaseWindow (open/close), SystemSettings (pilot mode) | All entities (full read access) | ListingUnit (delivery status), TraderInventory (status), PurchaseWindow (open/close), SystemSettings (pilot mode), User (role, suspend/unsuspend) | User (delete), Listing (cancel), ListingUnit (cancel) | Delivery verification function status UNKNOWN |
| **System** | WalletLedger (all types), ListingUnit (via listing creation), TraderInventory (via delivery), StorageFeeDeduction, Notification, RateLimitHit | All entities (for automated operations) | Listing (status), ListingUnit (status), TraderInventory (status), BuyerPurchase (status), PurchaseWindow (initial state) | None | Storage fee automation status UNKNOWN |

### Explicit Forbidden Actions

| Action | Forbidden To | Reason |
|--------|-------------|--------|
| Reverse own transactions | Users | Only admin can reverse transactions |
| Modify transaction records | Users | Transaction records are immutable |
| Change own role | Users | Only admin can change roles |
| Bypass exposure limits | Users | System enforces limits |
| Modify UTIDs | Users, Admin, System | UTIDs are immutable |
| Access other users' real identities | Admin | Anonymity must be preserved |
| Make autonomous decisions without human authorization | System | All decisions require human authorization |
| Automatically reverse successful transactions | System | Reversals require admin authorization |
| Overwrite ledger balances | System | Ledger entries only, no balance overwrites |
| Proceed without explicit authorization gates | System | All gates require explicit authorization |
| Reverse transactions without reason | Admin | Reason is non-negotiable |
| Bypass exposure limits for traders | Admin | Limits are enforced for all traders |

---

## 5. BLOCKED SUMMARY

### Entities Blocked by Unresolved Items

| Entity | Blocked Item | Why Blocked | What Would Unblock |
|--------|--------------|-------------|-------------------|
| User (role assignment) | VISION.md BLOCKED #1 (Production Authentication) | Role inference from email prefix is BLOCKED FOR PRODUCTION | Production authentication implementation with explicit role assignment |
| BuyerPurchase | VISION.md BLOCKED #2 (Buyer Purchase Function) | Purchase function NOT IMPLEMENTED | Implementation of buyer purchase function |
| StorageFeeDeduction | VISION.md UNKNOWN (Storage Fee Automation) | Automation implementation status UNKNOWN | Verification and implementation of storage fee automation |
| AdminAction (delivery_verification) | VISION.md UNKNOWN (Delivery Verification Function) | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |
| ListingUnit (delivery status) | VISION.md UNKNOWN (Delivery Verification Function) | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |
| TraderInventory | VISION.md UNKNOWN (Delivery Verification Function) | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |

### State Transitions Blocked by Unresolved Items

| Transition | Blocked Item | Why Blocked | What Would Unblock |
|------------|--------------|-------------|-------------------|
| User role assignment (email inference) | VISION.md BLOCKED #1 | Role inference from email prefix is BLOCKED FOR PRODUCTION | Production authentication implementation with explicit role assignment |
| BuyerPurchase creation | VISION.md BLOCKED #2 | Purchase function NOT IMPLEMENTED | Implementation of buyer purchase function |
| BuyerPurchase state transitions | VISION.md BLOCKED #2 | Purchase function NOT IMPLEMENTED | Implementation of buyer purchase function |
| ListingUnit delivery status updates | VISION.md UNKNOWN | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |
| TraderInventory creation from delivered units | VISION.md UNKNOWN | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |
| StorageFeeDeduction creation | VISION.md UNKNOWN | Automation implementation status UNKNOWN | Verification and implementation of storage fee automation |
| AdminAction delivery_verification creation | VISION.md UNKNOWN | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |

### Authority Boundaries Blocked by Unresolved Items

| Authority | Blocked Item | Why Blocked | What Would Unblock |
|-----------|--------------|-------------|-------------------|
| Buyer purchase authority | VISION.md BLOCKED #2 | Purchase function NOT IMPLEMENTED | Implementation of buyer purchase function |
| Admin delivery verification authority | VISION.md UNKNOWN | Delivery verification function status UNKNOWN | Verification and implementation of delivery verification function |
| System storage fee automation authority | VISION.md UNKNOWN | Automation implementation status UNKNOWN | Verification and implementation of storage fee automation |

---

## Final Check

### All Entities Defined

**Verified**: All entities from BUSINESS_LOGIC.md and schema are defined:
1. User
2. Listing
3. ListingUnit
4. WalletLedger
5. TraderInventory
6. BuyerPurchase
7. PurchaseWindow
8. StorageFeeDeduction
9. AdminAction
10. SystemSettings
11. Notification
12. RateLimitHit

### All Owners Assigned

**Verified**: All entities have explicit owners:
- User: User (self)
- Listing: Farmer
- ListingUnit: Farmer (via listing)
- WalletLedger: Trader (for trader entries)
- TraderInventory: Trader
- BuyerPurchase: Buyer
- PurchaseWindow: Admin
- StorageFeeDeduction: System
- AdminAction: Admin
- SystemSettings: System Operator
- Notification: User (recipient)
- RateLimitHit: System

### All States and Transitions Listed

**Verified**: All states and transitions are listed in tables:
- User: 3 states, 5 transitions, 4 roles (explicit state)
- Listing: 5 states, 8 transitions
- ListingUnit: 4 states, 6 transitions, 4 delivery statuses, 7 delivery status transitions
- WalletLedger: 5 entry types (immutable, no transitions)
- TraderInventory: 4 states, 5 transitions
- BuyerPurchase: 3 states, 3 transitions (all BLOCKED)
- PurchaseWindow: 2 states, 3 transitions
- StorageFeeDeduction: Record only (BLOCKED)
- AdminAction: Record only (some types BLOCKED)
- SystemSettings: 1 setting, 2 transitions
- Notification: 2 states, 2 transitions
- RateLimitHit: Record only

### All BLOCKED Items Explicitly Marked

**Verified**: All BLOCKED items are explicitly marked:
1. User role inference from email prefix: BLOCKED FOR PRODUCTION
2. BuyerPurchase entity: BLOCKED (purchase function NOT IMPLEMENTED)
3. StorageFeeDeduction automation: BLOCKED (implementation status UNKNOWN)
4. AdminAction delivery_verification: BLOCKED (function status UNKNOWN)
5. ListingUnit delivery status updates: BLOCKED (function status UNKNOWN)
6. TraderInventory creation: BLOCKED (depends on delivery verification)

### Confirmation: No Entities, States, or Transitions Inferred Beyond BUSINESS_LOGIC.md

**Verified**: All entities, states, and transitions are derived from:
- BUSINESS_LOGIC.md workflows and irreversible actions
- Schema definitions (convex/schema.ts)
- No entities, states, or transitions were inferred beyond these sources
- All BLOCKED items are linked to VISION.md or BUSINESS_LOGIC.md items
- All assumptions are explicitly labeled in BUSINESS_LOGIC.md (not repeated here)

---

*This document must be updated when entities, states, or transitions change, or when BLOCKED items are unblocked. No assumptions. Only truth.*
