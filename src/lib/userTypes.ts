export interface User {
    id: string
    email: string
    user_metadata: {
        role?: 'admin' | 'vendor' | 'super-admin'
        [key: string]: any
    }
    app_metadata: {
        provider?: string
        [key: string]: any
    }
    last_sign_in_at?: string
    created_at: string
    vendor_company_name?: string
    /** Extra CPD notification recipients (vendors only); from `vendors.notification_emails`. */
    vendor_notification_emails?: string[]
}

export interface CreateUserInput {
    email: string
    password?: string
    role: 'admin' | 'vendor' | 'super-admin'
    company_name?: string
    contact_name?: string
    phone?: string
}
