import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  sendEmail,
  sendEmailToVendorRecipients,
  collectVendorNotificationRecipients,
  generateAttendanceUploadConfirmationEmail,
  generateAttendanceUploadAdminNotificationEmail,
} from '../vendor-requests/email.ts'

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

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_ATTENDANCE_TYPES = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
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

    // Check if user is a vendor (using service role client to bypass RLS)
    const { data: vendor, error: vendorError } = await supabaseClient
      .from('vendors')
      .select('id, notification_emails')
      .eq('user_id', user.id)
      .single()

    if (vendorError || !vendor) {
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

    // Parse form data - support multiple files
    const formData = await req.formData()

    // Debug: Log all form data keys
    const formDataKeys: string[] = []
    for (const key of formData.keys()) {
      formDataKeys.push(key)
    }
    console.log('FormData keys:', formDataKeys)

    const files = formData.getAll('files') as File[]
    const requestId = formData.get('requestId') as string

    console.log('Files count:', files.length, 'RequestId:', requestId)

    // Support single file for backward compatibility
    if (files.length === 0) {
      const singleFile = formData.get('file') as File
      if (singleFile) {
        files.push(singleFile)
        console.log('Found single file for backward compatibility')
      }
    }

    if (files.length === 0 || !requestId) {
      console.error('Validation failed:', { filesCount: files.length, requestId, formDataKeys })
      return new Response(
        JSON.stringify({
          error: 'At least one file and requestId are required',
          details: {
            filesCount: files.length,
            requestId: requestId || 'missing',
            formDataKeys
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verify request exists, belongs to vendor, and is approved
    // Also get request details for email notifications
    const { data: request, error: requestError } = await supabaseClient
      .from('vendor_requests')
      .select('id, status, event_name, event_start_date, event_end_date, event_start_time, event_end_time, vendor_company_name, contact_name, contact_email, contact_phone, attendance_file_url')
      .eq('id', requestId)
      .eq('vendor_id', vendor.id)
      .single()

    if (requestError || !request) {
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (request.status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Can only upload attendance for approved requests' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get existing attendance file URLs (handle both array and single string for migration)
    let existingUrls: string[] = []
    if (request.attendance_file_url) {
      if (Array.isArray(request.attendance_file_url)) {
        existingUrls = request.attendance_file_url
      } else if (typeof request.attendance_file_url === 'string') {
        existingUrls = [request.attendance_file_url]
      }
    }

    // Validate and upload all files
    const uploadedUrls: string[] = []
    const errors: string[] = []

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_ATTENDANCE_TYPES.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        errors.push(`${file.name}: Invalid file type. Only CSV and XLSX files are allowed.`)
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size exceeds 50MB limit`)
        continue
      }

      try {
        // Generate file path
        const fileExt = file.name.split('.').pop() || 'csv'
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${vendor.id}/${requestId}/${fileName}`

        // Upload file to storage
        const fileBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabaseClient.storage
          .from('vendor-attendance')
          .upload(filePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          console.error('Storage upload error:', uploadError)
          errors.push(`${file.name}: Upload failed - ${uploadError.message}`)
          continue
        }

        // Since the bucket is private, we need to create a signed URL instead of a public URL
        // Signed URLs expire after a set time, so we use a long expiration (1 year = 31536000 seconds)
        const { data: signedUrlData, error: signedUrlError } = await supabaseClient.storage
          .from('vendor-attendance')
          .createSignedUrl(filePath, 31536000) // 1 year expiration

        if (signedUrlError || !signedUrlData) {
          console.error('Failed to create signed URL:', signedUrlError)
          errors.push(`${file.name}: Failed to create signed URL`)
          continue
        }

        uploadedUrls.push(signedUrlData.signedUrl)
      } catch (error) {
        console.error(`Error uploading ${file.name}:`, error)
        errors.push(`${file.name}: ${error instanceof Error ? error.message : 'Upload failed'}`)
      }
    }

    // If no files were uploaded successfully, return error
    if (uploadedUrls.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Failed to upload files',
          details: errors.length > 0 ? errors : ['No files were uploaded']
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Combine existing URLs with newly uploaded URLs
    const allUrls = [...existingUrls, ...uploadedUrls]

    // Update request with combined file URLs
    const uploadedAt = new Date().toISOString()
    const { data: updatedRequest, error: updateError } = await supabaseClient
      .from('vendor_requests')
      .update({
        attendance_file_url: allUrls,
        attendance_uploaded_at: uploadedAt,
      })
      .eq('id', requestId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Send email notifications (errors are caught so they don't break the upload)
    try {
      // Send confirmation email to vendor (+ notification list)
      const attendanceRecipients = collectVendorNotificationRecipients(
        request.contact_email,
        vendor.notification_emails,
      )
      if (attendanceRecipients.length > 0) {
        await sendEmailToVendorRecipients(
          attendanceRecipients,
          `Attendance File Uploaded - ${request.event_name}`,
          generateAttendanceUploadConfirmationEmail({
            event_name: request.event_name,
            event_start_date: request.event_start_date,
            event_end_date: request.event_end_date,
            event_start_time: request.event_start_time || undefined,
            event_end_time: request.event_end_time || undefined,
            contact_name: request.contact_name,
            request_id: request.id,
            uploaded_at: uploadedAt,
          }),
        )
      }

      // Send notification email to all admin users
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
            console.log(`Sending attendance upload notifications to ${adminEmails.length} admin(s)`)
            const emailPromises = adminEmails.map((email: string) =>
              sendEmail({
                to: email,
                subject: `Attendance File Uploaded - ${request.event_name}`,
                html: generateAttendanceUploadAdminNotificationEmail({
                  event_name: request.event_name,
                  event_start_date: request.event_start_date,
                  event_end_date: request.event_end_date,
                  event_start_time: request.event_start_time || undefined,
                  event_end_time: request.event_end_time || undefined,
                  vendor_company_name: request.vendor_company_name,
                  contact_name: request.contact_name,
                  contact_email: request.contact_email,
                  request_id: request.id,
                  uploaded_at: uploadedAt,
                }),
              }).catch((error) => {
                console.error(`Failed to send admin notification to ${email}:`, error)
              })
            )
            await Promise.all(emailPromises)
          } else {
            console.warn('No admin users found to send notifications to')
          }
        }
      } catch (emailError) {
        console.error('Error sending admin notification emails:', emailError)
      }
    } catch (emailError) {
      // Log error but don't fail the upload
      console.error('Error sending email notifications:', emailError)
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileUrls: uploadedUrls,
        allFileUrls: allUrls,
        errors: errors.length > 0 ? errors : undefined,
        request: updatedRequest,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

