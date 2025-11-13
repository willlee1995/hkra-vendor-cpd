# Setting Up Vendor Users

This guide explains how to set user metadata to assign the `vendor` role to users in Supabase.

## Method 1: Using Supabase Dashboard + SQL Editor (Recommended)

**Note:** The Supabase Dashboard UI doesn't allow direct modification of user metadata. You must use SQL to update user metadata.

### Step 1: Create User in Auth

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** > **Users**
3. Click **Add User** or **Invite User**
4. Enter the email and password
5. Click **Create User**
6. Copy the **UUID** shown at the top of the user details page

### Step 2: Update User Metadata via SQL

1. Go to **SQL Editor** in Supabase Dashboard
2. Run this SQL to set the vendor role (replace with actual email or UUID):

```sql
-- Update by email (easiest)
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendor"'
)
WHERE email = 'vendor@example.com';

-- OR update by UUID
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendor"'
)
WHERE id = 'USER_UUID_HERE';
```

### Step 3: Create Vendor Record

After setting the role, create a corresponding record in the `vendors` table:

```sql
-- Create vendor record (using email to find user_id)
INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone)
SELECT
  id,
  'Company Name',
  'Contact Name',
  email,
  '+1234567890'
FROM auth.users
WHERE email = 'vendor@example.com'
ON CONFLICT (user_id) DO UPDATE
SET
  company_name = EXCLUDED.company_name,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone;
```

**Or use the helper function** (after running migrations):

```sql
SELECT setup_vendor_user(
  (SELECT id FROM auth.users WHERE email = 'vendor@example.com'),
  'Company Name',
  'Contact Name',
  'vendor@example.com',
  '+1234567890'
);
```

## Method 2: Complete SQL Script (All-in-One)

Here's a complete SQL script that does everything in one go:

```sql
-- Step 1: Update user metadata to set role as 'vendor'
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendor"'
)
WHERE email = 'vendor@example.com';

-- Step 2: Create or update vendor record
INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone)
SELECT
  id,
  'Company Name',
  'Contact Name',
  email,
  '+1234567890'
FROM auth.users
WHERE email = 'vendor@example.com'
ON CONFLICT (user_id) DO UPDATE
SET
  company_name = EXCLUDED.company_name,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone,
  updated_at = NOW();

-- Step 3: Verify the setup
SELECT
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as role,
  v.company_name,
  v.contact_name
FROM auth.users u
LEFT JOIN vendors v ON v.user_id = u.id
WHERE u.email = 'vendor@example.com';
```

**To use this script:**

1. Replace `'vendor@example.com'` with the actual email
2. Replace company/contact details with actual values
3. Run in Supabase SQL Editor

## Method 3: Using SQL Editor (Bulk Update Multiple Users)

To update multiple users at once:

```sql
-- Update multiple users by email list
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"vendor"'
)
WHERE email IN (
  'vendor1@example.com',
  'vendor2@example.com',
  'vendor3@example.com'
);

-- Then create vendor records for all updated users
INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone)
SELECT
  id,
  'Company Name',  -- You may want to customize this per user
  'Contact Name',
  email,
  '+1234567890'
FROM auth.users
WHERE email IN (
  'vendor1@example.com',
  'vendor2@example.com',
  'vendor3@example.com'
)
ON CONFLICT (user_id) DO UPDATE
SET
  company_name = EXCLUDED.company_name,
  contact_name = EXCLUDED.contact_name,
  contact_email = EXCLUDED.contact_email,
  contact_phone = EXCLUDED.contact_phone;
```

## Method 4: Using Supabase Management API

You can use the Supabase Management API with a service role key:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  "YOUR_SUPABASE_URL",
  "YOUR_SERVICE_ROLE_KEY", // Use service role key, not anon key
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Update user metadata
const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
  "USER_UUID",
  {
    user_metadata: {
      role: "vendor",
    },
  }
);
```

## Method 5: Using the Helper Script

See `scripts/setup-vendor-user.ts` for a ready-to-use script that automates the entire process.

## Verification

After setting up, verify the user has the correct role:

```sql
SELECT
  id,
  email,
  raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'vendor@example.com';
```

The role should be `vendor`.

## Troubleshooting

- **User can't login**: Make sure the role is set correctly in `raw_user_meta_data`
- **Access denied error**: Verify `user_metadata.role === 'vendor'` (check in browser console)
- **Vendor record not found**: Make sure you've created a record in the `vendors` table
