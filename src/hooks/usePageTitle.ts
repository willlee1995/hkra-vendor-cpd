import { useEffect } from 'react'
import { useVendorAuth } from './useVendorAuth'

export function usePageTitle(title?: string) {
  const { isAdmin, loading } = useVendorAuth()

  useEffect(() => {
    if (loading) return

    if (title) {
      document.title = title
    } else {
      // Default title based on user role
      const baseTitle = isAdmin()
        ? 'HKRA CPD Admin Portal'
        : 'HKRA Vendor Portal - CPD Request System'
      document.title = baseTitle
    }
  }, [title, isAdmin, loading])
}







