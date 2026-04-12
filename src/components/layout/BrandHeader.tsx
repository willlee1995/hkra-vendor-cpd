import { Bell, HelpCircle, Menu, User, LogOut } from 'lucide-react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface BrandHeaderProps {
  onMenuClick?: () => void
}

export function BrandHeader({ onMenuClick }: BrandHeaderProps) {
  const { signOut, isAdmin } = useVendorAuth()
  const isAdminUser = isAdmin()
  const portalName = isAdminUser ? 'HKRA CPD Admin Portal' : 'Vendor Portal'

  return (
    <header className="shrink-0 bg-brand-primary text-white shadow-card-subtle">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white/90 hover:bg-white/10 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </button>
          )}
          <img
            src="/hkra.webp"
            alt="The Hong Kong Radiographers' Association"
            className="h-10 w-auto bg-white rounded-sm p-0.5"
          />
          <div className="min-w-0">
            <div className="truncate text-[10px] font-medium uppercase tracking-wide text-white/80 sm:text-xs">
              The Hong Kong Radiographers' Association
            </div>
            <div className="truncate text-base font-semibold leading-tight sm:text-lg">
              {portalName}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-4">
          <ThemeToggle
            variant="ghost"
            className="text-white/80 hover:bg-white/10 hover:text-white"
          />
          <button
            type="button"
            className="hidden text-white/80 hover:text-white sm:inline-flex"
            aria-label="Help"
          >
            <HelpCircle className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="hidden text-white/80 hover:text-white sm:inline-flex"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand-primary-soft text-xs font-semibold text-brand-primary transition-colors hover:bg-white"
              >
                <User className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-neutral-border-subtle text-popover-foreground">
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
