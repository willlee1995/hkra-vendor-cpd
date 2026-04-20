import { supabase } from './supabase'
import type {
  VendorRequest,
  CreateVendorRequestInput,
  UpdateVendorRequestInput,
  VendorRequestsFilter,
} from './vendorTypes'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    throw new Error('Not authenticated')
  }
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

export const vendorApiClient = {
  // Get all vendor requests
  async getRequests(filter?: VendorRequestsFilter): Promise<VendorRequest[]> {
    const headers = await getAuthHeaders()
    const params = new URLSearchParams()
    if (filter?.status) {
      params.append('status', filter.status)
    }
    if (filter?.vendor_id) {
      params.append('vendor_id', filter.vendor_id)
    }

    const url = `${EDGE_FUNCTION_URL}/vendor-requests${params.toString() ? `?${params.toString()}` : ''}`
    const response = await fetch(url, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch requests')
    }

    return response.json()
  },

  // Get single vendor request
  async getRequest(id: string): Promise<VendorRequest> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-requests/${id}`, {
      method: 'GET',
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to fetch request')
    }

    return response.json()
  },

  // Create new vendor request
  async createRequest(input: CreateVendorRequestInput): Promise<VendorRequest> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-requests`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      const errorMessage = error.error || 'Failed to create request'

      if (
        errorMessage.includes('Vendor record not found') ||
        errorMessage.includes('Vendor record required')
      ) {
        const errorData = error as { userId?: string }
        const userId = errorData?.userId || 'unknown'
        throw new Error(
          `Vendor account not set up. User ID: ${userId}. Please ensure the vendor record's user_id matches your authenticated user ID.`
        )
      }

      throw new Error(errorMessage)
    }

    return response.json()
  },

  // Update vendor request
  async updateRequest(id: string, input: UpdateVendorRequestInput): Promise<VendorRequest> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-requests/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update request')
    }

    return response.json()
  },

  // Withdraw vendor request
  async withdrawRequest(id: string): Promise<VendorRequest> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-requests/${id}`, {
      method: 'DELETE',
      headers,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to withdraw request')
    }

    return response.json()
  },

  // Upload attendance files (supports multiple files)
  async uploadAttendance(requestId: string, files: File[]): Promise<{ success: boolean; fileUrls: string[]; allFileUrls: string[]; errors?: string[]; request: VendorRequest }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    formData.append('requestId', requestId)

    console.log('Uploading attendance:', { filesCount: files.length, requestId })

    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        // Don't set Content-Type - let browser set it with boundary for FormData
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Upload error response:', error)
      // Show detailed error information if available
      if (error.details) {
        const detailsMsg = typeof error.details === 'object'
          ? JSON.stringify(error.details)
          : Array.isArray(error.details)
            ? error.details.join(', ')
            : error.details
        throw new Error(`${error.error || 'Failed to upload files'}: ${detailsMsg}`)
      }
      throw new Error(error.error || 'Failed to upload files')
    }

    return response.json()
  },

  // Upload poster files (supports multiple files)
  async uploadPoster(files: File[], vendorId?: string): Promise<string[]> {
    const headers = await getAuthHeaders()

    // Create FormData for file upload
    const formData = new FormData()
    files.forEach(file => {
      formData.append('files', file)
    })
    if (vendorId) {
      formData.append('vendor_id', vendorId)
    }

    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-upload-poster`, {
      method: 'POST',
      headers: {
        'Authorization': headers['Authorization'],
        // Don't set Content-Type - let browser set it with boundary for FormData
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      const errorMessage = error.error || 'Failed to upload files'

      if (
        errorMessage.includes('Vendor record not found') ||
        errorMessage.includes('Vendor record required')
      ) {
        const errorData = error as { userId?: string }
        const userId = errorData?.userId || 'unknown'
        throw new Error(
          `Vendor account not set up. User ID: ${userId}. Please ensure the vendor record's user_id matches your authenticated user ID.`
        )
      }

      throw new Error(errorMessage)
    }

    const result = await response.json()
    // Support both old format (fileUrl) and new format (fileUrls)
    if (result.fileUrls) {
      return result.fileUrls
    } else if (result.fileUrl) {
      return [result.fileUrl]
    } else {
      throw new Error('Invalid response from server')
    }
  },

  /**
   * Create (or sync) HKRA website event via WordPress API for an approved vendor request.
   * Admin only. Requires Edge Function `hkra-create-event` and HKRA_WP_* secrets.
   */
  async createHkraEventFromRequest(
    requestId: string,
    options?: { force?: boolean },
  ): Promise<{
    success: boolean
    skipped?: boolean
    reason?: string
    message?: string
    error?: string
    wp_event_id?: number
    link?: string
    request?: VendorRequest
  }> {
    const headers = await getAuthHeaders()
    const response = await fetch(`${EDGE_FUNCTION_URL}/hkra-create-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        request_id: requestId,
        force: options?.force === true,
      }),
    })

    const data = await response.json().catch(() => ({}))

    if (response.status === 409) {
      return {
        success: false,
        skipped: true,
        reason: data.reason,
        message: typeof data.message === 'string' ? data.message : undefined,
        request: data.request,
      }
    }

    if (response.status === 503) {
      return {
        success: false,
        skipped: true,
        reason: 'not_configured',
        message: typeof data.message === 'string' ? data.message : 'HKRA WordPress not configured',
        request: data.request,
      }
    }

    if (!response.ok) {
      const err = typeof data.error === 'string' ? data.error : 'Failed to create HKRA event'
      throw new Error(err)
    }

    return data as {
      success: boolean
      skipped?: boolean
      wp_event_id?: number
      link?: string
      request?: VendorRequest
    }
  },
}

