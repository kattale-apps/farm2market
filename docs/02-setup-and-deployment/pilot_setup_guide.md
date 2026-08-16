# Pilot Setup Guide

## Overview

The pilot uses a **shared password** for all test users. This simplifies testing and onboarding during the pilot phase.

⚠️ **PILOT ONLY** - This is NOT secure for production. Use proper authentication in production.

---

## Shared Password

**All test users share this password:**
```
Farm2Market2024
```

---

## Step 1: Login (Users Auto-Created)

**No setup required!** Users are automatically created on first login.

Simply:

1. Navigate to `/login`
2. Enter any test user email (e.g., `farmer1@pilot.farm2market`)
3. Enter the shared password: `Farm2Market2024`
4. Click "Login"

You'll be redirected to the dashboard showing your role and alias.

---

## Test User Accounts

| Email | Role | Purpose |
|-------|------|---------|
| `farmer1@pilot.farm2market` | Farmer | Create listings, deliver produce |
| `farmer2@pilot.farm2market` | Farmer | Create listings, deliver produce |
| `trader1@pilot.farm2market` | Trader | Buy from farmers, sell to buyers |
| `trader2@pilot.farm2market` | Trader | Buy from farmers, sell to buyers |
| `buyer1@pilot.farm2market` | Buyer | Purchase from traders |
| `admin@pilot.farm2market` | Admin | System administration |

**Password for all:** `Farm2Market2024`

---

## How It Works

The login system:
1. **Validates password** against shared pilot password
2. **Auto-creates user** if email doesn't exist
3. **Infers role** from email prefix:
   - `admin*` → admin
   - `farmer*` → farmer
   - `trader*` → trader
   - Everything else → buyer
4. **Generates alias** automatically
5. **Returns user info** for session

**No manual user creation needed!**

---

## Security Notes

⚠️ **PILOT ONLY FEATURES:**

1. **Shared Password**: All users share the same password
2. **Simple Hash**: Password uses a simple hash (NOT production-grade)
3. **LocalStorage**: User session stored in browser localStorage
4. **No Session Expiry**: Sessions don't expire automatically

**DO NOT USE IN PRODUCTION**

For production, implement:
- Individual passwords per user
- Proper password hashing (bcrypt, argon2)
- Secure session management
- Session expiry
- Password reset functionality

---

## Troubleshooting

### "User already exists"
- The user was already created
- Just use the existing account to login

### "Invalid email or password"
- Check that you're using the correct email format
- Ensure password is exactly: `Farm2Market2024`
- Check that the user was created successfully

### Login redirects back to login
- Clear browser localStorage
- Try logging in again
- Check browser console for errors

---

## Next Steps

After creating users and logging in:

1. **Farmers**: Create listings, wait for traders to lock units
2. **Traders**: Deposit capital, lock units from farmers, manage inventory
3. **Buyers**: Wait for purchase window to open, purchase inventory
4. **Admin**: Manage system settings, verify deliveries, control purchase windows

See the onboarding scripts in `docs/onboarding_*.md` for role-specific guidance.
