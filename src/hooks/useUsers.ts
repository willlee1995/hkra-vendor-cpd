import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { manageUsersService } from '@/lib/manageUsersService'
import type { CreateUserInput } from '@/lib/userTypes'
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
