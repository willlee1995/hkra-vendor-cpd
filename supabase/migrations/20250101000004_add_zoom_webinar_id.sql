-- Add zoom_webinar_id field to vendor_requests table
ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS zoom_webinar_id VARCHAR(255);

-- Add comment to document the field
COMMENT ON COLUMN vendor_requests.zoom_webinar_id IS 'Optional Zoom webinar ID for the CPD event';

