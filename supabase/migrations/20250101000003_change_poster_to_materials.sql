-- Change poster_file_url from TEXT to JSONB to support multiple files
-- This allows storing an array of file URLs for event-related materials

-- First, migrate existing single URLs to array format
UPDATE vendor_requests
SET poster_file_url = CASE
    WHEN poster_file_url IS NOT NULL AND poster_file_url != '' THEN
        jsonb_build_array(poster_file_url)
    ELSE
        NULL
END
WHERE poster_file_url IS NOT NULL;

-- Change column type to JSONB
ALTER TABLE vendor_requests
ALTER COLUMN poster_file_url TYPE JSONB
USING CASE
    WHEN poster_file_url IS NULL THEN NULL
    WHEN jsonb_typeof(poster_file_url::jsonb) = 'array' THEN poster_file_url::jsonb
    ELSE jsonb_build_array(poster_file_url::text)
END;

-- Add comment to document the change
COMMENT ON COLUMN vendor_requests.poster_file_url IS 'Array of URLs for event-related materials (posters, rundowns, etc.) stored as JSONB';

