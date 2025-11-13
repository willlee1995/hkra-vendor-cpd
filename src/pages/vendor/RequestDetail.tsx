import { useParams, Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorStatusBadge } from '@/components/vendor/VendorStatusBadge'
import { VendorFileUpload } from '@/components/vendor/VendorFileUpload'
import { useVendorRequest, useWithdrawVendorRequest } from '@/hooks/useVendorRequests'
import { ArrowLeft, Edit, Download, Calendar, Mail, Phone, Building } from 'lucide-react'
import { format } from 'date-fns'
import { ThemeToggle } from '@/components/ThemeToggle'

export function RequestDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: request, isLoading } = useVendorRequest(id!)
  const withdrawRequest = useWithdrawVendorRequest()

  const handleWithdraw = async () => {
    if (!id) return
    if (!confirm('Are you sure you want to withdraw this request?')) return

    await withdrawRequest.mutateAsync(id)
    navigate('/vendor/dashboard')
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/vendor/dashboard">
            <Button variant="ghost" size="sm" className="text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{request.event_name}</h1>
            <div className="mt-2">
              <VendorStatusBadge status={request.status} />
            </div>
          </div>
          <div className="flex gap-2">
            {request.status === 'pending' && (
              <>
                <Link to={`/vendor/request/${id}/edit`}>
                  <Button variant="outline">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
                <Button variant="outline" onClick={handleWithdraw} disabled={withdrawRequest.isPending}>
                  Withdraw
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Event Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Event Name</p>
                <p className="text-lg">{request.event_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Start Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p>{format(new Date(request.event_start_date), 'PPP')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">End Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p>{format(new Date(request.event_end_date), 'PPP')}</p>
                  </div>
                </div>
              </div>
              {request.expected_promotion_date && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Expected Promotion Date</p>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <p>{format(new Date(request.expected_promotion_date), 'PPP')}</p>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Expected CPD Points</p>
                <p className="text-lg font-semibold">{request.expected_cpd_points}</p>
              </div>
              {request.poster_file_url && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Event Poster</p>
                  <a
                    href={request.poster_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View Poster
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Company Name</p>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-gray-400" />
                  <p>{request.vendor_company_name}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Contact Name</p>
                <p>{request.contact_name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Contact Email</p>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <a href={`mailto:${request.contact_email}`} className="text-blue-600 hover:underline">
                    {request.contact_email}
                  </a>
                </div>
              </div>
              {request.contact_phone && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Contact Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <a href={`tel:${request.contact_phone}`} className="text-blue-600 hover:underline">
                      {request.contact_phone}
                    </a>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {request.status === 'approved' && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Attendance File Upload</CardTitle>
                <CardDescription>
                  Upload the attendance file for this approved CPD event
                </CardDescription>
              </CardHeader>
              <CardContent>
                {request.attendance_file_url ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <p className="text-sm text-gray-600">
                        Attendance file uploaded on{' '}
                        {request.attendance_uploaded_at
                          ? format(new Date(request.attendance_uploaded_at), 'PPP')
                          : 'N/A'}
                      </p>
                      <a
                        href={request.attendance_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </Button>
                      </a>
                    </div>
                    <VendorFileUpload requestId={request.id} />
                  </div>
                ) : (
                  <VendorFileUpload requestId={request.id} />
                )}
              </CardContent>
            </Card>
          )}

          {request.status === 'rejected' && request.rejection_reason && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Rejection Reason</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{request.rejection_reason}</p>
              </CardContent>
            </Card>
          )}

          {request.admin_notes && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Admin Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700">{request.admin_notes}</p>
              </CardContent>
            </Card>
          )}

          {request.vendor_request_status_history && request.vendor_request_status_history.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {request.vendor_request_status_history.map((history) => (
                    <div key={history.id} className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <VendorStatusBadge status={history.status} />
                          <p className="mt-1 text-sm text-gray-600">
                            {format(new Date(history.created_at), 'PPP p')}
                          </p>
                        </div>
                      </div>
                      {history.notes && (
                        <p className="mt-2 text-sm text-gray-700">{history.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

