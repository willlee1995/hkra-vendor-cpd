import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_NOTIFICATION_EMAILS = 25

function normalizeNotificationEmailsInput(raw: unknown):
    | { ok: true; emails: string[] }
    | { ok: false; message: string } {
    if (!Array.isArray(raw)) {
        return { ok: false, message: 'notification_emails must be an array' }
    }
    if (raw.length > MAX_NOTIFICATION_EMAILS) {
        return { ok: false, message: `At most ${MAX_NOTIFICATION_EMAILS} addresses` }
    }
    const out: string[] = []
    const seen = new Set<string>()
    for (const item of raw) {
        if (typeof item !== 'string') {
            return { ok: false, message: 'Each email must be a string' }
        }
        const t = item.trim()
        if (!t) continue
        const low = t.toLowerCase()
        if (seen.has(low)) continue
        if (!SIMPLE_EMAIL_RE.test(t)) {
            return { ok: false, message: `Invalid email: ${t}` }
        }
        seen.add(low)
        out.push(t)
    }
    return { ok: true, emails: out }
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Get the user from the authorization header
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            throw new Error('No authorization header')
        }

        const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))

        if (userError || !user) {
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const userRole = user.user_metadata?.role || user.raw_user_meta_data?.role
        const isSuperAdmin = userRole === 'super-admin'
        const isAdmin = userRole === 'admin'

        if (!isSuperAdmin && !isAdmin) {
            return new Response(
                JSON.stringify({ error: 'Forbidden: Admin access required' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const { url, method } = req
        const { searchParams } = new URL(url)

        // GET: List users
        if (method === 'GET') {
            const { data: { users }, error } = await supabaseClient.auth.admin.listUsers()
            if (error) throw error

            // Enrich users with vendor info if needed, but basic auth info might be enough
            // To get vendor info we would need to join with public.vendors table manually
            // For now, let's just return the auth users and maybe fetching vendor info for each is too heavy
            // Optimization: Fetch all vendors and map them

            const { data: vendors } = await supabaseClient
                .from('vendors')
                .select('user_id, company_name, notification_emails')

            const enrichedUsers = users.map(u => {
                const vendor = vendors?.find(v => v.user_id === u.id)
                return {
                    ...u,
                    vendor_company_name: vendor?.company_name,
                    vendor_notification_emails: vendor?.notification_emails ?? [],
                }
            })

            return new Response(
                JSON.stringify(enrichedUsers),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // POST: Create user
        if (method === 'POST') {
            const body = await req.json()
            const { email, password, role, company_name, contact_name, phone } = body

            // Permission Logic
            if (role === 'admin' && !isSuperAdmin) {
                return new Response(
                    JSON.stringify({ error: 'Forbidden: Only Super Admins can create Admins' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }
            if (role === 'super-admin' && !isSuperAdmin) {
                return new Response(
                    JSON.stringify({ error: 'Forbidden: Only Super Admins can create Super Admins' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Create the user
            const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { role }
            })

            if (createError) throw createError

            // If vendor, also create vendor record
            if (role === 'vendor' && newUser.user) {
                // Direct insert instead of RPC to avoid schema cache issues
                const { error: vendorError } = await supabaseClient
                    .from('vendors')
                    .upsert({
                        user_id: newUser.user.id,
                        company_name: company_name,
                        contact_name: contact_name,
                        contact_email: email,
                        contact_phone: phone,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' })

                if (vendorError) {
                    // Update metadata manually if needed, though createUser should have set it
                    return new Response(
                        JSON.stringify({ error: 'User created but vendor setup failed: ' + vendorError.message }),
                        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }
            }

            return new Response(
                JSON.stringify(newUser.user),
                { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // DELETE: Delete user
        if (method === 'DELETE') {
            const userId = searchParams.get('id')
            if (!userId) {
                return new Response(
                    JSON.stringify({ error: 'Missing user ID' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            // Get target user to check role
            const { data: { user: targetUser }, error: fetchError } = await supabaseClient.auth.admin.getUserById(userId)
            if (fetchError || !targetUser) {
                return new Response(
                    JSON.stringify({ error: 'User not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const targetRole = targetUser.user_metadata?.role || targetUser.raw_user_meta_data?.role

            // Permission Logic for Delete
            if (!isSuperAdmin) {
                // Admin can only delete vendors
                if (targetRole !== 'vendor') {
                    return new Response(
                        JSON.stringify({ error: 'Forbidden: Admins can only delete Vendors' }),
                        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                    )
                }
            }

            const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(userId)
            if (deleteError) throw deleteError

            return new Response(
                JSON.stringify({ success: true }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // PATCH: vendor notification_emails (admin / super-admin)
        if (method === 'PATCH') {
            const body = await req.json()
            const userId = body.userId as string | undefined
            const notification_emails = body.notification_emails

            if (!userId) {
                return new Response(
                    JSON.stringify({ error: 'userId is required' }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const parsed = normalizeNotificationEmailsInput(notification_emails)
            if (!parsed.ok) {
                return new Response(
                    JSON.stringify({ error: parsed.message }),
                    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const { data: { user: targetUser }, error: fetchTargetError } = await supabaseClient.auth.admin.getUserById(userId)
            if (fetchTargetError || !targetUser) {
                return new Response(
                    JSON.stringify({ error: 'User not found' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const targetRole = targetUser.user_metadata?.role || targetUser.raw_user_meta_data?.role
            if (targetRole !== 'vendor') {
                return new Response(
                    JSON.stringify({ error: 'Only vendor accounts have notification recipient lists' }),
                    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            const { data: updatedVendor, error: vendorUpdateError } = await supabaseClient
                .from('vendors')
                .update({
                    notification_emails: parsed.emails,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId)
                .select('user_id, notification_emails')
                .maybeSingle()

            if (vendorUpdateError) {
                throw vendorUpdateError
            }

            if (!updatedVendor) {
                return new Response(
                    JSON.stringify({ error: 'Vendor record not found for this user' }),
                    { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
                )
            }

            return new Response(
                JSON.stringify(updatedVendor),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
