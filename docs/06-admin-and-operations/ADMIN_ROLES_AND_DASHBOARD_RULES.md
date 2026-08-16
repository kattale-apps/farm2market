# Admin Roles and Dashboard Rules

## Admin Role Types

### 1. SuperAdmin
- **Access:** Full access to all communities, users, and admin features.
- **Capabilities:**
  - Create, edit, and delete any community.
  - Assign junior community admins to communities (assignment is mandatory).
  - View and manage all admin accounts (store, message, community).
  - See all community cards and assigned admin contact details.
  - Access all member and non-member lists for any community.
  - Audit and manage store/message admin actions.

### 2. Junior Community Admin
- **Access:** Limited to assigned communities only.
- **Capabilities:**
  - Can only view and manage communities assigned to them.
  - Cannot create or delete communities.
  - Can view member and non-member lists for their assigned communities.
  - Cannot assign other admins or change assignments.

### 3. Store Admin
- **Access:** Limited to assigned storage locations.
- **Capabilities:**
  - Manage delivery confirmations and storage-related tasks.
  - No access to community management features.

### 4. Message Admin
- **Access:** Limited to inbox/support features.
- **Capabilities:**
  - Manage user support messages.
  - No access to community or storage management features.

## Dashboard Visibility Rules

- **SuperAdmin:**
  - Sees all communities and all admin assignments.
  - Can access all dashboard features and admin management tools.
- **Junior Community Admin:**
  - Sees only the communities assigned to them.
  - Cannot see or manage other communities or admin assignments.
- **Store Admin / Message Admin:**
  - Only see features relevant to their role (not community dashboards).

## Community Assignment Rules
- Every community must have an assigned junior community admin.
- Assignment is enforced at creation and must be maintained.
- SuperAdmins can reassign or update admin assignments.

## Enforcement
- All role-based access and visibility is enforced both in the backend (Convex) and frontend (Next.js).
- Unauthorized access attempts are blocked and redirected.

---
_Last updated: February 1, 2026_
