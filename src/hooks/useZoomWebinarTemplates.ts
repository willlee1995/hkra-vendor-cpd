import { useQuery } from '@tanstack/react-query'
import { vendorApiClient } from '@/lib/vendorApiClient'

export function useZoomWebinarTemplates(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['zoom-webinar-templates'],
    enabled: options?.enabled ?? true,
    queryFn: () => vendorApiClient.listZoomWebinarTemplates(),
    staleTime: 5 * 60 * 1000,
  })
}
