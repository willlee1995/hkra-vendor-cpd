/**
 * Resolve role from Supabase Auth user payloads (JWT / admin API).
 * Handles common variants: super_admin, "Super Admin", app_metadata.role.
 */
export type AppRole = 'vendor' | 'admin' | 'super-admin'

type RoleSource = {
  user_metadata?: { role?: unknown; [key: string]: unknown }
  app_metadata?: { role?: unknown; [key: string]: unknown }
  raw_user_meta_data?: { role?: unknown; [key: string]: unknown }
}

export function normalizeRoleString(raw: unknown): AppRole | null {
  if (typeof raw !== 'string') return null
  const compact = raw.trim().toLowerCase().replace(/[\s_-]/g, '')
  if (compact === 'superadmin') return 'super-admin'
  const n = raw.trim().toLowerCase().replace(/_/g, '-')
  if (n === 'vendor' || n === 'admin' || n === 'super-admin') return n
  return null
}

export function getAuthRole(user: RoleSource | null | undefined): AppRole | null {
  if (!user) return null
  const raw =
    user.user_metadata?.role ??
    user.app_metadata?.role ??
    user.raw_user_meta_data?.role
  return normalizeRoleString(raw)
}

export function isAdminRole(role: AppRole | null): boolean {
  return role === 'admin' || role === 'super-admin'
}

export function isSuperAdminRole(role: AppRole | null): boolean {
  return role === 'super-admin'
}

export function isVendorRole(role: AppRole | null): boolean {
  return role === 'vendor'
}
