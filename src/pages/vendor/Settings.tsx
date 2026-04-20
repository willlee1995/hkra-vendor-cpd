import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { useVendor, useUpdateVendorNotificationEmails } from '@/hooks/useVendor'
import { toast } from 'sonner'

export function Settings() {
    const { user } = useVendorAuth()
    const { data: vendor, isLoading: vendorLoading } = useVendor()
    const updateNotificationEmails = useUpdateVendorNotificationEmails()
    const [companyName, setCompanyName] = useState('')
    const [notificationText, setNotificationText] = useState('')

    useEffect(() => {
        if (vendor?.company_name) {
            setCompanyName(vendor.company_name)
        }
    }, [vendor])

    useEffect(() => {
        const list = vendor?.notification_emails
        if (Array.isArray(list) && list.length > 0) {
            setNotificationText(list.join('\n'))
        } else {
            setNotificationText('')
        }
    }, [vendor])

    return (
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
            <div className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-neutral-ink-strong md:text-3xl">Settings</h2>
                    <p className="mt-1 text-sm text-neutral-ink-muted">Manage your account preferences</p>
                </div>
            </div>

            <div className="grid gap-6 max-w-2xl">
                <Card className="rounded-md bg-neutral-background-card shadow-card-soft border-none">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-neutral-ink-strong">Profile Information</CardTitle>
                        <CardDescription className="text-xs text-neutral-ink-muted">
                            Update your account details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium text-neutral-ink-medium">Email</Label>
                            <Input
                                id="email"
                                value={user?.email || ''}
                                disabled
                                className="bg-neutral-background-alt border-neutral-border-subtle text-neutral-ink-muted"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium text-neutral-ink-medium">Company Name</Label>
                            <Input
                                id="name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                placeholder={vendorLoading ? "Loading..." : "Enter company name"}
                                className="border-neutral-border-subtle focus:border-brand-primary focus:ring-brand-primary"
                            />
                        </div>
                        <div className="pt-2">
                            <Button className="bg-brand-primary hover:bg-brand-primary-strong text-white shadow-card-soft">
                                Save Changes
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-md bg-neutral-background-card shadow-card-soft border-none">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-neutral-ink-strong">Notification recipients</CardTitle>
                        <CardDescription className="text-xs text-neutral-ink-muted">
                            Additional email addresses that receive the same vendor notifications as your request contact email (submission received, approval, rejection, attendance upload, reminders). One address per line or comma-separated. Your login email is unchanged; the contact email on each CPD request is always included when you submit.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="notification-emails" className="text-sm font-medium text-neutral-ink-medium">
                                Extra addresses (optional)
                            </Label>
                            <Textarea
                                id="notification-emails"
                                value={notificationText}
                                onChange={(e) => setNotificationText(e.target.value)}
                                placeholder={vendorLoading ? 'Loading…' : 'colleague@example.com'}
                                rows={5}
                                disabled={vendorLoading || !vendor}
                                className="border-neutral-border-subtle focus:border-brand-primary focus:ring-brand-primary"
                            />
                            <p className="text-xs text-neutral-ink-muted">
                                Up to 25 addresses. Invalid entries are rejected when you save.
                            </p>
                        </div>
                        <Button
                            type="button"
                            className="bg-brand-primary hover:bg-brand-primary-strong text-white shadow-card-soft"
                            disabled={vendorLoading || !vendor || updateNotificationEmails.isPending}
                            onClick={async () => {
                                const parts = notificationText
                                    .split(/[\n,]+/)
                                    .map((s) => s.trim())
                                    .filter(Boolean)
                                try {
                                    await updateNotificationEmails.mutateAsync(parts)
                                    toast.success('Notification recipients saved')
                                } catch (e) {
                                    toast.error(e instanceof Error ? e.message : 'Failed to save')
                                }
                            }}
                        >
                            {updateNotificationEmails.isPending ? 'Saving…' : 'Save notification list'}
                        </Button>
                    </CardContent>
                </Card>

                <Card className="rounded-md bg-neutral-background-card shadow-card-soft border-none">
                    <CardHeader>
                        <CardTitle className="text-sm font-semibold text-neutral-ink-strong">Security</CardTitle>
                        <CardDescription className="text-xs text-neutral-ink-muted">
                            Manage your password and security settings
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button variant="outline" className="border-neutral-border-subtle text-neutral-ink-medium hover:bg-neutral-background-alt">
                            Change Password
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
