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

      // Provide helpful message for vendor record not found
      if (errorMessage.includes('Vendor record not found') || response.status === 403) {
        const errorData = error as any
        const userId = errorData?.userId || 'unknown'
        throw new Error(`Vendor account not set up. User ID: ${userId}. Please ensure the vendor record's user_id matches your authenticated user ID.`)
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

  // Upload attendance file
  async uploadAttendance(requestId: string, file: File): Promise<{ success: boolean; fileUrl: string; request: VendorRequest }> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('Not authenticated')
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('requestId', requestId)

    const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to upload file')
    }

    return response.json()
  },

  // Upload poster file
  async uploadPoster(file: File): Promise<string> {
    const { data: { session }, data: { user } } = await supabase.auth.getSession()
    if (!session || !user) {
      throw new Error('Not authenticated')
    }

    // Get vendor ID
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (vendorError) {
      // Check if it's a "not found" error or a different error
      if (vendorError.code === 'PGRST116' || vendorError.message?.includes('No rows')) {
        throw new Error('Vendor account not set up. Please contact administrator to create your vendor profile.')
      }
      throw new Error(`Database error: ${vendorError.message || 'Vendor record not found'}`)
    }

    if (!vendor) {
      throw new Error('Vendor account not set up. Please contact administrator to create your vendor profile.')
    }

    // Generate file path
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    const filePath = `${vendor.id}/${fileName}`

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('vendor-posters')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message || 'Failed to upload poster')
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('vendor-posters')
      .getPublicUrl(filePath)

    return urlData.publicUrl
  },
}

