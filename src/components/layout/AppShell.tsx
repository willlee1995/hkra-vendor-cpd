import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { BrandHeader } from './BrandHeader'
import { MobileNavDrawer } from './MobileNavDrawer'
import { Sidebar, SidebarNavContent } from './Sidebar'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) setMobileNavOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-background-page font-sans text-neutral-ink-medium">
      <BrandHeader onMenuClick={() => setMobileNavOpen(true)} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      <MobileNavDrawer open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SidebarNavContent onNavigate={() => setMobileNavOpen(false)} />
      </MobileNavDrawer>
    </div>
  )
}
