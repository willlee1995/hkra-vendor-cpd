import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmail, generateRequestorConfirmationEmail, generateAdminNotificationEmail } from './email.ts'

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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with service role key to bypass RLS
    // We still validate the user via the Authorization header
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

    // Check if user is a vendor
    const { data: vendor, error: vendorError } = await supabaseClient
      .from('vendors')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (vendorError || !vendor) {
      // Log more details for debugging
      console.error('Vendor lookup failed:', {
        userId: user.id,
        userEmail: user.email,
        vendorError: vendorError,
        vendorData: vendor,
      })

      return new Response(
        JSON.stringify({
          error: 'Vendor record not found',
          details: vendorError?.message || 'No vendor record found for this user',
          userId: user.id,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const requestId = pathParts[pathParts.length - 1]

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (requestId && requestId !== 'vendor-requests') {
          // Get single request
          const { data: request, error: requestError } = await supabaseClient
            .from('vendor_requests')
            .select(`
              *,
              vendor_request_status_history (
                id,
                status,
                changed_by,
                notes,
                created_at
              )
            `)
            .eq('id', requestId)
            .eq('vendor_id', vendor.id)
            .single()

          if (requestError || !request) {
            return new Response(
              JSON.stringify({ error: 'Request not found' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }

          return new Response(
            JSON.stringify(request),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          // List all requests for vendor
          const { searchParams } = url
          const status = searchParams.get('status')

          let query = supabaseClient
            .from('vendor_requests')
            .select('*')
            .eq('vendor_id', vendor.id)
            .order('created_at', { ascending: false })

          if (status) {
            query = query.eq('status', status)
          }

          const { data: requests, error: requestsError } = await query

          if (requestsError) {
            throw requestsError
          }

          return new Response(
            JSON.stringify(requests),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

      case 'POST':
        // Create new request
        const body = await req.json()

        // Validate required fields
        if (!body.event_name || !body.event_start_date || !body.event_end_date || !body.expected_cpd_points) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate CPD points range
        const cpdPoints = parseFloat(body.expected_cpd_points)
        if (cpdPoints < 0.5 || cpdPoints > 8.0) {
          return new Response(
            JSON.stringify({ error: 'CPD points must be between 0.5 and 8.0' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Validate dates
        const startDate = new Date(body.event_start_date)
        const endDate = new Date(body.event_end_date)
        if (endDate < startDate) {
          return new Response(
            JSON.stringify({ error: 'End date must be after start date' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Get vendor details for contact info
        const { data: vendorDetails } = await supabaseClient
          .from('vendors')
          .select('company_name, contact_name, contact_email, contact_phone')
          .eq('id', vendor.id)
          .single()

        const { data: newRequest, error: createError } = await supabaseClient
          .from('vendor_requests')
          .insert({
            vendor_id: vendor.id,
            event_name: body.event_name,
            event_start_date: body.event_start_date,
            event_end_date: body.event_end_date,
            expected_cpd_points: cpdPoints,
            vendor_company_name: vendorDetails?.company_name || body.vendor_company_name,
            contact_name: vendorDetails?.contact_name || body.contact_name,
            contact_email: vendorDetails?.contact_email || body.contact_email,
            contact_phone: vendorDetails?.contact_phone || body.contact_phone,
            poster_file_url: body.poster_file_url || null,
            expected_promotion_date: body.expected_promotion_date || null,
            status: 'pending',
          })
          .select()
          .single()

        if (createError) {
          throw createError
        }

        // Send emails (errors are caught so they don't break request creation)
        // Send confirmation email to requestor
        if (newRequest.contact_email) {
          try {
            await sendEmail({
              to: newRequest.contact_email,
              subject: `CPD Request Received - ${newRequest.event_name}`,
              html: generateRequestorConfirmationEmail({
                event_name: newRequest.event_name,
                event_start_date: newRequest.event_start_date,
                event_end_date: newRequest.event_end_date,
                expected_cpd_points: parseFloat(newRequest.expected_cpd_points),
                contact_name: newRequest.contact_name,
                request_id: newRequest.id,
              }),
            })
          } catch (error) {
            console.error('Failed to send confirmation email:', error)
            // Don't throw - email failures shouldn't break request creation
          }
        }

        // Send notification emails to all admin users
        try {
          // Query admin users using Admin API
          const { data: allUsers, error: listError } = await supabaseClient.auth.admin.listUsers()

          if (listError) {
            console.error('Failed to list users for admin notifications:', listError)
          } else {
            // Filter users with admin role
            const adminEmails = allUsers?.users
              ?.filter((user: any) => {
                const role = user.user_metadata?.role || user.raw_user_meta_data?.role
                return role === 'admin' && user.email
              })
              .map((user: any) => user.email)
              .filter(Boolean) || []

            if (adminEmails.length > 0) {
              console.log(`Sending admin notifications to ${adminEmails.length} admin(s)`)
              const emailPromises = adminEmails.map((email: string) =>
                sendEmail({
                  to: email,
                  subject: `New CPD Request Requires Approval - ${newRequest.event_name}`,
                  html: generateAdminNotificationEmail({
                    event_name: newRequest.event_name,
                    event_start_date: newRequest.event_start_date,
                    event_end_date: newRequest.event_end_date,
                    expected_cpd_points: parseFloat(newRequest.expected_cpd_points),
                    vendor_company_name: newRequest.vendor_company_name,
                    contact_name: newRequest.contact_name,
                    contact_email: newRequest.contact_email,
                    contact_phone: newRequest.contact_phone || undefined,
                    request_id: newRequest.id,
                    created_at: newRequest.created_at,
                  }),
                }).catch((error) => {
                  console.error(`Failed to send admin notification to ${email}:`, error)
                })
              )

              await Promise.allSettled(emailPromises)
            } else {
              console.warn('No admin users found to send notifications to')
            }
          }
        } catch (emailError) {
          console.error('Error sending admin notification emails:', emailError)
          // Don't throw - email failures shouldn't break request creation
        }

        return new Response(
          JSON.stringify(newRequest),
          { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'PATCH':
        // Update request (only if pending)
        if (!requestId || requestId === 'vendor-requests') {
          return new Response(
            JSON.stringify({ error: 'Request ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if request exists and is pending
        const { data: existingRequest, error: checkError } = await supabaseClient
          .from('vendor_requests')
          .select('status')
          .eq('id', requestId)
          .eq('vendor_id', vendor.id)
          .single()

        if (checkError || !existingRequest) {
          return new Response(
            JSON.stringify({ error: 'Request not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (existingRequest.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Can only update pending requests' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const updateBody = await req.json()

        // Validate CPD points if provided
        if (updateBody.expected_cpd_points !== undefined) {
          const updateCpdPoints = parseFloat(updateBody.expected_cpd_points)
          if (updateCpdPoints < 0.5 || updateCpdPoints > 8.0) {
            return new Response(
              JSON.stringify({ error: 'CPD points must be between 0.5 and 8.0' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Validate dates if provided
        if (updateBody.event_start_date && updateBody.event_end_date) {
          const updateStartDate = new Date(updateBody.event_start_date)
          const updateEndDate = new Date(updateBody.event_end_date)
          if (updateEndDate < updateStartDate) {
            return new Response(
              JSON.stringify({ error: 'End date must be after start date' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
        }

        // Don't allow status changes via PATCH (vendors can only withdraw)
        const { status, ...allowedUpdates } = updateBody

        const { data: updatedRequest, error: updateError } = await supabaseClient
          .from('vendor_requests')
          .update(allowedUpdates)
          .eq('id', requestId)
          .eq('vendor_id', vendor.id)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        return new Response(
          JSON.stringify(updatedRequest),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      case 'DELETE':
        // Withdraw request (set status to withdrawn)
        if (!requestId || requestId === 'vendor-requests') {
          return new Response(
            JSON.stringify({ error: 'Request ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if request exists and is pending
        const { data: requestToWithdraw, error: withdrawCheckError } = await supabaseClient
          .from('vendor_requests')
          .select('status')
          .eq('id', requestId)
          .eq('vendor_id', vendor.id)
          .single()

        if (withdrawCheckError || !requestToWithdraw) {
          return new Response(
            JSON.stringify({ error: 'Request not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        if (requestToWithdraw.status !== 'pending') {
          return new Response(
            JSON.stringify({ error: 'Can only withdraw pending requests' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const { data: withdrawnRequest, error: withdrawError } = await supabaseClient
          .from('vendor_requests')
          .update({ status: 'withdrawn' })
          .eq('id', requestId)
          .eq('vendor_id', vendor.id)
          .select()
          .single()

        if (withdrawError) {
          throw withdrawError
        }

        return new Response(
          JSON.stringify(withdrawnRequest),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

      default:
        return new Response(
          JSON.stringify({ error: 'Method not allowed' }),
          { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

