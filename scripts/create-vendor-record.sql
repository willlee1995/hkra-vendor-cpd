-- Quick script to create a vendor record for an existing user
-- Replace 'your-email@example.com' with the actual user email

-- Step 1: Find your user ID
SELECT id, email, raw_user_meta_data->>'role' as role
FROM auth.users
WHERE email = 'your-email@example.com';

-- Step 2: Create vendor record (replace YOUR_USER_ID with the id from Step 1)
INSERT INTO vendors (user_id, company_name, contact_name, contact_email, contact_phone)
SELECT
  id,
  'Your Company Name',  -- Update this
  'Your Name',           -- Update this
  email,
  '+1234567890'          -- Update this (optional)
FROM auth.users
WHERE email = 'your-email@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Step 3: Verify the vendor record was created
SELECT v.*, u.email
FROM vendors v
JOIN auth.users u ON v.user_id = u.id
WHERE u.email = 'your-email@example.com';

-- Alternative: Use the helper function (if available)
-- SELECT setup_vendor_user(
--   (SELECT id FROM auth.users WHERE email = 'your-email@example.com'),
--   'Your Company Name',
--   'Your Name',
--   'your-email@example.com',
--   '+1234567890'
-- );

