-- Vendor-selected Zoom webinar template (official template or past webinar to copy settings from)
ALTER TABLE vendor_requests
ADD COLUMN IF NOT EXISTS zoom_template_webinar_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS zoom_template_kind VARCHAR(20);

COMMENT ON COLUMN vendor_requests.zoom_template_webinar_id IS
  'Zoom template id or source webinar id chosen by vendor before approval';
COMMENT ON COLUMN vendor_requests.zoom_template_kind IS
  'template = Zoom webinar template; webinar = copy settings from a listed/past webinar';
