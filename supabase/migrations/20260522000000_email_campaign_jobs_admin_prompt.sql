-- Optional admin notes passed to Cursor cloud agent for email enrichment
ALTER TABLE email_campaign_jobs
    ADD COLUMN IF NOT EXISTS admin_prompt TEXT;

COMMENT ON COLUMN email_campaign_jobs.admin_prompt IS
    'Admin-supplied extra context for Cursor email generation (speaker bios, co-host notes, etc.)';
