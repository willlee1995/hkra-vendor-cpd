-- Add event_start_time and event_end_time fields to vendor_requests table
ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS event_start_time TIME,
ADD COLUMN IF NOT EXISTS event_end_time TIME;

-- Add comments to document the fields
COMMENT ON COLUMN vendor_requests.event_start_time IS 'Start time of the CPD event';
COMMENT ON COLUMN vendor_requests.event_end_time IS 'End time of the CPD event';

