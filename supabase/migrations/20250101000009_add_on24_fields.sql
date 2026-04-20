-- Add ON24 key and ID to vendor requests
ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS on24_key text,
ADD COLUMN IF NOT EXISTS on24_id text;
