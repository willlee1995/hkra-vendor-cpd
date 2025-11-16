import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestTable } from '@/components/vendor/VendorRequestTable'
import { useVendorRequests } from '@/hooks/useVendorRequests'
import { HKRAHeader } from '@/components/vendor/HKRAHeader'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, Clock, FileX } from 'lucide-react'

export function AdminDashboard() {
  const { data: requests, isLoading } = useVendorRequests()
  const { isAdmin } = useVendorAuth()
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  // Set page title for admin
  usePageTitle('HKRA CPD Admin Portal')

  // Filter requests by status
  const filteredRequests = statusFilter
    ? requests?.filter((r) => r.status === statusFilter)
    : requests

  if (!isAdmin()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>Admin access required</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Count requests by status
  const statusCounts = {
    pending: requests?.filter((r) => r.status === 'pending').length || 0,
    approved: requests?.filter((r) => r.status === 'approved').length || 0,
    rejected: requests?.filter((r) => r.status === 'rejected').length || 0,
    withdrawn: requests?.filter((r) => r.status === 'withdrawn').length || 0,
  }

  return (
    <div className="min-h-screen bg-background">
      <HKRAHeader showSignOut />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">Admin Dashboard</h2>
          <p className="text-muted-foreground">Manage all CPD requests</p>
        </div>

        {/* Status Summary Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.rejected}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Withdrawn</CardTitle>
              <FileX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statusCounts.withdrawn}</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Filter */}
        <div className="mb-4 flex gap-2">
          <Button
            variant={statusFilter === undefined ? 'default' : 'outline'}
            onClick={() => setStatusFilter(undefined)}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('pending')}
            size="sm"
          >
            Pending
          </Button>
          <Button
            variant={statusFilter === 'approved' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('approved')}
            size="sm"
          >
            Approved
          </Button>
          <Button
            variant={statusFilter === 'rejected' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('rejected')}
            size="sm"
          >
            Rejected
          </Button>
          <Button
            variant={statusFilter === 'withdrawn' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('withdrawn')}
            size="sm"
          >
            Withdrawn
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Requests</CardTitle>
            <CardDescription>
              View and manage all CPD request submissions from all vendors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorRequestTable data={filteredRequests || []} isLoading={isLoading} isAdmin={true} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

