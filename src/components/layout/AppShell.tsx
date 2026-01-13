import type { ReactNode } from 'react'
import { BrandHeader } from './BrandHeader'
import { Sidebar } from './Sidebar'

interface AppShellProps {
    children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
    return (
        <div className="flex h-screen flex-col overflow-hidden bg-neutral-background-page font-sans text-neutral-ink-medium">
            <BrandHeader />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
