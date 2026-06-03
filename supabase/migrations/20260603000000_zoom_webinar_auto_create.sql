-- Zoom webinar auto-create for allowlisted vendors
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS zoom_webinar_auto_create BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN vendors.zoom_webinar_auto_create IS
  'When true, approval triggers Zoom API webinar creation and WP product meta sync';

ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS zoom_join_url TEXT,
ADD COLUMN IF NOT EXISTS zoom_host_start_url TEXT,
ADD COLUMN IF NOT EXISTS zoom_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS zoom_sync_error TEXT;

COMMENT ON COLUMN vendor_requests.zoom_join_url IS 'Attendee join URL from Zoom API after auto-create';
COMMENT ON COLUMN vendor_requests.zoom_host_start_url IS 'Host start URL from Zoom API (admin only)';
COMMENT ON COLUMN vendor_requests.zoom_created_at IS 'When Zoom webinar was created via API';
COMMENT ON COLUMN vendor_requests.zoom_sync_error IS 'Last Zoom API sync error (cleared on success)';
