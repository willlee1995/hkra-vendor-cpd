import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestForm } from '@/components/vendor/VendorRequestForm'
import { useVendorRequest, useUpdateVendorRequest } from '@/hooks/useVendorRequests'
import { useVendor } from '@/hooks/useVendor'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'


export function RequestEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: request, isLoading } = useVendorRequest(id!)
  const { data: vendor } = useVendor()
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

  if (request.status !== 'pending' && request.status !== 'rejected') {
    return (
      <div className="min-h-screen bg-background">
        {/* HKRAHeader removed - using BrandHeader via AppShell */}
        <div className="container mx-auto px-4 py-4 border-b">
          <Link to={`/vendor/request/${id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Request
            </Button>
          </Link>
        </div>
        <main className="container mx-auto px-4 py-8">
          <Card className="max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle>Cannot Edit Request</CardTitle>
              <CardDescription>
                Only pending or rejected requests can be edited.
              </CardDescription>
            </CardHeader>
          </Card>
        </main>
      </div>
    )
  }

  const initialValues = {
    event_name: request.event_name,
    event_start_date: request.event_start_date ? new Date(request.event_start_date + 'T00:00:00') : undefined,
    event_end_date: request.event_end_date ? new Date(request.event_end_date + 'T00:00:00') : undefined,
    event_start_time: request.event_start_time || '',
    event_end_time: request.event_end_time || '',
    vendor_company_name: request.vendor_company_name,
    contact_name: request.contact_name,
    contact_email: request.contact_email,
    contact_phone: request.contact_phone,
    poster_file_url: Array.isArray(request.poster_file_url)
      ? request.poster_file_url
      : request.poster_file_url
        ? [request.poster_file_url]
        : [],
    zoom_webinar_id: request.zoom_webinar_id,
    zoom_template_webinar_id: request.zoom_template_webinar_id ?? undefined,
    zoom_template_kind: request.zoom_template_kind ?? undefined,
    on24_key: request.on24_key,
    on24_id: request.on24_id,
    expected_promotion_date: request.expected_promotion_date ? new Date(request.expected_promotion_date + 'T00:00:00') : undefined,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* HKRAHeader removed - using BrandHeader via AppShell */}
      <div className="container mx-auto px-4 py-4 border-b">
        <Link to={`/vendor/request/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Request
          </Button>
        </Link>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Edit CPD Request</CardTitle>
            <CardDescription>
              Update your CPD request details
            </CardDescription>
            {request.status === 'rejected' && (
              <div className="mt-4 rounded-md bg-amber-50 p-4 border border-amber-200">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">Resubmitting Request</h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>
                        This request was previously rejected. Saving your changes will automatically resubmit it to the HKRA admin for review.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <VendorRequestForm
              initialValues={initialValues as any}
              onSubmit={handleSubmit}
              isLoading={updateRequest.isPending}
              hideManualZoomField={Boolean(vendor?.zoom_webinar_auto_create)}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

