-- Change attendance_file_url from TEXT to JSONB to support multiple files
-- This allows storing an array of file URLs for attendance files
-- First, migrate existing single URLs to array format
UPDATE vendor_requests
SET attendance_file_url = CASE
        WHEN attendance_file_url IS NOT NULL
        AND attendance_file_url != '' THEN jsonb_build_array(attendance_file_url)
        ELSE NULL
    END
WHERE attendance_file_url IS NOT NULL;
-- Change column type to JSONB
ALTER TABLE vendor_requests
ALTER COLUMN attendance_file_url TYPE JSONB USING CASE
        WHEN attendance_file_url IS NULL THEN NULL
        WHEN jsonb_typeof(attendance_file_url::jsonb) = 'array' THEN attendance_file_url::jsonb
        ELSE jsonb_build_array(attendance_file_url::text)
    END;
-- Add comment to document the change
COMMENT ON COLUMN vendor_requests.attendance_file_url IS 'Array of URLs for attendance files stored as JSONB';