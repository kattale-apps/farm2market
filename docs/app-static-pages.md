# App Static Pages Map

## Summary
- Total pages: 45
- Static: 38
- Dynamic: 7
- Source: filesystem scan of app/**/page.tsx and app/**/page.ts

---

## /

**File:** app/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Farm2Market Uganda  
**Main Components:** AdminDashboard, TraderDashboardSafe, FarmerDashboard, BuyerDashboard, Id  
**Purpose:** Landing page and entry point.

---

## /admin/agrofresh-ug

**File:** app/admin/agrofresh-ug/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** AGROFRESH UG — Farm Validation Review  
**Main Components:** Id, StatusFilter  
**Purpose:** AGROFRESH UG — Farm Validation Review functionality.

---

## /admin/change-password

**File:** app/admin/change-password/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** 🔒 Change Password  
**Main Components:** Id  
**Purpose:** 🔒 Change Password functionality.

---

## /admin/communities

**File:** app/admin/communities/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Grower Communities  
**Main Components:** Id  
**Purpose:** Grower Communities functionality.

---

## /admin/community-dashboard

**File:** app/admin/community-dashboard/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Community Dashboard  
**Main Components:** Id  
**Purpose:** Authenticated (Farmer/Trader/Buyer) dashboard overview and actions.

---

## /admin/finance

**File:** app/admin/finance/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Commission Earnings Dashboard  
**Main Components:** Id, Set  
**Purpose:** Commission Earnings Dashboard functionality.

---

## /admin/fix-admin

**File:** app/admin/fix-admin/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Fix Admin Level  
**Main Components:** None  
**Purpose:** Fix Admin Level functionality.

---

## /admin/messaging-dashboard

**File:** app/(community)/admin/messaging-dashboard/page.tsx  
**Type:** Dynamic  (reasons: force-dynamic, searchParams)  
**Access:** Community Admin  
**Page Title:** {(community as any)?.name || "Community"}  
**Main Components:** Id, CommunitySwitcher, RoleGuard, File, HTMLInputElement  
**Purpose:** Community Admin dashboard overview and actions.

---

## /admin/reset-transactions

**File:** app/admin/reset-transactions/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Admin: Reset All Transactions  
**Main Components:** None  
**Purpose:** Admin: Reset All Transactions functionality.

---

## /admin/role-management

**File:** app/admin/role-management/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Admin Role Management  
**Main Components:** Id, AnyUser, EditAdminState, CreateAdminState  
**Purpose:** Admin Role Management functionality.

---

## /admin/seed-demo

**File:** app/admin/seed-demo/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Admin: Seed Demo Data  
**Main Components:** None  
**Purpose:** Admin: Seed Demo Data functionality.

---

## /admin/seed-locations

**File:** app/admin/seed-locations/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Seed Uganda Administrative Units  
**Main Components:** Id  
**Purpose:** Seed Uganda Administrative Units functionality.

---

## /admin/service-levels

**File:** app/admin/service-levels/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** ⚙️ Manage Service Levels  
**Main Components:** Id  
**Purpose:** ⚙️ Manage Service Levels functionality.

---

## /admin/storeadmin-audit

**File:** app/admin/storeadmin-audit/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** StoreAdmin Oversight Panel  
**Main Components:** Id, ViewMode  
**Purpose:** StoreAdmin Oversight Panel functionality.

---

## /buyer/dashboard

**File:** app/buyer/dashboard/page.tsx  
**Type:** Static   
**Access:** Buyer  
**Page Title:** Buyer Dashboard  
**Main Components:** Id, JoinCommunityCard  
**Purpose:** Buyer dashboard overview and actions.

---

## /community-admin/[communityId]/dashboard

**File:** app/community-admin/[communityId]/dashboard/page.tsx  
**Type:** Static   
**Access:** Community Admin  
**Page Title:** Community Admin Dashboard  
**Main Components:** Id, RoleGuard  
**Purpose:** Community Admin dashboard overview and actions.

---

## /community-only

**File:** app/(community)/community-only/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Community Only  
**Main Components:** None  
**Purpose:** Community Only functionality.

---

## /community-only/messages

