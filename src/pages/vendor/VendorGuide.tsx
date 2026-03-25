import { Plus, FileText, Edit, Upload, LayoutDashboard, CheckCircle2, Clock, Info } from 'lucide-react'

export function VendorGuide() {
    return (
        <div className="space-y-8 p-8 bg-neutral-background-page">
            <div>
                <h1 className="text-3xl font-semibold text-neutral-ink-strong">Vendor Quick Guide</h1>
                <p className="mt-2 text-neutral-ink-medium max-w-2xl">
                    Welcome to the HKRA CPD Vendor Portal. Follow this guide to manage your CPD accreditation requests efficiently.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Step 1: Dashboard */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                        <LayoutDashboard className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">1. Dashboard Overview</h3>
                    <p className="text-neutral-ink-muted">
                        Your dashboard shows all submitted requests and their current status. Track progress at a glance and use filters to find specific events.
                    </p>
                </div>

                {/* Step 2: New Request */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                        <Plus className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">2. Submit a New Request</h3>
                    <p className="text-neutral-ink-muted">
                        Click "New Request" to start. Fill in event details, including dates, times, and contact information. You can also upload event materials like posters or agendas.
                    </p>
                </div>

                {/* Step 3: Monitor & Edit */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                        <Edit className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">3. Monitor and Edit</h3>
                    <p className="text-neutral-ink-muted">
                        While a request is <span className="font-medium text-neutral-ink-strong">Pending</span> or <span className="font-medium text-neutral-ink-strong">Rejected</span>, you can edit its details or withdraw it if plans change.
                    </p>
                </div>

                {/* Step 4: Post-Event */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                        <Upload className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">4. Attendance Upload</h3>
                    <p className="text-neutral-ink-muted">
                        Once an event is <span className="font-medium text-neutral-ink-strong">Approved</span> and completed, return to the request details page to upload the attendance record files.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-6">
                <div className="flex items-start gap-4">
                    <div className="mt-1 rounded-full bg-blue-500/10 p-1 text-blue-600 dark:text-blue-400">
                        <Info className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100">Review Process</h4>
                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                            HKRA admins will review your request. If approved, you'll see the assigned CPD points. If rejected, a reason will be provided so you can make necessary adjustments and re-submit.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-neutral-border-subtle bg-neutral-background-card p-4">
                    <CheckCircle2 className="h-5 w-5 text-neutral-ink-muted" />
                    <span className="text-sm font-medium text-neutral-ink-medium">Track approvals</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-neutral-border-subtle bg-neutral-background-card p-4">
                    <FileText className="h-5 w-5 text-neutral-ink-muted" />
                    <span className="text-sm font-medium text-neutral-ink-medium">Archive requests</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-neutral-border-subtle bg-neutral-background-card p-4">
                    <Clock className="h-5 w-5 text-neutral-ink-muted" />
                    <span className="text-sm font-medium text-neutral-ink-medium">Instant history</span>
                </div>
            </div>
        </div>
    )
}
