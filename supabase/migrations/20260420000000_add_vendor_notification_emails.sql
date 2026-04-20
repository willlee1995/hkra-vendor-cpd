-- Extra notification recipients per vendor (merged with request contact_email when sending mail)
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS notification_emails TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN vendors.notification_emails IS 'Additional email addresses to receive vendor-facing transactional notifications (CPD request lifecycle, attendance, reminders).';
