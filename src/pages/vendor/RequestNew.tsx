import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VendorRequestForm } from '@/components/vendor/VendorRequestForm'
import { useCreateVendorRequest } from '@/hooks/useVendorRequests'
import { useVendor } from '@/hooks/useVendor'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '@/components/ThemeToggle'

export function RequestNew() {
  const navigate = useNavigate()
  const createRequest = useCreateVendorRequest()
  const { data: vendor, isLoading: vendorLoading } = useVendor()

  const handleSubmit = async (values: any) => {
    try {
      await createRequest.mutateAsync(values)
      navigate('/vendor/dashboard')
    } catch (error: any) {
      // Error is already handled by the mutation's onError callback
      // But we can add additional handling here if needed
      console.error('Submit error:', error)
    }
  }

  // Prepare initial values from vendor data
  const initialValues = vendor ? {
    vendor_company_name: vendor.company_name || '',
    contact_name: vendor.contact_name || '',
    contact_email: vendor.contact_email || '',
    contact_phone: vendor.contact_phone || '',
  } : undefined

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
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle>Create New CPD Request</CardTitle>
            <CardDescription>
              Submit a new CPD request for your event
            </CardDescription>
          </CardHeader>
          <CardContent>
            {vendorLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto"></div>
                  <p className="text-muted-foreground">Loading vendor information...</p>
                </div>
              </div>
            ) : (
              <VendorRequestForm
                onSubmit={handleSubmit}
                isLoading={createRequest.isPending}
                initialValues={initialValues}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

