import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorStatusBadge } from '@/components/vendor/VendorStatusBadge'
import { useVendorRequest } from '@/hooks/useVendorRequests'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ArrowLeft, CheckCircle2, XCircle, Calendar, Mail, Phone, Building, Download, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'

import { useState, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { vendorApiClient } from '@/lib/vendorApiClient'
import { getDisplayableUrl, normalizeStorageUrl, extractStoragePath, getSignedUrl } from '@/lib/storageUtils'

// Helper function to format time (HH:MM) to 12-hour format
const formatTime = (time: string | null | undefined): string => {
    if (!time) return ''
    try {
        const [hours, minutes] = time.split(':')
        const hour = parseInt(hours, 10)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const displayHour = hour % 12 || 12
        return `${displayHour}:${minutes} ${ampm}`
    } catch {
        return time
    }
}

// Helper function to calculate duration between start and end date/time
const calculateDuration = (
    startDate: string,
    endDate: string,
    startTime?: string | null,
    endTime?: string | null
): string => {
    try {
        // Parse dates
        const start = new Date(startDate)
        const end = new Date(endDate)

        // If times are provided, combine date and time
        if (startTime) {
            const [startHours, startMinutes] = startTime.split(':').map(Number)
            start.setHours(startHours, startMinutes, 0, 0)
        }

        if (endTime) {
            const [endHours, endMinutes] = endTime.split(':').map(Number)
            end.setHours(endHours, endMinutes, 0, 0)
        }

        // Calculate difference in milliseconds
        const diffMs = end.getTime() - start.getTime()

        if (diffMs < 0) {
            return 'Invalid duration'
        }

        // Convert to hours and minutes
        const totalMinutes = Math.floor(diffMs / (1000 * 60))
        const hours = Math.floor(totalMinutes / 60)
        const minutes = totalMinutes % 60

        // Format duration
        if (hours === 0) {
            return `${minutes} minute${minutes !== 1 ? 's' : ''}`
        } else if (minutes === 0) {
            return `${hours} hour${hours !== 1 ? 's' : ''}`
        } else {
            return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`
        }
    } catch (error) {
        console.error('Error calculating duration:', error)
        return 'Unable to calculate'
    }
}

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

    const handleUnapprove = async () => {
        if (!id || !isAdmin()) return

        if (!confirm('Are you sure you want to unapprove this request? The requestor will be notified.')) {
            return
        }

        setIsProcessing(true)
        try {
            await vendorApiClient.updateRequest(id, {
                status: 'pending',
                admin_notes: adminNotes || 'Request unapproved and returned to pending status for further review.',
            })
            toast.success('Request unapproved successfully')
            navigate('/admin/dashboard')
        } catch (error: any) {
            toast.error(error.message || 'Failed to unapprove request')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleUnreject = async () => {
        if (!id || !isAdmin()) return

        if (!confirm('Are you sure you want to unreject and approve this request? The requestor will be notified.')) {
            return
        }

        // Check if CPD points are set (required for approval)
        const cpdPointsNum = cpdPoints ? parseFloat(cpdPoints) : null
        if (!cpdPointsNum || isNaN(cpdPointsNum) || cpdPointsNum < 0.5 || cpdPointsNum > 8.0) {
            toast.error('Please provide valid CPD points (0.5 - 8.0) before approving')
            return
        }

        setIsProcessing(true)
        try {
            await vendorApiClient.updateRequest(id, {
                status: 'approved',
                admin_notes: adminNotes || 'Request unrejected and approved.',
                rejection_reason: undefined,
                expected_cpd_points: cpdPointsNum,
            })
            toast.success('Request unrejected and approved successfully')
            navigate('/admin/dashboard')
        } catch (error: any) {
            toast.error(error.message || 'Failed to unreject and approve request')
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
            {/* HKRAHeader removed - using BrandHeader via AppShell */}
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

                <div className="grid gap-6">
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
                                        <p>
                                            {format(new Date(request.event_start_date), 'PPP')}
                                            {request.event_start_time && (
                                                <span className="ml-2 text-muted-foreground">• {formatTime(request.event_start_time)}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">End Date</p>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        <p>
                                            {format(new Date(request.event_end_date), 'PPP')}
                                            {request.event_end_time && (
                                                <span className="ml-2 text-muted-foreground">• {formatTime(request.event_end_time)}</span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {request.event_start_time && request.event_end_time && (
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">Duration</p>
                                    <p className="text-lg font-semibold text-primary">
                                        {calculateDuration(
                                            request.event_start_date,
                                            request.event_end_date,
                                            request.event_start_time,
                                            request.event_end_time
                                        )}
                                    </p>
                                </div>
                            )}
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
                        <Card>
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
                        <Card>
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

                    {request.status === 'approved' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Admin Actions</CardTitle>
                                <CardDescription>Unapprove this request to return it to pending status</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <Label htmlFor="unapprove-notes">Admin Notes (Optional)</Label>
                                    <Textarea
                                        id="unapprove-notes"
                                        placeholder="Enter notes about why this request is being unapproved..."
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        className="mt-2"
                                        rows={3}
                                    />
                                </div>
                                <Button
                                    onClick={handleUnapprove}
                                    disabled={isProcessing}
                                    variant="outline"
                                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" />
                                    Unapprove Request
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {request.status === 'rejected' && (
                        <>
                            {request.rejection_reason && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Rejection Reason</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-foreground">{request.rejection_reason}</p>
                                    </CardContent>
                                </Card>
                            )}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Admin Actions</CardTitle>
                                    <CardDescription>Unreject and approve this request</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="unreject-notes">Admin Notes (Optional)</Label>
                                        <Textarea
                                            id="unreject-notes"
                                            placeholder="Enter notes about this approval..."
                                            value={adminNotes}
                                            onChange={(e) => setAdminNotes(e.target.value)}
                                            className="mt-2"
                                            rows={3}
                                        />
                                    </div>
                                    <div>
                                        <Label htmlFor="unreject-cpd-points">CPD Points (Required)</Label>
                                        <Input
                                            id="unreject-cpd-points"
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
                                    <Button
                                        onClick={handleUnreject}
                                        disabled={isProcessing}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Unreject and Approve Request
                                    </Button>
                                </CardContent>
                            </Card>
                        </>
                    )}

                    {request.admin_notes && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Admin Notes</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-foreground">{request.admin_notes}</p>
                            </CardContent>
                        </Card>
                    )}

                    {(() => {
                        // Normalize attendance_file_url to always be an array (handle migration from string to array)
                        const attendanceFiles = Array.isArray(request.attendance_file_url)
                            ? request.attendance_file_url
                            : request.attendance_file_url
                                ? [request.attendance_file_url]
                                : []

                        return attendanceFiles.length > 0 ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Attendance Files</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground">
                                            {attendanceFiles.length} attendance file{attendanceFiles.length > 1 ? 's' : ''} uploaded on{' '}
                                            {request.attendance_uploaded_at
                                                ? format(new Date(request.attendance_uploaded_at), 'PPP')
                                                : 'N/A'}
                                        </p>
                                        <div className="space-y-2">
                                            {attendanceFiles.map((url, index) => (
                                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                                    <span className="text-sm text-muted-foreground flex-1">
                                                        File {index + 1}
                                                    </span>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={async () => {
                                                            if (!url) return
                                                            try {
                                                                // Extract path from URL and generate signed URL if needed
                                                                const path = extractStoragePath(url, 'vendor-attendance')
                                                                if (path) {
                                                                    const signedUrl = await getSignedUrl('vendor-attendance', path, 3600)
                                                                    if (signedUrl) {
                                                                        window.open(normalizeStorageUrl(signedUrl), '_blank', 'noopener,noreferrer')
                                                                    } else {
                                                                        // Fallback to normalized URL
                                                                        window.open(normalizeStorageUrl(url), '_blank', 'noopener,noreferrer')
                                                                    }
                                                                } else {
                                                                    // Fallback to normalized URL
                                                                    window.open(normalizeStorageUrl(url), '_blank', 'noopener,noreferrer')
                                                                }
                                                            } catch (error) {
                                                                console.error('Error downloading file:', error)
                                                                toast.error('Failed to download file')
                                                            }
                                                        }}
                                                    >
                                                        <Download className="mr-2 h-4 w-4" />
                                                        Download
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : null
                    })()}
                </div>
            </main>
        </div>
    )
}

