import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { User } from '@/lib/userTypes'
import { useUpdateVendorNotificationEmailsAdmin } from '@/hooks/useUsers'

interface VendorNotificationEmailsDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful save (e.g. refetch list) */
  onSaved?: () => void
}

export function VendorNotificationEmailsDialog({
  user,
  open,
  onOpenChange,
  onSaved,
}: VendorNotificationEmailsDialogProps) {
  const [text, setText] = useState('')
  const updateVendorNotifications = useUpdateVendorNotificationEmailsAdmin()

  useEffect(() => {
    if (!open || !user) {
      if (!open) setText('')
      return
    }
    const list = user.vendor_notification_emails
    setText(Array.isArray(list) && list.length > 0 ? list.join('\n') : '')
  }, [open, user])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Vendor notification recipients</DialogTitle>
          <DialogDescription>
            Additional addresses that receive CPD emails (submission, approval, attendance, reminders) for{' '}
            <span className="font-medium text-foreground">{user?.email}</span>
            {user?.vendor_company_name ? (
              <> ({user.vendor_company_name})</>
            ) : null}
            . One per line or comma-separated (max 25). The contact email on each request is always included when
            notifications are sent.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="vendor-notify-emails">Email addresses</Label>
          <Textarea
            id="vendor-notify-emails"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="font-mono text-sm"
            disabled={!user || updateVendorNotifications.isPending}
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateVendorNotifications.isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!user || updateVendorNotifications.isPending}
            onClick={async () => {
              if (!user) return
              const parts = text
                .split(/[\n,]+/)
                .map((s) => s.trim())
                .filter(Boolean)
              await updateVendorNotifications.mutateAsync({
                userId: user.id,
                notification_emails: parts,
              })
              onOpenChange(false)
              onSaved?.()
            }}
          >
            {updateVendorNotifications.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
