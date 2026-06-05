export type VendorRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface Vendor {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  zoom_webinar_auto_create?: boolean
  created_at: string
  updated_at: string
}

export interface VendorRequest {
  id: string
  vendor_id: string
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string | null
  event_end_time?: string | null
  expected_cpd_points?: number | null
  vendor_company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  poster_file_url?: string[] // Array of URLs for event-related materials
  zoom_webinar_id?: string // Optional Zoom webinar ID (vendor-entered or API-created)
  zoom_template_webinar_id?: string | null
  zoom_template_kind?: 'template' | 'webinar' | 'past' | null
  zoom_join_url?: string | null
  zoom_host_start_url?: string | null
  zoom_created_at?: string | null
  zoom_sync_error?: string | null
  on24_key?: string
  on24_id?: string
  expected_promotion_date?: string
  status: VendorRequestStatus
  admin_notes?: string
  rejection_reason?: string
  approved_by?: string
  approved_at?: string
  /** WordPress post ID after HKRA site create-event sync */
  hkra_wp_event_id?: number | null
  hkra_event_permalink?: string | null
  hkra_event_created_at?: string | null
  /** Last HKRA WordPress sync error (cleared on success) */
  hkra_event_sync_error?: string | null
  attendance_file_url?: string[] // Array of URLs for attendance files
  attendance_uploaded_at?: string
  created_at: string
  updated_at: string
  vendor_request_status_history?: StatusHistory[]
}

export interface StatusHistory {
  id: string
  request_id: string
  status: VendorRequestStatus
  changed_by: string
  notes?: string
  created_at: string
}

export interface CreateVendorRequestInput {
  /** Required when an admin creates a request on behalf of a vendor */
  vendor_id?: string
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time: string
  event_end_time: string
  vendor_company_name?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  poster_file_url?: string[] // Array of URLs for event-related materials
  zoom_webinar_id?: string
  /** Zoom template or source webinar id (when auto-create enabled) */
  zoom_template_webinar_id?: string
  zoom_template_kind?: 'template' | 'webinar' | 'past'
  on24_key?: string
  on24_id?: string
  expected_promotion_date?: string
}

export interface UpdateVendorRequestInput {
  event_name?: string
  event_start_date?: string
  event_end_date?: string
  event_start_time?: string
  event_end_time?: string
  expected_cpd_points?: number
  vendor_company_name?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  poster_file_url?: string[] // Array of URLs for event-related materials
  zoom_webinar_id?: string
  zoom_template_webinar_id?: string | null
  zoom_template_kind?: 'template' | 'webinar' | 'past' | null
  on24_key?: string
  on24_id?: string
  expected_promotion_date?: string
  status?: VendorRequestStatus // Admins can update status
  admin_notes?: string // Admins can add notes
  rejection_reason?: string // Admins can add rejection reason
}

export interface VendorRequestsFilter {
  status?: VendorRequestStatus
  /** Admin only: restrict list to this vendor (e.g. latest submission for a new request template) */
  vendor_id?: string
}

