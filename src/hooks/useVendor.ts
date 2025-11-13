import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface Vendor {
  id: string
  user_id: string
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone: string | null
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

export function useVendor() {
  return useQuery({
    queryKey: ['vendor'],
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

      return response.json()
    },
    retry: 1,
    refetchOnWindowFocus: false,
  })
}

