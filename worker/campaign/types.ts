export type CampaignJobStatus =
  | 'queued'
  | 'generating'
  | 'dry_run_ready'
  | 'needs_input'
  | 'scheduled'
  | 'failed'
  | 'cancelled'

export interface CampaignJobRow {
  id: string
  vendor_request_id: string
  status: CampaignJobStatus
  cursor_agent_id: string | null
  cursor_run_id: string | null
  github_branch: string | null
  registration_url: string | null
  poster_urls: string[] | null
  html_preview: string | null
  meta_json: Record<string, unknown> | null
  fluentcrm_campaign_id: number | null
  dry_run_summary: Record<string, unknown> | null
  list_ids: string[] | null
  scheduled_at_local: string | null
  error_message: string | null
  admin_prompt: string | null
  missing_fields: string[] | null
  created_at: string
  updated_at: string
}

export interface VendorRequestRow {
  id: string
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string | null
  event_end_time?: string | null
  expected_cpd_points?: number | null
  vendor_company_name?: string | null
  zoom_webinar_id?: string | null
  zoom_join_url?: string | null
  on24_key?: string | null
  on24_id?: string | null
  poster_file_url?: string[] | string | null
  hkra_wp_event_id?: number | null
  hkra_event_permalink?: string | null
  hkra_event_sync_error?: string | null
  admin_notes?: string | null
  status?: string | null
}

export interface Env {
  CURSOR_API_KEY: string
  HKRA_PUBLISH_TOKEN: string
  GITHUB_TOKEN: string
  CAMPAIGN_WEBHOOK_SECRET: string
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  HKRA_SITE_URL?: string
  HKRA_CAMPAIGN_REPO?: string
  HKRA_DEFAULT_LIST_IDS?: string
}

export interface CampaignArtifacts {
  html: string
  meta: Record<string, unknown>
  slug: string
}
