import { useMemo, useState } from 'react'
import { useUsers } from '@/hooks/useUsers'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { getAuthRole, isVendorRole } from '@/lib/authRole'
import type { User } from '@/lib/userTypes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Mail } from 'lucide-react'
import { VendorNotificationEmailsDialog } from '@/components/admin/VendorNotificationEmailsDialog'

function formatEmailsPreview(emails: string[] | undefined, maxLen = 80): string {
  if (!Array.isArray(emails) || emails.length === 0) return '—'
  const joined = emails.join(', ')
  if (joined.length <= maxLen) return joined
  return `${joined.slice(0, maxLen)}…`
}

export function AdminVendorNotifications() {
  usePageTitle('Vendor notifications')
  const { isSuperAdmin } = useVendorAuth()
  const { data: users, isLoading, refetch } = useUsers()
  const [editingUser, setEditingUser] = useState<User | null>(null)

  const vendors = useMemo(() => {
    if (!users) return []
    return users.filter((u) => isVendorRole(getAuthRole(u)))
  }, [users])

  if (!isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <p className="text-muted-foreground">Access denied. Super admin only.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">Vendor notification recipients</h2>
          <p className="mt-1 text-muted-foreground">
            Configure extra email addresses per vendor account. These receive the same CPD notifications as the request
            contact email.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Vendors</CardTitle>
            <CardDescription>One vendor login per row. Edit the additional notification list for each account.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8 text-muted-foreground">Loading…</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Login email</TableHead>
                    <TableHead>Extra notification emails</TableHead>
                    <TableHead className="text-right w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendors.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.vendor_company_name || '—'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-muted-foreground text-sm" title={formatEmailsPreview(user.vendor_notification_emails, 500)}>
                        {formatEmailsPreview(user.vendor_notification_emails)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                          className="gap-1"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!vendors.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        No vendor accounts found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <VendorNotificationEmailsDialog
          user={editingUser}
          open={!!editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null)
          }}
          onSaved={() => refetch()}
        />
      </main>
    </div>
  )
}
