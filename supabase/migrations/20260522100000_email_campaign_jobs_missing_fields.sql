-- Fields the admin must supply before retrying generation (from agent JOB_STATUS or worker validation)
ALTER TABLE email_campaign_jobs
    ADD COLUMN IF NOT EXISTS missing_fields JSONB;

COMMENT ON COLUMN email_campaign_jobs.missing_fields IS
    'String array of missing input keys when status is needs_input (e.g. speakers, registration_url, cpd)';
