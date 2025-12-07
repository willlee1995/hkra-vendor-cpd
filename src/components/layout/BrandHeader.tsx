import { Bell, HelpCircle, User, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function BrandHeader() {
  const { signOut, isAdmin } = useVendorAuth()
  const isAdminUser = isAdmin()
  const portalName = isAdminUser ? 'HKRA CPD Admin Portal' : 'Vendor Portal'

  return (
    <header className="bg-brand-primary text-white shadow-card-subtle">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <img
            src="/hkra.webp"
            alt="The Hong Kong Radiographers' Association"
            className="h-10 w-auto bg-white rounded-sm p-0.5"
          />
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-white/80">
              The Hong Kong Radiographers' Association
            </div>
            <div className="text-lg font-semibold leading-tight">
              {portalName}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle
            variant="ghost"
            className="text-white/80 hover:text-white hover:bg-white/10"
          />
          <button className="text-white/80 hover:text-white">
            <HelpCircle className="h-5 w-5" />
          </button>
          <button className="text-white/80 hover:text-white">
            <Bell className="h-5 w-5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary-soft text-xs font-semibold text-brand-primary hover:bg-white transition-colors cursor-pointer">
                <User className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-neutral-background-card border-neutral-border-subtle text-neutral-ink-medium">
              <DropdownMenuItem onClick={() => signOut()} className="text-semantic-danger focus:text-semantic-danger focus:bg-semantic-danger-soft">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
