import { useState, useEffect } from 'react'
import { useUsers, useDeleteUser, useUpdateVendorNotificationEmailsAdmin } from '@/hooks/useUsers'
import type { User } from '@/lib/userTypes'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Trash2, Shield, Building2, User as UserIcon, Mail } from 'lucide-react'
import { UserForm } from '@/components/admin/UserForm'
import { format } from 'date-fns'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { getAuthRole, isSuperAdminRole } from '@/lib/authRole'

export function AdminUserManagement() {
    usePageTitle('User Management')
    const { data: users, isLoading } = useUsers()
    const { isSuperAdmin, isAdmin } = useVendorAuth()
    const deleteUser = useDeleteUser()
    const updateVendorNotifications = useUpdateVendorNotificationEmailsAdmin()
    const [isaddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [notifyDialogUser, setNotifyDialogUser] = useState<User | null>(null)
    const [notifyText, setNotifyText] = useState('')

    useEffect(() => {
        if (!notifyDialogUser) {
            setNotifyText('')
            return
        }
        const list = notifyDialogUser.vendor_notification_emails
        setNotifyText(Array.isArray(list) && list.length > 0 ? list.join('\n') : '')
    }, [notifyDialogUser])

    if (!isAdmin()) {
        return <div>Access Denied</div>
    }

    const handleDelete = async (id: string, role?: string) => {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            // Optimistic UI check - but API will enforce it too
            if (role !== 'vendor' && !isSuperAdmin()) {
                alert('You can only delete vendors.')
                return
            }
            await deleteUser.mutateAsync(id)
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <main className="container mx-auto px-4 py-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-3xl font-bold text-foreground">User Management</h2>
                        <p className="text-muted-foreground">Manage Admin and Vendor users</p>
                    </div>
                    <Dialog open={isaddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <UserPlus className="mr-2 h-4 w-4" />
                                Add User
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle>Add New User</DialogTitle>
                                <DialogDescription>
                                    Create a new user. {isSuperAdmin() ? 'You can create Admins and Vendors.' : 'You can only create Vendors.'}
                                </DialogDescription>
                            </DialogHeader>
                            <UserForm onSuccess={() => setIsAddDialogOpen(false)} />
                        </DialogContent>
                    </Dialog>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Users</CardTitle>
                        <CardDescription>
                            A list of all users including their role and status.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex justify-center p-8">Loading users...</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Company</TableHead>
                                        <TableHead>Last Sign In</TableHead>
                                        <TableHead>Created At</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users?.map((user) => {
                                        const role = getAuthRole(user) ?? 'vendor'
                                        if (isSuperAdminRole(role) && !isSuperAdmin()) return null

                                        return (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={role === 'admin' || role === 'super-admin' ? 'default' : 'secondary'}>
                                                        {role === 'super-admin' && <Shield className="mr-1 h-3 w-3" />}
                                                        {role === 'admin' && <UserIcon className="mr-1 h-3 w-3" />}
                                                        {role === 'vendor' && <Building2 className="mr-1 h-4 w-4" />}
                                                        {role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{user.vendor_company_name || '-'}</TableCell>
                                                <TableCell>{user.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy HH:mm') : 'Never'}</TableCell>
                                                <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        {role === 'vendor' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                type="button"
                                                                title="Edit notification recipients"
                                                                onClick={() => setNotifyDialogUser(user)}
                                                            >
                                                                <Mail className="h-4 w-4 text-muted-foreground" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDelete(user.id, role)}
                                                            disabled={(!isSuperAdmin() && role !== 'vendor') || role === 'super-admin'} // Only super-admin can delete admins/super-admins. No one can delete themselves (handled by API/Logic usually but good to disable here if we knew current user id)
                                                        >
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {!users?.length && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24">No users found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Dialog open={!!notifyDialogUser} onOpenChange={(open) => { if (!open) setNotifyDialogUser(null) }}>
                    <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                            <DialogTitle>Vendor notification recipients</DialogTitle>
                            <DialogDescription>
                                Additional addresses that receive CPD emails for {notifyDialogUser?.email}. One per line or comma-separated (max 25).
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label htmlFor="admin-vendor-notify">Email addresses</Label>
                            <Textarea
                                id="admin-vendor-notify"
                                value={notifyText}
                                onChange={(e) => setNotifyText(e.target.value)}
                                rows={5}
                                className="font-mono text-sm"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setNotifyDialogUser(null)}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={!notifyDialogUser || updateVendorNotifications.isPending}
                                onClick={async () => {
                                    if (!notifyDialogUser) return
                                    const parts = notifyText
                                        .split(/[\n,]+/)
                                        .map((s) => s.trim())
                                        .filter(Boolean)
                                    await updateVendorNotifications.mutateAsync({
                                        userId: notifyDialogUser.id,
                                        notification_emails: parts,
                                    })
                                    setNotifyDialogUser(null)
                                }}
                            >
                                {updateVendorNotifications.isPending ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    )
}
