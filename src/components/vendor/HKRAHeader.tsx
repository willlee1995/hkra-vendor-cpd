import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { LogOut } from 'lucide-react'

interface HKRAHeaderProps {
  showSignOut?: boolean
}

export function HKRAHeader({ showSignOut = false }: HKRAHeaderProps) {
  const { signOut, isAdmin } = useVendorAuth()
  const isAdminUser = isAdmin()
  const portalName = isAdminUser ? 'HKRA CPD Admin Portal' : 'Vendor Portal'
  const dashboardPath = isAdminUser ? '/admin/dashboard' : '/vendor/dashboard'

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to={dashboardPath} className="flex items-center gap-3">
            <img
              src="/hkra.webp"
              alt="The Hong Kong Radiographers' Association"
              className="h-10 w-auto"
            />
            <div className="flex flex-col">
              <span className="text-lg font-bold text-foreground leading-tight">
                The Hong Kong Radiographers' Association
              </span>
              <span className="text-xs text-muted-foreground leading-tight">
                {portalName}
              </span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {showSignOut && (
            <Button
              variant="outline"
              onClick={() => signOut()}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

