import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  sendEmail,
  sendEmailToVendorRecipients,
  collectVendorNotificationRecipients,
  generateRequestorConfirmationEmail,
  generateAdminNotificationEmail,
  generateApprovalEmail,
  generateRejectionEmail,
  generateUnapprovalEmail,
  generateAdminApprovalNotificationEmail,
} from './email.ts'
import { syncHkraEventFromRequest } from '../_shared/hkraCreateEvent.ts'

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

    const authRole = normalizeAuthRole(user)
    const isAdmin = authRole === 'admin' || authRole === 'super-admin'

    // Check if user is a vendor (only needed for non-admin users)
    let vendor = null
    if (!isAdmin) {
      const { data: vendorData, error: vendorError } = await supabaseClient
        .from('vendors')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (vendorError || !vendorData) {
        // Log more details for debugging
        console.error('Vendor lookup failed:', {
          userId: user.id,
          userEmail: user.email,
          vendorError: vendorError,
          vendorData: vendorData,
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
      vendor = vendorData
    }

    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const requestId = pathParts[pathParts.length - 1]

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        if (requestId && requestId !== 'vendor-requests') {
          // Get single request
          let query = supabaseClient
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

          // If not admin, filter by vendor_id
          if (!isAdmin && vendor) {
            query = query.eq('vendor_id', vendor.id)
          }

          const { data: request, error: requestError } = await query.single()

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
          // List requests - all for admin, filtered for vendor
          const { searchParams } = url
          const status = searchParams.get('status')
          const vendorIdParam = searchParams.get('vendor_id')

          let query = supabaseClient
            .from('vendor_requests')
            .select('*')
            .order('created_at', { ascending: false })

          // If not admin, filter by vendor_id (ignore vendor_id query param — cannot browse other vendors)
          if (!isAdmin && vendor) {
            query = query.eq('vendor_id', vendor.id)
          } else if (isAdmin && vendorIdParam) {
            if (!UUID_RE.test(vendorIdParam)) {
              return new Response(
                JSON.stringify({ error: 'Invalid vendor_id query parameter' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              )
            }
            query = query.eq('vendor_id', vendorIdParam).limit(1)
          }

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

      case 'POST': {
        const body = await req.json()

        let postingVendorId: string
        if (isAdmin) {
          const vid = body.vendor_id
          if (!vid || typeof vid !== 'string' || !UUID_RE.test(vid)) {
            return new Response(
              JSON.stringify({
                error:
                  'vendor_id is required and must be a valid UUID when creating a request as an admin',
              }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          const { data: vendorRow, error: adminVendorErr } = await supabaseClient
            .from('vendors')
            .select('id')
            .eq('id', vid)
            .single()

          if (adminVendorErr || !vendorRow) {
            return new Response(
              JSON.stringify({ error: 'Vendor not found for the given vendor_id' }),
              { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          postingVendorId = vendorRow.id
        } else {
          if (!vendor) {
            return new Response(
              JSON.stringify({
                error: 'Vendor record not found',
                details: 'No vendor record found for this user',
                userId: user.id,
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          postingVendorId = vendor.id
        }

        // Validate required fields
        if (!body.event_name || !body.event_start_date || !body.event_end_date || !body.event_start_time || !body.event_end_time) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // CPD points are optional for vendors, admins will set them during approval
        let cpdPoints: number | null = null
        if (body.expected_cpd_points !== undefined && body.expected_cpd_points !== null) {
          cpdPoints = parseFloat(body.expected_cpd_points)
          if (isNaN(cpdPoints) || cpdPoints < 0.5 || cpdPoints > 8.0) {
            return new Response(
              JSON.stringify({ error: 'CPD points must be between 0.5 and 8.0' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
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
          .select('company_name, contact_name, contact_email, contact_phone, notification_emails')
          .eq('id', postingVendorId)
          .single()

        const { data: newRequest, error: createError } = await supabaseClient
          .from('vendor_requests')
          .insert({
            vendor_id: postingVendorId,
            event_name: body.event_name,
            event_start_date: body.event_start_date,
            event_end_date: body.event_end_date,
            event_start_time: body.event_start_time,
            event_end_time: body.event_end_time,
            expected_cpd_points: cpdPoints || null,
            // Prioritize form values over vendor details since user explicitly edited them
            vendor_company_name: body.vendor_company_name || vendorDetails?.company_name,
            contact_name: body.contact_name || vendorDetails?.contact_name,
            contact_email: body.contact_email || vendorDetails?.contact_email,
            contact_phone: body.contact_phone || vendorDetails?.contact_phone,
            poster_file_url: body.poster_file_url || null,
            zoom_webinar_id: body.zoom_webinar_id || null,
            on24_key: body.on24_key || null,
            on24_id: body.on24_id || null,
            expected_promotion_date: body.expected_promotion_date || null,
            status: 'pending',
          })
          .select()
          .single()

        if (createError) {
          throw createError
        }

        // Send emails (errors are caught so they don't break request creation)
        // Send confirmation email to requestor + vendor notification list
        const confirmationRecipients = collectVendorNotificationRecipients(
          newRequest.contact_email,
          vendorDetails?.notification_emails,
        )
        if (confirmationRecipients.length > 0) {
          try {
            await sendEmailToVendorRecipients(
              confirmationRecipients,
              `CPD Request Received - ${newRequest.event_name}`,
              generateRequestorConfirmationEmail({
                event_name: newRequest.event_name,
                event_start_date: newRequest.event_start_date,
                event_end_date: newRequest.event_end_date,
                event_start_time: newRequest.event_start_time || undefined,
                event_end_time: newRequest.event_end_time || undefined,
                expected_cpd_points: newRequest.expected_cpd_points ? parseFloat(String(newRequest.expected_cpd_points)) : null,
                contact_name: newRequest.contact_name,
                request_id: newRequest.id,
              }),
            )
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
                const r = normalizeAuthRole(user)
                return (r === 'admin' || r === 'super-admin') && user.email
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
                    event_start_time: newRequest.event_start_time || undefined,
                    event_end_time: newRequest.event_end_time || undefined,
                    expected_cpd_points: newRequest.expected_cpd_points ? parseFloat(String(newRequest.expected_cpd_points)) : null,
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
      }

      case 'PATCH':
        // Update request
        if (!requestId || requestId === 'vendor-requests') {
          return new Response(
            JSON.stringify({ error: 'Request ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Check if request exists
        let query = supabaseClient
          .from('vendor_requests')
          .select('status, vendor_id')
          .eq('id', requestId)

        // If not admin, filter by vendor_id
        if (!isAdmin && vendor) {
          query = query.eq('vendor_id', vendor.id)
        }

        const { data: existingRequest, error: checkError } = await query.single()

        if (checkError || !existingRequest) {
          return new Response(
            JSON.stringify({ error: 'Request not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        // Vendors can only update pending or rejected requests, admins can update any
        if (!isAdmin && existingRequest.status !== 'pending' && existingRequest.status !== 'rejected') {
          return new Response(
            JSON.stringify({ error: 'Can only update pending or rejected requests' }),
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

        // Prepare update data
        let updateData: any = { ...updateBody }

        // Vendors cannot change status (they can only withdraw via DELETE)
        // Admins can change status (approve/reject)
        if (!isAdmin) {
          if (updateBody.status) {
            const { status, ...allowedUpdates } = updateBody
            updateData = allowedUpdates
          }

          // If vendor is updating a rejected request, reset it to pending
          if (existingRequest.status === 'rejected') {
            updateData.status = 'pending'
            updateData.rejection_reason = null
          }
        }

        // If admin is approving, set approved_by and approved_at
        if (isAdmin && updateBody.status === 'approved') {
          updateData.approved_by = user.id
          updateData.approved_at = new Date().toISOString()
        }

        // If admin is unapproving (changing from approved to pending), clear approved_by and approved_at
        if (isAdmin && existingRequest.status === 'approved' && updateBody.status === 'pending') {
          updateData.approved_by = null
          updateData.approved_at = null
        }

        // If admin is unrejecting (changing from rejected to approved), clear rejection_reason and set approval fields
        if (isAdmin && existingRequest.status === 'rejected' && updateBody.status === 'approved') {
          updateData.rejection_reason = null
          updateData.approved_by = user.id
          updateData.approved_at = new Date().toISOString()
        }

        // Build update query
        let updateQuery = supabaseClient
          .from('vendor_requests')
          .update(updateData)
          .eq('id', requestId)

        // If not admin, filter by vendor_id
        if (!isAdmin && vendor) {
          updateQuery = updateQuery.eq('vendor_id', vendor.id)
        }

        const { data: updatedRequest, error: updateError } = await updateQuery
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        // Manually create status history entry if status changed
        // This is needed because the trigger uses auth.uid() which doesn't work with service role
        if (updateBody.status && existingRequest.status !== updateBody.status) {
          try {
            await supabaseClient
              .from('vendor_request_status_history')
              .insert({
                request_id: requestId,
                status: updateBody.status,
                changed_by: user.id,
                notes: updateBody.status === 'rejected'
                  ? updateBody.rejection_reason || null
                  : updateBody.status === 'approved'
                    ? updateBody.admin_notes || null
                    : null,
              })
          } catch (historyError) {
            // Log error but don't fail the update
            console.error('Failed to create status history:', historyError)
          }
        }

        // Send email notification to requestor (+ vendor notification list) if status changed
        if (updateBody.status && existingRequest.status !== updateBody.status) {
          const { data: vendorNotify } = await supabaseClient
            .from('vendors')
            .select('notification_emails')
            .eq('id', updatedRequest.vendor_id)
            .single()

          const statusRecipients = collectVendorNotificationRecipients(
            updatedRequest.contact_email,
            vendorNotify?.notification_emails,
          )

          if (statusRecipients.length > 0) {
            try {
              // Check specific transitions first (more specific conditions)
              if (updateBody.status === 'approved' && existingRequest.status === 'rejected') {
                // Unrejection: changing from rejected to approved
                await sendEmailToVendorRecipients(
                  statusRecipients,
                  `CPD Request Approved - ${updatedRequest.event_name}`,
                  generateApprovalEmail({
                    event_name: updatedRequest.event_name,
                    event_start_date: updatedRequest.event_start_date,
                    event_end_date: updatedRequest.event_end_date,
                    event_start_time: updatedRequest.event_start_time || undefined,
                    event_end_time: updatedRequest.event_end_time || undefined,
                    expected_cpd_points: updatedRequest.expected_cpd_points ? parseFloat(String(updatedRequest.expected_cpd_points)) : null,
                    contact_name: updatedRequest.contact_name,
                    request_id: updatedRequest.id,
                  }),
                )
              } else if (updateBody.status === 'pending' && existingRequest.status === 'approved') {
                // Unapproval: changing from approved back to pending
                await sendEmailToVendorRecipients(
                  statusRecipients,
                  `CPD Request Status Update - ${updatedRequest.event_name}`,
                  generateUnapprovalEmail({
                    event_name: updatedRequest.event_name,
                    event_start_date: updatedRequest.event_start_date,
                    event_end_date: updatedRequest.event_end_date,
                    event_start_time: updatedRequest.event_start_time || undefined,
                    event_end_time: updatedRequest.event_end_time || undefined,
                    contact_name: updatedRequest.contact_name,
                    request_id: updatedRequest.id,
                  }),
                )
              } else if (updateBody.status === 'approved') {
                // General approval (from pending to approved)
                await sendEmailToVendorRecipients(
                  statusRecipients,
                  `CPD Request Approved - ${updatedRequest.event_name}`,
                  generateApprovalEmail({
                    event_name: updatedRequest.event_name,
                    event_start_date: updatedRequest.event_start_date,
                    event_end_date: updatedRequest.event_end_date,
                    event_start_time: updatedRequest.event_start_time || undefined,
                    event_end_time: updatedRequest.event_end_time || undefined,
                    expected_cpd_points: updatedRequest.expected_cpd_points ? parseFloat(String(updatedRequest.expected_cpd_points)) : null,
                    contact_name: updatedRequest.contact_name,
                    request_id: updatedRequest.id,
                  }),
                )
              } else if (updateBody.status === 'rejected') {
                await sendEmailToVendorRecipients(
                  statusRecipients,
                  `CPD Request Status Update - ${updatedRequest.event_name}`,
                  generateRejectionEmail({
                    event_name: updatedRequest.event_name,
                    event_start_date: updatedRequest.event_start_date,
                    event_end_date: updatedRequest.event_end_date,
                    event_start_time: updatedRequest.event_start_time || undefined,
                    event_end_time: updatedRequest.event_end_time || undefined,
                    contact_name: updatedRequest.contact_name,
                    request_id: updatedRequest.id,
                    rejection_reason: updateBody.rejection_reason || null,
                  }),
                )
              }
            } catch (emailError) {
              // Log error but don't fail the update
              console.error('Failed to send status notification email:', emailError)
            }
          }
        }

        // Send notification to OTHER admins if request is approved
        if (updateBody.status === 'approved' && existingRequest.status !== 'approved') {
          try {
            // Query admin users
            const { data: allUsers, error: listError } = await supabaseClient.auth.admin.listUsers()

            if (listError) {
              console.error('Failed to list users for admin approval notifications:', listError)
            } else {
              // Filter users with admin role, excluding the current approver
              const otherAdminEmails = allUsers?.users
                ?.filter((u: any) => {
                  const r = normalizeAuthRole(u)
                  return (r === 'admin' || r === 'super-admin') && u.email && u.id !== user.id
                })
                .map((u: any) => u.email)
                .filter(Boolean) || []

              if (otherAdminEmails.length > 0) {
                console.log(`Sending admin approval notifications to ${otherAdminEmails.length} other admin(s)`)

                const emailPromises = otherAdminEmails.map((email: string) =>
                  sendEmail({
                    to: email,
                    subject: `CPD Request Approved - ${updatedRequest.event_name}`,
                    html: generateAdminApprovalNotificationEmail({
                      event_name: updatedRequest.event_name,
                      event_start_date: updatedRequest.event_start_date,
                      event_end_date: updatedRequest.event_end_date,
                      vendor_company_name: updatedRequest.vendor_company_name,
                      approved_by_email: user.email || 'Unknown Admin',
                      approved_at: new Date().toISOString(),
                      request_id: updatedRequest.id,
                    }),
                  }).catch((error) => {
                    console.error(`Failed to send admin approval notification to ${email}:`, error)
                  })
                )

                await Promise.allSettled(emailPromises)
              }
            }
          } catch (adminEmailError) {
            console.error('Failed to send admin approval notifications:', adminEmailError)
          }
        }

        let responsePayload: Record<string, unknown> = updatedRequest as Record<string, unknown>

        if (isAdmin && updateBody.status === 'approved' && existingRequest.status !== 'approved') {
          try {
            await syncHkraEventFromRequest(supabaseClient, requestId, { force: false })
          } catch (hkraErr) {
            console.error('HKRA WordPress event sync error:', hkraErr)
          }
          const { data: freshRequest } = await supabaseClient
            .from('vendor_requests')
            .select('*')
            .eq('id', requestId)
            .single()
          if (freshRequest) {
            responsePayload = freshRequest as Record<string, unknown>
          }
        }

        return new Response(
          JSON.stringify(responsePayload),
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

        if (requestToWithdraw.status !== 'pending' && requestToWithdraw.status !== 'rejected') {
          return new Response(
            JSON.stringify({ error: 'Can only withdraw pending or rejected requests' }),
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

        // Manually create status history entry for withdrawal
        // This is needed because the trigger uses auth.uid() which doesn't work with service role
        if (requestToWithdraw.status !== 'withdrawn') {
          try {
            await supabaseClient
              .from('vendor_request_status_history')
              .insert({
                request_id: requestId,
                status: 'withdrawn',
                changed_by: user.id,
                notes: null,
              })
          } catch (historyError) {
            // Log error but don't fail the withdrawal
            console.error('Failed to create status history for withdrawal:', historyError)
          }
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

