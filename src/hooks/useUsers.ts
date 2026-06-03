import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { manageUsersService } from '@/lib/manageUsersService'
import type { CreateUserInput, UpdateVendorFlagsInput } from '@/lib/userTypes'
import { toast } from 'sonner'

export function useUsers() {
    return useQuery({
        queryKey: ['users'],
        queryFn: () => manageUsersService.getUsers(),
    })
}

export function useCreateUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: CreateUserInput) => manageUsersService.createUser(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('User created successfully')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to create user')
        },
    })
}

export function useUpdateVendorFlags() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (input: UpdateVendorFlagsInput) => manageUsersService.updateVendorFlags(input),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('Vendor Zoom settings updated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update vendor settings')
        },
    })
}

export function useDeleteUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => manageUsersService.deleteUser(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('User deleted successfully')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete user')
        },
    })
}

export function useUpdateVendorNotificationEmailsAdmin() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ userId, notification_emails }: { userId: string; notification_emails: string[] }) =>
            manageUsersService.updateVendorNotificationEmails(userId, notification_emails),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('Notification recipients updated')
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to update notification recipients')
        },
    })
}
