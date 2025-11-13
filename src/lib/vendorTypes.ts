export type VendorRequestStatus = 'pending' | 'approved' | 'rejected' | 'withdrawn'

export interface Vendor {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  created_at: string
  updated_at: string
}

export interface VendorRequest {
  id: string
  vendor_id: string
  event_name: string
  event_start_date: string
  event_end_date: string
  expected_cpd_points: number
  vendor_company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  poster_file_url?: string
  expected_promotion_date?: string
  status: VendorRequestStatus
  admin_notes?: string
  rejection_reason?: string
  approved_by?: string
  approved_at?: string
  attendance_file_url?: string
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
  event_name: string
  event_start_date: string
  event_end_date: string
  expected_cpd_points: number
  vendor_company_name?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  poster_file_url?: string
  expected_promotion_date?: string
}

export interface UpdateVendorRequestInput {
  event_name?: string
  event_start_date?: string
  event_end_date?: string
  expected_cpd_points?: number
  vendor_company_name?: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  poster_file_url?: string
  expected_promotion_date?: string
}

export interface VendorRequestsFilter {
  status?: VendorRequestStatus
}

