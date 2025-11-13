-- Diagnostic script to check if vendor record matches authenticated user
-- Run this in Supabase SQL Editor while logged in as the vendor user

-- Step 1: Check your current authenticated user ID
-- (This will show your user ID if you're logged in via the dashboard)
SELECT
  auth.uid() as current_user_id,
  (SELECT email FROM auth.users WHERE id = auth.uid()) as current_user_email;

-- Step 2: Check vendor records and their associated user emails
SELECT
  v.id as vendor_id,
  v.user_id,
  v.company_name,
  v.contact_email,
  u.email as user_email,
  u.raw_user_meta_data->>'role' as user_role,
  CASE
    WHEN v.user_id = auth.uid() THEN 'MATCH - This is your vendor record'
    ELSE 'NO MATCH - Different user'
  END as match_status
FROM vendors v
LEFT JOIN auth.users u ON v.user_id = u.id
ORDER BY v.created_at DESC;

-- Step 3: Find vendor record for a specific email
-- Replace 'cwlee.will@gmail.com' with your actual email
SELECT
  v.*,
  u.email as user_email,
  u.id as auth_user_id
FROM vendors v
JOIN auth.users u ON v.user_id = u.id
WHERE u.email = 'cwlee.will@gmail.com';

-- Step 4: If the user_id doesn't match, update it
-- WARNING: Only run this if you're sure about the user_id
-- Replace 'YOUR_VENDOR_ID' and 'YOUR_USER_ID' with actual values
-- UPDATE vendors
-- SET user_id = 'YOUR_USER_ID'
-- WHERE id = 'YOUR_VENDOR_ID';