**File:** app/(community)/community-only/messages/page.tsx  
**Type:** Dynamic  (reasons: force-dynamic, searchParams)  
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Messages  
**Main Components:** Id, RoleGuard, Skeleton, HTMLInputElement, File, BottomSheet  
**Purpose:** Community messaging interface.

---

## /community-only/noticeboard

**File:** app/(community)/community-only/noticeboard/page.tsx  
**Type:** Dynamic  (reasons: force-dynamic, searchParams)  
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Community Noticeboard  
**Main Components:** Id, RoleGuard, QuotaWidget  
**Purpose:** Community noticeboard feed and announcements.

---

## /community-only/profile

**File:** app/(community)/community-only/profile/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Your Profile  
**Main Components:** Id, SkeletonButton, Toast  
**Purpose:** User profile management.

---

## /components

**File:** app/components/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Components  
**Main Components:** None  
**Purpose:** Components functionality.

---

## /contact

**File:** app/contact/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Support Chat  
**Main Components:** ThreadView  
**Purpose:** Support Chat functionality.

---

## /farm-validation/[formId]

**File:** app/farm-validation/[formId]/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** [FormId]  
**Main Components:** Id, AgroFreshUGValidationForm  
**Purpose:** [FormId] functionality.

---

## /farmer/communities

**File:** app/farmer/communities/page.tsx  
**Type:** Static   
**Access:** Farmer  
**Page Title:** 🌾 Grower Communities  
**Main Components:** Id  
**Purpose:** 🌾 Grower Communities functionality.

---

## /farmer/dashboard

**File:** app/farmer/dashboard/page.tsx  
**Type:** Static   
**Access:** Farmer  
**Page Title:** Farmer Dashboard  
**Main Components:** Id, JoinCommunityCard  
**Purpose:** Farmer dashboard overview and actions.

---

## /farmer/profile

**File:** app/farmer/profile/page.tsx  
**Type:** Static   
**Access:** Farmer  
**Page Title:** My Profile 👩🏾‍🌾  
**Main Components:** Id  
**Purpose:** User profile management.

---

## /forgot-password

**File:** app/forgot-password/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Check Your Email  
**Main Components:** None  
**Purpose:** Initiates password reset via email/token.

---

## /join/community/[slug]

**File:** app/(public)/join/community/[slug]/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Community Not Found  
**Main Components:** Id  
**Purpose:** Community join landing from QR/shared link.

---

## /login

**File:** app/login/page.tsx  
**Type:** Dynamic  (reasons: force-dynamic)  
**Access:** Public  
**Page Title:** Farm2Market Uganda  
**Main Components:** None  
**Purpose:** User authentication sign-in page.

---

## /member/messaging-feed

**File:** app/(community)/member/messaging-feed/page.tsx  
**Type:** Dynamic  (reasons: force-dynamic, searchParams)  
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** {community.name}  
**Main Components:** Id, CommunitySwitcher, RoleGuard, File, HTMLInputElement, HTMLDivElement  
**Purpose:** Community messaging interface.

---

## /my-communities

**File:** app/(community)/my-communities/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** My Communities  
**Main Components:** Id, CommunityLogoButton, CommunityDiscoveryCard, SkeletonLogo, Toast  
**Purpose:** Lists and manages joined/suggested communities.

---

## /my-communities-v2

**File:** app/(community)/my-communities-v2/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** My Communities  
**Main Components:** CommunitySwitcher, RoleGuard  
**Purpose:** Lists and manages joined/suggested communities.

---

## /onboarding/farmer

**File:** app/onboarding/farmer/page.tsx  
**Type:** Static   
**Access:** Farmer  
**Page Title:** Complete Your Profile  
**Main Components:** Id, FarmSizePreview  
**Purpose:** Collects onboarding profile and setup details.

---

## /payment/callback

**File:** app/payment/callback/page.tsx  
**Type:** Dynamic  (reasons: searchParams)  
**Access:** Public  
**Page Title:** Verifying Payment...  
**Main Components:** PaymentCallbackContent  
**Purpose:** Verifying Payment... functionality.

---

## /privacy-policy

