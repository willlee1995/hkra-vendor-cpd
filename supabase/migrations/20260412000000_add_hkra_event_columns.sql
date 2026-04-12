-- HKRA WordPress Events Manager sync (see event-api.md)
ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS hkra_wp_event_id INTEGER,
ADD COLUMN IF NOT EXISTS hkra_event_permalink TEXT,
ADD COLUMN IF NOT EXISTS hkra_event_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hkra_event_sync_error TEXT;

COMMENT ON COLUMN vendor_requests.hkra_wp_event_id IS 'WordPress post ID after create-event API success';
COMMENT ON COLUMN vendor_requests.hkra_event_permalink IS 'Public event URL from WordPress';
COMMENT ON COLUMN vendor_requests.hkra_event_created_at IS 'When the HKRA site event was created';
COMMENT ON COLUMN vendor_requests.hkra_event_sync_error IS 'Last WordPress sync error message (cleared on success)';
