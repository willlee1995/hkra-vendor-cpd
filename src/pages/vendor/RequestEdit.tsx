import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestForm } from '@/components/vendor/VendorRequestForm'
import { useVendorRequest, useUpdateVendorRequest } from '@/hooks/useVendorRequests'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { ThemeToggle } from '@/components/ThemeToggle'

export function RequestEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: request, isLoading } = useVendorRequest(id!)
  const updateRequest = useUpdateVendorRequest()

  const handleSubmit = async (values: any) => {
    if (!id) return
    await updateRequest.mutateAsync({ id, input: values })
    navigate(`/vendor/request/${id}`)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading request...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Request not found</p>
          <Link to="/vendor/dashboard">
            <Button className="mt-4">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (request.status !== 'pending') {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to={`/vendor/request/${id}`}>
              <Button variant="ghost" size="sm" className="text-foreground">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Request
              </Button>
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Cannot Edit Request</CardTitle>
              <CardDescription>
                Only pending requests can be edited.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  const initialValues = {
    event_name: request.event_name,
    event_start_date: request.event_start_date ? new Date(request.event_start_date) : undefined,
    event_end_date: request.event_end_date ? new Date(request.event_end_date) : undefined,
    expected_cpd_points: request.expected_cpd_points,
    vendor_company_name: request.vendor_company_name,
    contact_name: request.contact_name,
    contact_email: request.contact_email,
    contact_phone: request.contact_phone,
    poster_file_url: request.poster_file_url,
    expected_promotion_date: request.expected_promotion_date ? new Date(request.expected_promotion_date) : undefined,
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to={`/vendor/request/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Request
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Edit CPD Request</CardTitle>
            <CardDescription>
              Update your CPD request details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorRequestForm
              initialValues={initialValues}
              onSubmit={handleSubmit}
              isLoading={updateRequest.isPending}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

