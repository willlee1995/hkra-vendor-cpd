-- Helper function to set up a vendor user
-- This function updates user metadata and creates/updates vendor record
--
-- Usage:
-- SELECT setup_vendor_user(
--   'user-uuid-here',
--   'Company Name',
--   'Contact Name',
--   'contact@example.com',
--   '+1234567890'
-- );

CREATE OR REPLACE FUNCTION setup_vendor_user(
  p_user_id UUID,
  p_company_name VARCHAR(255),
  p_contact_name VARCHAR(255),
  p_contact_email VARCHAR(255),
  p_contact_phone VARCHAR(50) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_vendor_id UUID;
BEGIN
  -- Update user metadata to set role
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"vendor"'
  )
  WHERE id = p_user_id;

  -- Create or update vendor record
  INSERT INTO vendors (
    user_id,
    company_name,
    contact_name,
    contact_email,
    contact_phone
  )
  VALUES (
    p_user_id,
    p_company_name,
    p_contact_name,
    p_contact_email,
    p_contact_phone
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    company_name = EXCLUDED.company_name,
    contact_name = EXCLUDED.contact_name,
    contact_email = EXCLUDED.contact_email,
    contact_phone = EXCLUDED.contact_phone,
    updated_at = NOW()
  RETURNING id INTO v_vendor_id;

  RETURN v_vendor_id;
END;
$$;

-- Example usage:
-- First, create the user via Supabase Auth API or Dashboard
-- Then get the user_id and run:
--
-- SELECT setup_vendor_user(
--   (SELECT id FROM auth.users WHERE email = 'vendor@example.com'),
--   'Acme Corporation',
--   'John Doe',
--   'vendor@example.com',
--   '+1234567890'
-- );

