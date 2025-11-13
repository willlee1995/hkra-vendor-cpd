import { Badge } from '@/components/ui/badge'
import type { VendorRequestStatus } from '@/lib/vendorTypes'

interface VendorStatusBadgeProps {
  status: VendorRequestStatus
}

export function VendorStatusBadge({ status }: VendorStatusBadgeProps) {
  const statusConfig = {
    pending: {
      label: 'Under Review',
      className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    },
    approved: {
      label: 'CPD Granted',
      className: 'bg-green-100 text-green-800 hover:bg-green-100',
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-100 text-red-800 hover:bg-red-100',
    },
    withdrawn: {
      label: 'Withdrawn',
      className: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
    },
  }

  const config = statusConfig[status]

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

