import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import { getAuthRole, isAdminRole, isSuperAdminRole, isVendorRole } from '@/lib/authRole'

export function useVendorAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        setLoading(false)
        return
      }
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch((error) => {
      console.error('Error in getSession:', error)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      const role = getAuthRole(data.user)
      if (!role) {
        await supabase.auth.signOut()
        throw new Error('Access denied. Vendor or Admin account required.')
      }

      return data
    } catch (error) {
      console.error('Sign in error:', error)
      throw error
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      // Navigate will be handled by the component using this hook
      window.location.href = '/vendor/login'
    } catch (error) {
      console.error('Sign out error:', error)
      throw error
    }
  }

  const isVendor = () => {
    return isVendorRole(getAuthRole(user))
  }

  const isAdmin = () => {
    return isAdminRole(getAuthRole(user))
  }

  const isSuperAdmin = () => {
    return isSuperAdminRole(getAuthRole(user))
  }

  const isAuthenticated = () => {
    return !!user && (isVendor() || isAdmin())
  }

  return {
    user,
    loading,
    signIn,
    signOut,
    isVendor,
    isAdmin,
    isSuperAdmin,
    isAuthenticated,
  }
}

