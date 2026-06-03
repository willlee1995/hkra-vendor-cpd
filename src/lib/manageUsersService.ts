import { supabase } from './supabase'
import type { User, CreateUserInput, UpdateVendorFlagsInput } from './userTypes'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1`

async function getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
        throw new Error('Not authenticated')
    }
    return {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
    }
}

export const manageUsersService = {
    // Get all users
    async getUsers(): Promise<User[]> {
        const headers = await getAuthHeaders()
        const response = await fetch(`${EDGE_FUNCTION_URL}/manage-users`, {
            method: 'GET',
            headers,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to fetch users')
        }

        return response.json()
    },

    // Create new user
    async createUser(input: CreateUserInput): Promise<User> {
        const headers = await getAuthHeaders()
        const response = await fetch(`${EDGE_FUNCTION_URL}/manage-users`, {
            method: 'POST',
            headers,
            body: JSON.stringify(input),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to create user')
        }

        return response.json()
    },

    async updateVendorFlags(input: UpdateVendorFlagsInput): Promise<{ zoom_webinar_auto_create: boolean }> {
        const headers = await getAuthHeaders()
        const response = await fetch(`${EDGE_FUNCTION_URL}/manage-users`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(input),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to update vendor settings')
        }

        return response.json()
    },

    // Delete user
    async deleteUser(id: string): Promise<void> {
        const headers = await getAuthHeaders()
        const response = await fetch(`${EDGE_FUNCTION_URL}/manage-users?id=${id}`, {
            method: 'DELETE',
            headers,
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to delete user')
        }
    },

    async updateVendorNotificationEmails(userId: string, notification_emails: string[]): Promise<{ user_id: string; notification_emails: string[] }> {
        const headers = await getAuthHeaders()
        const response = await fetch(`${EDGE_FUNCTION_URL}/manage-users`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ userId, notification_emails }),
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to update notification emails')
        }

        return response.json()
    },
}
