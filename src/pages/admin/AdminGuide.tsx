import { Shield, LayoutDashboard, FileText, CheckCircle2, XCircle, Download, Clock, Info } from 'lucide-react'

export function AdminGuide() {
    return (
        <div className="space-y-8 p-8 bg-neutral-background-page">
            <div>
                <h1 className="text-3xl font-semibold text-neutral-ink-strong">Admin Quick Guide</h1>
                <p className="mt-2 text-neutral-ink-medium max-w-2xl">
                    This guide provides a step-by-step overview of how to manage and approve CPD accreditation requests submitted by vendors.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Step 1: Navigation */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                        <LayoutDashboard className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">1. Navigate to Dashboard</h3>
                    <p className="text-neutral-ink-muted">
                        Access the Admin Dashboard to see an overview of all requests. Use the status filters (Pending, Approved, Rejected) to find specific submissions.
                    </p>
                </div>

                {/* Step 2: Review Details */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                        <FileText className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">2. Review Request Details</h3>
                    <p className="text-neutral-ink-muted">
                        Click on a request to view its full details. Carefully review the event name, dates, times, and uploaded materials (posters/agendas).
                    </p>
                </div>

                {/* Step 3: Approval Process */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                        <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">3. Approving a Request</h3>
                    <div className="space-y-2 text-neutral-ink-muted">
                        <p>To approve, you must provide:</p>
                        <ul className="list-inside list-disc space-y-1 ml-2">
                            <li><span className="font-medium text-neutral-ink-strong">Admin Notes:</span> Feedback or internal records.</li>
                            <li><span className="font-medium text-neutral-ink-strong">CPD Points:</span> Between 0.5 and 8.0 points.</li>
                        </ul>
                    </div>
                </div>

                {/* Step 4: Rejection Process */}
                <div className="rounded-xl border border-neutral-border-subtle bg-neutral-background-card p-6 shadow-sm">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400">
                        <XCircle className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-ink-strong">4. Rejecting a Request</h3>
                    <p className="text-neutral-ink-muted">
                        If the request does not meet requirements, use the Reject button. You <span className="font-medium text-neutral-ink-strong">must</span> provide a clear rejection reason, which will be visible to the vendor.
                    </p>
                </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-6">
                <div className="flex items-start gap-4">
                    <div className="mt-1 rounded-full bg-blue-500/10 p-1 text-blue-600 dark:text-blue-400">
                        <Info className="h-5 w-5" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-blue-900 dark:text-blue-100">Post-Event Actions</h4>
                        <p className="mt-1 text-blue-800 dark:text-blue-200">
                            After an event has concluded, vendors may upload attendance records. You can view and download these files from the request detail page to finalize the process.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-center gap-3 rounded-lg border border-neutral-border-subtle bg-neutral-background-card p-4">
                    <Clock className="h-5 w-5 text-neutral-ink-muted" />
                    <span className="text-sm font-medium text-neutral-ink-medium">Unapprove anytime</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-neutral-border-subtle bg-neutral-background-card p-4">
                    <Download className="h-5 w-5 text-neutral-ink-muted" />
                    <span className="text-sm font-medium text-neutral-ink-medium">Download materials</span>
                </div>
                <div className="flex items-center gap-3 rounded-lg border border-neutral-border-subtle bg-neutral-background-card p-4">
                    <Shield className="h-5 w-5 text-neutral-ink-muted" />
                    <span className="text-sm font-medium text-neutral-ink-medium">Secure Admin Access</span>
                </div>
            </div>
        </div>
    )
}
