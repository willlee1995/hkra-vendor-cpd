import { LayoutDashboard, FileText, Settings } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

interface SidebarItemProps {
    icon: React.ElementType
    label: string
    to: string
    active?: boolean
}

function SidebarItem({ icon: Icon, label, to, active }: SidebarItemProps) {
    return (
        <Link
            to={to}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${active
                ? 'bg-brand-secondary-soft text-brand-secondary'
                : 'text-neutral-ink-medium hover:bg-neutral-background-alt'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
            </div>
            {active && (
                <div className="h-1.5 w-1.5 rounded-full bg-brand-secondary" />
            )}
        </Link>
    )
}

export function Sidebar() {
    const location = useLocation()
    const path = location.pathname

    return (
        <aside className="sticky top-0 hidden h-full w-60 flex-shrink-0 flex-col border-r border-neutral-border-subtle bg-neutral-background-card md:flex">
            <div className="border-b border-neutral-border-subtle px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-neutral-ink-muted">
                    Menu
                </div>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-4">
                <SidebarItem
                    icon={LayoutDashboard}
                    label="Dashboard"
                    to="/vendor/dashboard"
                    active={path === '/vendor/dashboard'}
                />
                <SidebarItem
                    icon={FileText}
                    label="New Request"
                    to="/vendor/request/new"
                    active={path === '/vendor/request/new'}
                />
                {/* Add more items as needed */}
            </nav>
            <div className="border-t border-neutral-border-subtle px-2 py-4">
                <SidebarItem
                    icon={Settings}
                    label="Settings"
                    to="/vendor/settings"
                    active={path === '/vendor/settings'}
                />
            </div>
        </aside>
    )
}
