import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { Dialog, DialogOverlay, DialogPortal } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface MobileNavDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

/**
 * Slide-in navigation panel for viewports below the md breakpoint.
 */
export function MobileNavDrawer({ open, onOpenChange, children }: MobileNavDrawerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="md:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-[min(288px,88vw)] flex-col md:hidden',
            'border-r border-neutral-border-subtle bg-neutral-background-card shadow-lg outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-200'
          )}
        >
          <DialogPrimitive.Title className="sr-only">Main navigation</DialogPrimitive.Title>
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-border-subtle px-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-ink-muted">
              Menu
            </span>
            <DialogPrimitive.Close
              type="button"
              className="rounded-md p-2 text-neutral-ink-medium opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-brand-secondary focus:ring-offset-2"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </DialogPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}
