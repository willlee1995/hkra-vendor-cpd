import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export interface Vendor {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
  notification_emails: string[]
  zoom_webinar_auto_create?: boolean
  created_at: string
  updated_at: string
}

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

export function useVendor(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['vendor'],
    enabled: options?.enabled ?? true,
    queryFn: async (): Promise<Vendor | null> => {
      const headers = await getAuthHeaders()

      // Use Edge Function to get vendor info (bypasses RLS issues)
      const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-info`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Vendor not found - return null
          return null
        }
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch vendor information')
      }

      const data = await response.json()
      return {
        ...data,
        notification_emails: Array.isArray(data.notification_emails) ? data.notification_emails : [],
      } as Vendor
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

export function useUpdateVendorNotificationEmails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (notification_emails: string[]): Promise<Vendor> => {
      const headers = await getAuthHeaders()
      const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-info`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ notification_emails }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update notification recipients')
      }

      const data = await response.json()
      return {
        ...data,
        notification_emails: Array.isArray(data.notification_emails) ? data.notification_emails : [],
      } as Vendor
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor'] })
    },
  })
}

export function useAdminVendorsList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['vendors', 'admin-list'],
    enabled: options?.enabled ?? false,
    queryFn: async (): Promise<Vendor[]> => {
      const headers = await getAuthHeaders()
      const response = await fetch(`${EDGE_FUNCTION_URL}/vendor-info?list=true`, {
        method: 'GET',
        headers,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to list vendors')
      }

      const rows = (await response.json()) as Vendor[]
      return rows.map((v) => ({
        ...v,
        notification_emails: Array.isArray(v.notification_emails) ? v.notification_emails : [],
      }))
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