**File:** app/privacy-policy/page.tsx  
**Type:** Static   
**Access:** Public  
**Page Title:** Privacy Policy  
**Main Components:** None  
**Purpose:** Privacy and terms information.

---

## /reset-password

**File:** app/reset-password/page.tsx  
**Type:** Dynamic  (reasons: searchParams)  
**Access:** Public  
**Page Title:** Password Reset Successful!  
**Main Components:** ResetPasswordFallback, ResetPasswordContent  
**Purpose:** Sets a new password from reset token.

---

## /storeadmin/dashboard

**File:** app/storeadmin/dashboard/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** StoreAdmin Dashboard  
**Main Components:** Id  
**Purpose:** Authenticated (Farmer/Trader/Buyer) dashboard overview and actions.

---

## /storeadmin/delivery-verification

**File:** app/storeadmin/delivery-verification/page.tsx  
**Type:** Static   
**Access:** Authenticated (Farmer/Trader/Buyer)  
**Page Title:** Delivery Verification  
**Main Components:** Id, File, HTMLInputElement  
**Purpose:** Delivery Verification functionality.

---

## /superadmin/communities/create

**File:** app/(superadmin)/superadmin/communities/create/page.tsx  
**Type:** Static   
**Access:** Superadmin  
**Page Title:** Community Created Successfully!  
**Main Components:** Id, RoleGuard, QRCode, CreateStatus, CommunityFormData, File  
**Purpose:** Community Created Successfully! functionality.

---

## /superadmin/dashboard

**File:** app/(superadmin)/superadmin/dashboard/page.tsx  
**Type:** Static   
**Access:** Superadmin  
**Page Title:** Dashboard  
**Main Components:** RoleGuard  
**Purpose:** Superadmin dashboard overview and actions.

---

## /superadmin/qr-communities/create

**File:** app/(superadmin)/superadmin/qr-communities/create/page.tsx  
**Type:** Static   
**Access:** Superadmin  
**Page Title:** Create QR Community  
**Main Components:** Id, HTMLInputElement  
**Purpose:** Create QR Community functionality.

---

## /superadmin/usage

**File:** app/(superadmin)/superadmin/usage/page.tsx  
**Type:** Static   
**Access:** Superadmin  
**Page Title:** Superadmin Usage Dashboard  
**Main Components:** Id, RoleGuard, Record, SkeletonButton, Toast, PricingEditor  
**Purpose:** Administrative usage metrics and reporting.

---

## /trader/dashboard

**File:** app/trader/dashboard/page.tsx  
**Type:** Static   
**Access:** Trader  
**Page Title:** Trader Dashboard  
**Main Components:** Id, JoinCommunityCard  
**Purpose:** Trader dashboard overview and actions.

---

## /trader/marketplace

**File:** app/trader/marketplace/page.tsx  
**Type:** Static   
**Access:** Trader  
**Page Title:** Marketplace  
**Main Components:** Id, NegotiationPanel, Set  
**Purpose:** Trading marketplace features and listings.

---

## /trader/settings

**File:** app/trader/settings/page.tsx  
**Type:** Static   
**Access:** Trader  
**Page Title:** Notification Settings  
**Main Components:** Id  
**Purpose:** Notification Settings functionality.

---

## User Journey Mapping

### Auth Flow
- /forgot-password
- /login
- /reset-password

### Onboarding Flow
- /onboarding/farmer

### Dashboard Flow
- /admin/community-dashboard
- /admin/messaging-dashboard
- /buyer/dashboard
- /community-admin/[communityId]/dashboard
- /farmer/dashboard
- /storeadmin/dashboard
- /superadmin/dashboard
- /trader/dashboard

### Community Flow
- /admin/community-dashboard
- /admin/messaging-dashboard
- /community-admin/[communityId]/dashboard
- /community-only
- /community-only/messages
- /community-only/noticeboard
- /community-only/profile
- /join/community/[slug]
- /member/messaging-feed
- /my-communities
- /my-communities-v2

### Superadmin Flow
- /superadmin/communities/create
- /superadmin/dashboard
- /superadmin/qr-communities/create
- /superadmin/usage

