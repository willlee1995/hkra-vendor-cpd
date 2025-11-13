import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestTable } from '@/components/vendor/VendorRequestTable'
import { useVendorRequests } from '@/hooks/useVendorRequests'
import { Plus } from 'lucide-react'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { ThemeToggle } from '@/components/ThemeToggle'

export function Dashboard() {
  const { data: requests, isLoading } = useVendorRequests()
  const { signOut } = useVendorAuth()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-foreground">Vendor Portal</h1>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button variant="outline" onClick={() => signOut()} className="text-foreground">
              Sign Out
            </Button>
          </div>
        </div>
      </header>

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

