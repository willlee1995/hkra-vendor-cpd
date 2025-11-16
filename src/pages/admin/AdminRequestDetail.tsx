import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorStatusBadge } from '@/components/vendor/VendorStatusBadge'
import { useVendorRequest } from '@/hooks/useVendorRequests'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ArrowLeft, CheckCircle2, XCircle, Calendar, Mail, Phone, Building, Download } from 'lucide-react'
import { format } from 'date-fns'
import { HKRAHeader } from '@/components/vendor/HKRAHeader'
import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { vendorApiClient } from '@/lib/vendorApiClient'
import { getDisplayableUrl, normalizeStorageUrl } from '@/lib/storageUtils'

export function AdminRequestDetail() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { data: request, isLoading } = useVendorRequest(id!)
    const { isAdmin } = useVendorAuth()
    const [isProcessing, setIsProcessing] = useState(false)
    const [adminNotes, setAdminNotes] = useState('')
    const [rejectionReason, setRejectionReason] = useState('')
    const [cpdPoints, setCpdPoints] = useState<string>('')
    const [posterUrls, setPosterUrls] = useState<string[]>([])

    // Set page title for admin
    usePageTitle('HKRA CPD Admin Portal')

    // Get signed URLs for posters if available
    useEffect(() => {
        const updatePosterUrls = async () => {
            if (!request?.poster_file_url || (Array.isArray(request.poster_file_url) && request.poster_file_url.length === 0)) {
                setPosterUrls([])
                return
            }

            const urls = Array.isArray(request.poster_file_url) ? request.poster_file_url : [request.poster_file_url]

            try {
                const displayableUrls = await Promise.all(
                    urls.map(url => getDisplayableUrl(url, 'vendor-posters'))
                )
                setPosterUrls(displayableUrls)
            } catch {
                setPosterUrls(urls.map(url => normalizeStorageUrl(url)))
            }
        }

        updatePosterUrls()
    }, [request?.poster_file_url])

    const handleApprove = async () => {
        if (!id || !isAdmin()) return

        if (!adminNotes.trim()) {
            toast.error('Please provide admin notes before approving')
            return
        }

        const cpdPointsNum = parseFloat(cpdPoints)
        if (!cpdPoints || isNaN(cpdPointsNum) || cpdPointsNum < 0.5 || cpdPointsNum > 8.0) {
            toast.error('Please provide valid CPD points (0.5 - 8.0)')
            return
        }

        setIsProcessing(true)
        try {
            await vendorApiClient.updateRequest(id, {
                status: 'approved',
                admin_notes: adminNotes,
                expected_cpd_points: cpdPointsNum,
            })
            toast.success('Request approved successfully')
            navigate('/admin/dashboard')
        } catch (error: any) {
            toast.error(error.message || 'Failed to approve request')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleReject = async () => {
        if (!id || !isAdmin()) return

        if (!rejectionReason.trim()) {
            toast.error('Please provide a rejection reason')
            return
        }

        setIsProcessing(true)
        try {
            await vendorApiClient.updateRequest(id, {
                status: 'rejected',
                rejection_reason: rejectionReason,
            })
            toast.success('Request rejected')
            navigate('/admin/dashboard')
        } catch (error: any) {
            toast.error(error.message || 'Failed to reject request')
        } finally {
            setIsProcessing(false)
        }
    }

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
                    <Button className="mt-4" onClick={() => navigate('/admin/dashboard')}>
                        Back to Dashboard
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <HKRAHeader showSignOut />
            <div className="container mx-auto px-4 py-4 border-b">
                <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dashboard')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Dashboard
                </Button>
            </div>

            <main className="container mx-auto px-4 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">{request.event_name}</h1>
                        <div className="mt-2">
                            <VendorStatusBadge status={request.status} />
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Event Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Event Name</p>
                                <p className="text-lg">{request.event_name}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Start Date</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <p>{format(new Date(request.event_start_date), 'PPP')}</p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">End Date</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <p>{format(new Date(request.event_end_date), 'PPP')}</p>
                                    </div>
                                </div>
                            </div>
                            {request.expected_promotion_date && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Expected Promotion Date</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <p>{format(new Date(request.expected_promotion_date), 'PPP')}</p>
                                    </div>
                                </div>
                            )}
                            {request.expected_cpd_points && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">CPD Points</p>
                                    <p className="text-lg font-semibold">{request.expected_cpd_points}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Event Related Materials Card */}
                    {posterUrls.length > 0 && (
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Event Related Materials</CardTitle>
                                <CardDescription>Materials uploaded for this CPD event</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {posterUrls.map((url, index) => (
                                        <div key={index} className="space-y-2">
                                            <div className="flex justify-center">
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block"
                                                >
                                                    <img
                                                        src={url}
                                                        alt={`Material ${index + 1} for ${request.event_name}`}
                                                        className="max-w-full max-h-96 rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer object-contain"
                                                        onError={(e) => {
                                                            // Fallback if image fails to load
                                                            const target = e.target as HTMLImageElement
                                                            const parent = target.parentElement?.parentElement
                                                            if (parent) {
                                                                parent.innerHTML = `
                                  <div class="p-8 border rounded-lg bg-muted text-center">
                                    <p class="text-sm text-muted-foreground mb-4">File ${index + 1} could not be loaded</p>
                                    <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline inline-flex items-center gap-2">
                                      <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                      </svg>
                                      Open File ${index + 1}
                                    </a>
                                  </div>
                                `
                                                            }
                                                        }}
                                                    />
                                                </a>
                                            </div>
                                            <div className="flex justify-center">
                                                <a
                                                    href={url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <Button variant="outline">
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download File {index + 1}
                                                    </Button>
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Zoom Webinar ID Card */}
                    {request.zoom_webinar_id && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Zoom Webinar ID</CardTitle>
                                <CardDescription>Webinar ID for online event</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <p className="text-lg font-mono">{request.zoom_webinar_id}</p>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Company Name</p>
                                <div className="flex items-center gap-2">
                                    <Building className="h-4 w-4 text-muted-foreground" />
                                    <p>{request.vendor_company_name}</p>
                                </div>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Contact Name</p>
                                <p>{request.contact_name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">Contact Email</p>
                                <div className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <a href={`mailto:${request.contact_email}`} className="text-primary hover:underline">
                                        {request.contact_email}
                                    </a>
                                </div>
                            </div>
                            {request.contact_phone && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Contact Phone</p>
                                    <div className="flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-muted-foreground" />
                                        <a href={`tel:${request.contact_phone}`} className="text-primary hover:underline">
                                            {request.contact_phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Admin Actions */}
                    {request.status === 'pending' && (
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Admin Actions</CardTitle>
                                <CardDescription>Approve or reject this CPD request</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="admin-notes">Admin Notes (Required for approval)</Label>
                                    <Textarea
                                        id="admin-notes"
                                        placeholder="Enter notes about this approval..."
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        className="mt-2"
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="cpd-points">CPD Points (Required for approval)</Label>
                                    <Input
                                        id="cpd-points"
                                        type="number"
                                        step="0.5"
                                        min="0.5"
                                        max="8.0"
                                        placeholder="e.g., 1.0, 2.5, 4.0"
                                        value={cpdPoints}
                                        onChange={(e) => setCpdPoints(e.target.value)}
                                        className="mt-2"
                                    />
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Enter CPD points to be awarded (0.5 - 8.0)
                                    </p>
                                </div>
                                <div>
                                    <Label htmlFor="rejection-reason">Rejection Reason (Required for rejection)</Label>
                                    <Textarea
                                        id="rejection-reason"
                                        placeholder="Enter reason for rejection..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        className="mt-2"
                                        rows={3}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleApprove}
                                        disabled={isProcessing}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Approve Request
                                    </Button>
                                    <Button
                                        onClick={handleReject}
                                        disabled={isProcessing}
                                        variant="destructive"
                                    >
                                        <XCircle className="mr-2 h-4 w-4" />
                                        Reject Request
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {request.status === 'rejected' && request.rejection_reason && (
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Rejection Reason</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground">{request.rejection_reason}</p>
                            </CardContent>
                        </Card>
                    )}

                    {request.admin_notes && (
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Admin Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground">{request.admin_notes}</p>
                            </CardContent>
                        </Card>
                    )}

                    {request.attendance_file_url && (
                        <Card className="md:col-span-2">
                            <CardHeader>
                                <CardTitle>Attendance File</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-4">
                                    <p className="text-sm text-muted-foreground">
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
                            </CardContent>
                        </Card>
                    )}
                </div>
            </main>
        </div>
    )
}

