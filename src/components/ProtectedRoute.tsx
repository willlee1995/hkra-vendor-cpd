import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useVendorAuth } from '@/hooks/useVendorAuth'

interface ProtectedRouteProps {
    children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
    const { user, loading, isAuthenticated } = useVendorAuth()
    const location = useLocation()

    useEffect(() => {
        if (!loading && !isAuthenticated()) {
            // User is not authenticated
        }
    }, [user, loading, isAuthenticated])

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="text-center">
                    <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary mx-auto"></div>
                    <p className="text-muted-foreground">Loading...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated()) {
        return <Navigate to="/vendor/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}

