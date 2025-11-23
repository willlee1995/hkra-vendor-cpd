import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestTable } from '@/components/vendor/VendorRequestTable'
import { useVendorRequests } from '@/hooks/useVendorRequests'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { Plus } from 'lucide-react'

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
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-ink-strong md:text-3xl">CPD Requests</h2>
          <p className="mt-1 text-sm text-neutral-ink-muted">Manage your CPD event requests</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/vendor/request/new">
            <Button className="bg-brand-primary hover:bg-brand-primary-strong text-white shadow-card-soft">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="rounded-md bg-neutral-background-card shadow-card-soft border-none">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-neutral-ink-strong">Your Requests</CardTitle>
            <CardDescription className="text-xs text-neutral-ink-muted">
              View and manage all your CPD request submissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorRequestTable data={requests || []} isLoading={isLoading} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

