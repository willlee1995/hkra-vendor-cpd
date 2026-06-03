-- Email campaign jobs (FluentCRM generation via Cursor cloud + Worker orchestrator)
CREATE TABLE IF NOT EXISTS email_campaign_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_request_id UUID NOT NULL REFERENCES vendor_requests(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued' CHECK (
        status IN (
            'queued',
            'generating',
            'dry_run_ready',
            'needs_input',
            'scheduled',
            'failed',
            'cancelled'
        )
    ),
    cursor_agent_id TEXT,
    cursor_run_id TEXT,
    github_branch TEXT,
    registration_url TEXT,
    poster_urls JSONB,
    html_preview TEXT,
    meta_json JSONB,
    fluentcrm_campaign_id INTEGER,
    dry_run_summary JSONB,
    list_ids JSONB,
    scheduled_at_local TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_campaign_jobs_active_request
    ON email_campaign_jobs(vendor_request_id)
    WHERE status IN ('queued', 'generating', 'dry_run_ready', 'needs_input');

CREATE INDEX IF NOT EXISTS idx_email_campaign_jobs_vendor_request_id
    ON email_campaign_jobs(vendor_request_id);

CREATE INDEX IF NOT EXISTS idx_email_campaign_jobs_status
    ON email_campaign_jobs(status);

CREATE TRIGGER update_email_campaign_jobs_updated_at
    BEFORE UPDATE ON email_campaign_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE email_campaign_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all campaign jobs
CREATE POLICY "Admins can manage email campaign jobs" ON email_campaign_jobs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text IN ('admin', 'super-admin')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
                AND (auth.users.raw_user_meta_data->>'role')::text IN ('admin', 'super-admin')
        )
    );

-- Vendors can view campaign job status for their own requests
CREATE POLICY "Vendors can view own email campaign jobs" ON email_campaign_jobs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM vendor_requests vr
            JOIN vendors v ON v.id = vr.vendor_id
            WHERE vr.id = email_campaign_jobs.vendor_request_id
                AND v.user_id = auth.uid()
        )
    );

COMMENT ON TABLE email_campaign_jobs IS 'Cursor cloud email generation + FluentCRM schedule workflow per vendor CPD request';
