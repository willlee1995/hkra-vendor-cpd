import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { BrandHeader } from '@/components/layout/BrandHeader'

export function VendorLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { signIn } = useVendorAuth()
  const navigate = useNavigate()

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen flex-col bg-neutral-background-page">
        <BrandHeader />
        <div className="flex flex-1 items-center justify-center px-4 py-12">
          <Card className="w-full max-w-md border-none shadow-card-soft bg-neutral-background-card">
            <CardHeader>
              <CardTitle>Configuration Required</CardTitle>
              <CardDescription>Supabase environment variables are not set</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-ink-medium mb-4">
                Please set the following environment variables in your <code>.env</code> file:
              </p>
              <ul className="list-disc list-inside text-sm text-neutral-ink-medium space-y-2 mb-4">
                <li><code>VITE_SUPABASE_URL</code></li>
                <li><code>VITE_SUPABASE_ANON_KEY</code></li>
              </ul>
              <p className="text-sm text-neutral-ink-medium">
                After setting these variables, restart your development server.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn(email, password)
      toast.success('Login successful')

      // Redirect based on user role
      const role = result?.user?.user_metadata?.role
      if (role === 'admin') {
        navigate('/admin/dashboard')
      } else {
        navigate('/vendor/dashboard')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-neutral-background-page">
      <BrandHeader />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md border-none shadow-card-soft bg-neutral-background-card">
          <CardHeader>
            <CardTitle className="text-xl font-semibold text-neutral-ink-strong">Vendor Portal Login</CardTitle>
            <CardDescription className="text-neutral-ink-muted">Sign in to access your CPD request portal</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-neutral-ink-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vendor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  className="border-neutral-border-subtle focus:border-brand-primary focus:ring-brand-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-neutral-ink-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="border-neutral-border-subtle focus:border-brand-primary focus:ring-brand-primary"
                />
              </div>
              <Button type="submit" className="w-full bg-brand-primary hover:bg-brand-primary-strong text-white shadow-card-soft" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

