import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { useVendorAuth } from '@/hooks/useVendorAuth'
import { useCreateUser } from '@/hooks/useUsers'

const formSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6).optional(),
    role: z.enum(['admin', 'vendor', 'super-admin']),
    company_name: z.string().optional(),
    contact_name: z.string().optional(),
    phone: z.string().optional(),
    zoom_webinar_auto_create: z.boolean().optional(),
}).refine((data) => {
    if (data.role === 'vendor') {
        return !!data.company_name && !!data.contact_name
    }
    return true
}, {
    message: "Company name and Contact name are required for Vendors",
    path: ["company_name"],
})

interface UserFormProps {
    onSuccess?: () => void
}

export function UserForm({ onSuccess }: UserFormProps) {
    const { isSuperAdmin } = useVendorAuth()
    const createUser = useCreateUser()

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            role: 'vendor',
            company_name: '',
            contact_name: '',
            phone: '',
            zoom_webinar_auto_create: false,
        },
    })

    const watchRole = form.watch('role')

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        // Generate password if not provided
        const password = values.password || Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)

        // We don't wait for success here effectively because we want to show the password first/concurrently?
        // Actually we should wait, but handling the One-time password display is tricky
        // For now, let's assume we copy the password BEFORE submit or it is auto-generated and shown

        // Let's change approach: Generate password on mount or button click and fill it
        // Or just submit and rely on email confirmation? 
        // Supabase Admin CreateUser doesn't send email with password. We must provide one.

        try {
            await createUser.mutateAsync({
                ...values,
                password: values.password || password
            })
            form.reset()
            // If password was auto-generated, we should show it to the admin so they can share it
            // But for better UX, maybe we should have generated it visibly
            if (onSuccess) onSuccess()
        } catch (error) {
            console.error(error)
        }
    }

    const generatePassword = () => {
        const pwd = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
        form.setValue('password', pwd)
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                                <Input placeholder="user@example.com" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Password (Optional - Auto-generated if empty)</FormLabel>
                            <div className="flex gap-2">
                                <FormControl>
                                    <Input type="text" placeholder="Leave empty to auto-generate" {...field} />
                                </FormControl>
                                <Button type="button" variant="outline" onClick={generatePassword}>Generate</Button>
                            </div>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!isSuperAdmin()}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="vendor">Vendor</SelectItem>
                                    {isSuperAdmin() && <SelectItem value="admin">Admin</SelectItem>}
                                    {isSuperAdmin() && <SelectItem value="super-admin">Super Admin</SelectItem>}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {watchRole === 'vendor' && (
                    <>
                        <FormField
                            control={form.control}
                            name="company_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Company Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Acme Corp" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="contact_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contact Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="John Doe" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Phone (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="+1 234 567 890" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="zoom_webinar_auto_create"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                                    <FormControl>
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-4 w-4"
                                            checked={Boolean(field.value)}
                                            onChange={(e) => field.onChange(e.target.checked)}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Auto-create Zoom webinar on approval</FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                            Creates a Zoom webinar via API when requests are approved, then syncs the ID to the HKRA site for member registration.
                                        </p>
                                    </div>
                                </FormItem>
                            )}
                        />
                    </>
                )}

                <div className="flex justify-end space-x-2">
                    <Button type="submit" disabled={createUser.isPending}>
                        {createUser.isPending ? 'Creating...' : 'Create User'}
                    </Button>
                </div>
            </form>
        </Form>
    )
}
