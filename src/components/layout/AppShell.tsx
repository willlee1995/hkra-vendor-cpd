import type { ReactNode } from 'react'
import { BrandHeader } from './BrandHeader'
import { Sidebar } from './Sidebar'

interface AppShellProps {
    children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
    return (
        <div className="flex min-h-screen flex-col bg-neutral-background-page font-sans text-neutral-ink-medium">
            <BrandHeader />
            <div className="flex flex-1">
                <Sidebar />
                <main className="flex-1">
                    {children}
                </main>
            </div>
        </div>
    )
}
