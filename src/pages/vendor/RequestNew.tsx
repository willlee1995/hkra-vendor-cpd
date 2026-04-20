import { useId, useMemo, useState, type ComponentProps } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { VendorRequestForm } from '@/components/vendor/VendorRequestForm'
import { useCreateVendorRequest, useVendorRequests } from '@/hooks/useVendorRequests'
import { useVendor, useAdminVendorsList } from '@/hooks/useVendor'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { CreateVendorRequestInput, UpdateVendorRequestInput, VendorRequest } from '@/lib/vendorTypes'

/** Vendor row from admin list / profile (compatible with vendorTypes.Vendor). */
type VendorRow = {
  company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string | null
}

type AdminNewRequestInitialValues = Omit<
  Partial<CreateVendorRequestInput>,
  'event_start_date' | 'event_end_date' | 'expected_promotion_date'
> & {
  event_start_date?: Date
  event_end_date?: Date
  expected_promotion_date?: Date
  event_start_time?: string
  event_end_time?: string
}

/** Parse YYYY-MM-DD from API as local calendar date (avoids UTC shift). */
function parseLocalDateFromApi(iso: string | undefined | null): Date | undefined {
  if (!iso || typeof iso !== 'string') return undefined
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!m) return undefined
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function lastSubmissionToFormInitialValues(req: VendorRequest, vendor: VendorRow): AdminNewRequestInitialValues {
  return {
    event_name: req.event_name,
    event_start_date: parseLocalDateFromApi(req.event_start_date),
    event_end_date: parseLocalDateFromApi(req.event_end_date),
    event_start_time: req.event_start_time ?? '',
    event_end_time: req.event_end_time ?? '',
    vendor_company_name: req.vendor_company_name || vendor.company_name || '',
    contact_name: req.contact_name || vendor.contact_name || '',
    contact_email: req.contact_email || vendor.contact_email || '',
    contact_phone: req.contact_phone || vendor.contact_phone || '',
    poster_file_url: Array.isArray(req.poster_file_url) ? req.poster_file_url : [],
    zoom_webinar_id: req.zoom_webinar_id || '',
    on24_key: req.on24_key || '',
    on24_id: req.on24_id || '',
    expected_promotion_date: parseLocalDateFromApi(req.expected_promotion_date),
  }
}

export function RequestNew() {
  const navigate = useNavigate()
  const createRequest = useCreateVendorRequest()
  const { isAdmin } = useVendorAuth()
  const { data: vendor, isLoading: vendorLoading } = useVendor({ enabled: !isAdmin() })
  const { data: vendors, isLoading: vendorsLoading } = useAdminVendorsList({
    enabled: isAdmin(),
  })
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const adminVendorFieldId = useId()

  const dashboardPath = isAdmin() ? '/admin/dashboard' : '/vendor/dashboard'

  const selectedVendor = useMemo(
    () => vendors?.find((v) => v.id === selectedVendorId),
    [vendors, selectedVendorId]
  )

  const { data: templateRows, isLoading: templateLoading, isError: templateError } = useVendorRequests(
    { vendor_id: selectedVendorId },
    { enabled: isAdmin() && !!selectedVendorId }
  )

  const initialValues = useMemo(() => {
    if (isAdmin()) {
      if (!selectedVendor) return undefined
      const last = templateError ? undefined : templateRows?.[0]
      if (last) {
        return lastSubmissionToFormInitialValues(last, selectedVendor)
      }
      return {
        vendor_company_name: selectedVendor.company_name || '',
        contact_name: selectedVendor.contact_name || '',
        contact_email: selectedVendor.contact_email || '',
        contact_phone: selectedVendor.contact_phone ?? '',
      }
    }
    return vendor
      ? {
          vendor_company_name: vendor.company_name || '',
          contact_name: vendor.contact_name || '',
          contact_email: vendor.contact_email || '',
          contact_phone: vendor.contact_phone || '',
        }
      : undefined
  }, [isAdmin, selectedVendor, vendor, templateRows, templateError])

  const handleSubmit = async (values: CreateVendorRequestInput | UpdateVendorRequestInput) => {
    if (isAdmin()) {
      if (!selectedVendorId) {
        toast.error('Please select the vendor this request belongs to.')
        return
      }
    }

    const payload = values as CreateVendorRequestInput

    try {
      await createRequest.mutateAsync({
        ...payload,
        ...(isAdmin() ? { vendor_id: selectedVendorId } : {}),
      })
      navigate(dashboardPath)
    } catch (error: unknown) {
      console.error('Submit error:', error)
    }
  }

  const loading = isAdmin() ? vendorsLoading : vendorLoading

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto border-b px-4 py-4">
        <Link to={dashboardPath}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <main className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-3xl">
          <CardHeader>
            <CardTitle>Create New CPD Request</CardTitle>
            <CardDescription>
              {isAdmin()
                ? 'Create a request on behalf of a vendor. Select the vendor, then complete the event details.'
                : 'Submit a new CPD request for your event'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
                  <p className="text-muted-foreground">
                    {isAdmin() ? 'Loading vendors…' : 'Loading vendor information…'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {isAdmin() && (
                  <div className="space-y-2">
                    <Label htmlFor={adminVendorFieldId}>Vendor (required)</Label>
                    <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
                      <SelectTrigger id={adminVendorFieldId} className="w-full">
                        <SelectValue placeholder="Select a vendor company" />
                      </SelectTrigger>
                      <SelectContent>
                        {(vendors ?? []).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.company_name}
                            {v.contact_email ? ` — ${v.contact_email}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!vendors?.length && (
                      <p className="text-sm text-muted-foreground">
                        No vendor companies found. Add vendor users under User Management first.
                      </p>
                    )}
                  </div>
                )}

                {isAdmin() && selectedVendorId && templateLoading && (
                  <p className="text-sm text-muted-foreground">Loading last submission for template…</p>
                )}

                {(!isAdmin() || selectedVendorId) &&
                  !(isAdmin() && selectedVendorId && templateLoading) &&
                  initialValues && (
                  <VendorRequestForm
                    key={isAdmin() ? selectedVendorId : 'vendor'}
                    onSubmit={handleSubmit}
                    isLoading={createRequest.isPending}
                    initialValues={
                      initialValues as ComponentProps<typeof VendorRequestForm>['initialValues']
                    }
                    posterUploadVendorId={isAdmin() ? selectedVendorId : undefined}
                  />
                )}

                {isAdmin() && !selectedVendorId && vendors && vendors.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Select a vendor to show the request form.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
