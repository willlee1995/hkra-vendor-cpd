import { LayoutDashboard, FileText, Settings, BookOpen, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useVendorAuth } from '@/hooks/useVendorAuth'

interface SidebarItemProps {
  icon: React.ElementType
  label: string
  to: string
  active?: boolean
  onNavigate?: () => void
}

function SidebarItem({ icon: Icon, label, to, active, onNavigate }: SidebarItemProps) {
  return (
    <Link
      to={to}
      onClick={() => onNavigate?.()}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${active
        ? 'bg-brand-secondary-soft text-brand-secondary'
        : 'text-neutral-ink-medium hover:bg-neutral-background-alt'
        }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 shrink-0" />
        <span>{label}</span>
      </div>
      {active && <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />}
    </Link>
  )
}

export interface SidebarNavContentProps {
  /** Called after a nav link is chosen (e.g. close mobile drawer) */
  onNavigate?: () => void
}

export function SidebarNavContent({ onNavigate }: SidebarNavContentProps) {
  const location = useLocation()
  const path = location.pathname
  const { isAdmin, isVendor } = useVendorAuth()
  const admin = isAdmin()
  const dashboardPath = admin ? '/admin/dashboard' : '/vendor/dashboard'
  const dashboardActive = admin
    ? path === '/admin/dashboard' || path.startsWith('/admin/request/')
    : path === '/vendor/dashboard'

  return (
    <>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
        <SidebarItem
          icon={LayoutDashboard}
          label="Dashboard"
          to={dashboardPath}
          active={dashboardActive}
          onNavigate={onNavigate}
        />
        <SidebarItem
          icon={FileText}
          label="New Request"
          to="/vendor/request/new"
          active={path === '/vendor/request/new'}
          onNavigate={onNavigate}
        />

        {(admin || isVendor()) && (
          <SidebarItem
            icon={BookOpen}
            label="Quick Guide"
            to={admin ? '/admin/guide' : '/vendor/guide'}
            active={path === (admin ? '/admin/guide' : '/vendor/guide')}
            onNavigate={onNavigate}
          />
        )}

        {admin && (
          <SidebarItem
            icon={Users}
            label="Users"
            to="/admin/users"
            active={path === '/admin/users'}
            onNavigate={onNavigate}
          />
        )}
      </nav>
      <div className="shrink-0 border-t border-neutral-border-subtle px-2 py-4">
        <SidebarItem
          icon={Settings}
          label="Settings"
          to="/vendor/settings"
          active={path === '/vendor/settings'}
          onNavigate={onNavigate}
        />
      </div>
    </>
  )
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-full w-60 flex-shrink-0 flex-col border-r border-neutral-border-subtle bg-neutral-background-card md:flex">
      <div className="shrink-0 border-b border-neutral-border-subtle px-4 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-ink-muted">Menu</div>
      </div>
      <SidebarNavContent />
    </aside>
  )
}
