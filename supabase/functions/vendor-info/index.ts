import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Get Supabase credentials from environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NOTIFICATION_EMAILS = 25

function parseNotificationEmailsPayload(body: Record<string, unknown>):
  | { ok: true; emails: string[] }
  | { ok: false; message: string } {
  if (!('notification_emails' in body)) {
    return { ok: false, message: 'notification_emails is required' }
  }
  const raw = body.notification_emails
  if (!Array.isArray(raw)) {
    return { ok: false, message: 'notification_emails must be an array of strings' }
  }
  if (raw.length > MAX_NOTIFICATION_EMAILS) {
    return { ok: false, message: `At most ${MAX_NOTIFICATION_EMAILS} additional addresses` }
  }
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string') {
      return { ok: false, message: 'Each notification email must be a string' }
    }
    const trimmed = item.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (seen.has(lower)) continue
    if (!SIMPLE_EMAIL_RE.test(trimmed)) {
      return { ok: false, message: `Invalid email address: ${trimmed}` }
    }
    seen.add(lower)
    out.push(trimmed)
  }
  return { ok: true, emails: out }
}

function normalizeAuthRole(user: {
  user_metadata?: { role?: unknown }
  raw_user_meta_data?: { role?: unknown }
  app_metadata?: { role?: unknown }
}): 'vendor' | 'admin' | 'super-admin' | null {
  const raw = user.user_metadata?.role ?? user.raw_user_meta_data?.role ?? user.app_metadata?.role
  if (typeof raw !== 'string') return null
  const compact = raw.trim().toLowerCase().replace(/[\s_-]/g, '')
  if (compact === 'superadmin') return 'super-admin'
  const n = raw.trim().toLowerCase().replace(/_/g, '-')
  if (n === 'vendor' || n === 'admin' || n === 'super-admin') return n
  return null
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    // Create Supabase client with service role key to bypass RLS
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    )

    // Get authenticated user from the Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a client with user context to get the user
    const userClient = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'PATCH') {
      let jsonBody: Record<string, unknown>
      try {
        jsonBody = await req.json() as Record<string, unknown>
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid JSON body' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const parsed = parseNotificationEmailsPayload(jsonBody)
      if (!parsed.ok) {
        return new Response(
          JSON.stringify({ error: parsed.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: updatedVendor, error: updateError } = await supabaseClient
        .from('vendors')
        .update({
          notification_emails: parsed.emails,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select('id, user_id, company_name, contact_name, contact_email, contact_phone, notification_emails, zoom_webinar_auto_create, created_at, updated_at')
        .maybeSingle()

      if (updateError) {
        console.error('Vendor notification_emails update failed:', updateError)
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!updatedVendor) {
        return new Response(
          JSON.stringify({ error: 'Vendor record not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify(updatedVendor),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'GET') {
      const url = new URL(req.url)
      if (url.searchParams.get('list') === 'true') {
        const authRole = normalizeAuthRole(user)
        if (authRole !== 'admin' && authRole !== 'super-admin') {
          return new Response(
            JSON.stringify({ error: 'Forbidden: admin access required' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: vendors, error: listError } = await supabaseClient
          .from('vendors')
          .select('id, user_id, company_name, contact_name, contact_email, contact_phone, notification_emails, zoom_webinar_auto_create, created_at, updated_at')
          .order('company_name', { ascending: true })

        if (listError) {
          console.error('Failed to list vendors:', listError)
          return new Response(
            JSON.stringify({ error: listError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        return new Response(JSON.stringify(vendors ?? []), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // GET — single vendor profile (bypasses RLS via service role)
    const { data: vendor, error: vendorError } = await supabaseClient
      .from('vendors')
      .select('id, user_id, company_name, contact_name, contact_email, contact_phone, notification_emails, zoom_webinar_auto_create, created_at, updated_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (vendorError) {
      console.error('Vendor lookup failed:', {
        userId: user.id,
        userEmail: user.email,
        vendorError: vendorError,
      })

      return new Response(
        JSON.stringify({
          error: 'Vendor record not found',
          details: vendorError.message,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!vendor) {
      return new Response(
        JSON.stringify({ error: 'Vendor record not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify(vendor),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in vendor-info function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

