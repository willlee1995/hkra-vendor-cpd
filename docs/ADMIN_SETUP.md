# Admin Setup Guide

This guide explains how to set up admin accounts for the HKRA Vendor Portal.

## Overview

Admins can:

- View all CPD requests from all vendors
- Approve or reject requests
- Add admin notes to requests
- View attendance files

## Creating an Admin Account

### Method 1: Using Supabase Dashboard + SQL Editor

1. **Create the Auth User:**

   - Go to Supabase Dashboard → Authentication → Users
   - Click "Add User"
   - Enter email and password
   - Click "Create User"

2. **Set Admin Role:**
   - Go to SQL Editor
   - Run the following SQL (replace `admin@example.com` with the actual email):

```sql
-- Set admin role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'admin@example.com';
```

### Method 2: Using Helper Script

Create a script similar to `scripts/setup-vendor-user.ts` but for admins:

```typescript
// scripts/setup-admin-user.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupAdminUser(email: string, password: string) {
  // Create auth user
  const {
    data: authData,
    error: authError,
  } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role: "admin",
    },
  });

  if (authError) {
    console.error("Error creating admin user:", authError);
    return;
  }

  console.log("Admin user created successfully!");
  console.log("User ID:", authData.user.id);
  console.log("Email:", authData.user.email);
}

// Get email and password from command line
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error(
    "Usage: bun run scripts/setup-admin-user.ts <email> <password>"
  );
  process.exit(1);
}

setupAdminUser(email, password);
```

Run it with:

```bash
export SUPABASE_URL=your_supabase_url
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
bun run scripts/setup-admin-user.ts admin@example.com password123
```

## Admin Login

1. Navigate to `/vendor/login` (same login page as vendors)
2. Enter admin email and password
3. After login, admins are automatically redirected to `/admin/dashboard`

## Admin Dashboard Features

### View All Requests

- See all CPD requests from all vendors
- Filter by status (Pending, Approved, Rejected, Withdrawn)
- View status summary cards

### Approve/Reject Requests

1. Click on any request to view details
2. For pending requests, you'll see "Admin Actions" section
3. Enter admin notes (required for approval)
4. Enter rejection reason (required for rejection)
5. Click "Approve Request" or "Reject Request"

### Request Details

- View full event details
- View vendor contact information
- View event poster (if uploaded)
- View attendance file (if uploaded for approved requests)
- View status history

## Security Notes

- Admin accounts do NOT need a vendor record in the `vendors` table
- Admin role is stored in `auth.users.raw_user_meta_data.role`
- RLS policies automatically grant admins access to all requests
- Edge functions check for admin role before allowing access

## Troubleshooting

### Admin cannot login

- Verify the role is set correctly: `raw_user_meta_data.role = 'admin'`
- Check that the user exists in `auth.users`
- Verify email and password are correct

### Admin sees "Access Denied"

- Check browser console for errors
- Verify the edge function is deployed and updated
- Check that the user's role metadata is correct

### Admin cannot see requests

- Verify RLS policies are enabled
- Check that the admin role check is working in edge functions
- Ensure the edge function has been redeployed after updates




