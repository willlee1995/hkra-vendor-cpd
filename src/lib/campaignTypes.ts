export type EmailCampaignJobStatus =
  | 'queued'
  | 'generating'
  | 'dry_run_ready'
  | 'needs_input'
  | 'scheduled'
  | 'failed'
  | 'cancelled'

export interface EmailCampaignJob {
  id: string
  vendor_request_id: string
  status: EmailCampaignJobStatus
  cursor_agent_id?: string | null
  cursor_run_id?: string | null
  github_branch?: string | null
  registration_url?: string | null
  poster_urls?: string[] | null
  html_preview?: string | null
  meta_json?: Record<string, unknown> | null
  fluentcrm_campaign_id?: number | null
  dry_run_summary?: {
    campaign_title?: string
    email_subject?: string
    contact_count?: number
    schedule_hkt?: string
    schedule_utc?: string
    audience?: Array<{ id: string; title: string }>
    large_audience_warning?: boolean
  } | null
  list_ids?: string[] | null
  scheduled_at_local?: string | null
  error_message?: string | null
  admin_prompt?: string | null
  missing_fields?: string[] | null
  created_at?: string
  updated_at?: string
}

export interface FluentCrmAudience {
  id: string
  title: string
  slug: string
  subscribersCount: number
}
