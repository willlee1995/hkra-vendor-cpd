import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestTable } from '@/components/vendor/VendorRequestTable'
import { useVendorRequests } from '@/hooks/useVendorRequests'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { Plus } from 'lucide-react'
import { HKRAHeader } from '@/components/vendor/HKRAHeader'

export function Dashboard() {
  const { data: requests, isLoading } = useVendorRequests()
  const { isAdmin } = useVendorAuth()
  const navigate = useNavigate()

  // Redirect admins to admin dashboard
  useEffect(() => {
    if (isAdmin()) {
      navigate('/admin/dashboard', { replace: true })
    }
  }, [isAdmin, navigate])

  return (
    <div className="min-h-screen bg-background">
      <HKRAHeader showSignOut />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">CPD Requests</h2>
            <p className="text-muted-foreground">Manage your CPD event requests</p>
          </div>
          <Link to="/vendor/request/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Requests</CardTitle>
            <CardDescription>
              View and manage all your CPD request submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorRequestTable data={requests || []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

