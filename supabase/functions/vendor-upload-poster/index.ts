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

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const ALLOWED_POSTER_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
]

function isAllowedPosterFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  if (ALLOWED_POSTER_TYPES.includes(file.type)) return true
  if (lower.endsWith('.pdf')) return true
  return (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp')
  )
}

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
    // Get public Supabase URL for generating public URLs
    // Use PUBLIC_SUPABASE_URL if available, otherwise fall back to SUPABASE_URL
    // PUBLIC_SUPABASE_URL should be set to the public-facing URL (e.g., https://supabase.hkra.org.hk)
    const PUBLIC_SUPABASE_URL = Deno.env.get('PUBLIC_SUPABASE_URL') || SUPABASE_URL

    // Create Supabase client with service role key to bypass RLS
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    )

    // Create a separate client with public URL for generating public URLs
    const publicUrlClient = createClient(
      PUBLIC_SUPABASE_URL,
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
      .select('id')
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
    const files = formData.getAll('files') as File[]

    // Support single file for backward compatibility
    if (files.length === 0) {
      const singleFile = formData.get('file') as File
      if (singleFile) {
        files.push(singleFile)
      }
    }

    if (files.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate and upload all files
    const uploadedUrls: string[] = []
    const errors: string[] = []

    for (const file of files) {
      // Validate file type
      if (!isAllowedPosterFile(file)) {
        errors.push(`${file.name}: Invalid file type. Only images (JPEG, PNG, GIF, WebP) or PDF are allowed.`)
        continue
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size exceeds 50MB limit`)
        continue
      }

      try {
        // Generate file path
        const fileExt = file.name.split('.').pop() || 'jpg'
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${vendor.id}/${fileName}`

        // Upload file to storage using service role client
        const fileBuffer = await file.arrayBuffer()
        const { error: uploadError } = await supabaseClient.storage
          .from('vendor-posters')
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
          .from('vendor-posters')
          .createSignedUrl(filePath, 31536000) // 1 year expiration

        if (signedUrlError || !signedUrlData) {
          console.error('Failed to create signed URL:', signedUrlError)
          // Fallback to public URL if signed URL creation fails
          const { data: urlData } = publicUrlClient.storage
            .from('vendor-posters')
            .getPublicUrl(filePath)

          uploadedUrls.push(urlData.publicUrl)
          continue
        }

        // Normalize the signed URL to ensure it uses the public URL, not internal hostnames
        let fileUrl = signedUrlData.signedUrl

        // Always check and normalize URLs that contain internal hostnames
        try {
          const urlObj = new URL(fileUrl)
          const isInternalHostname =
            urlObj.hostname === 'kong' ||
            urlObj.hostname === 'localhost' ||
            urlObj.hostname.includes('internal') ||
            urlObj.hostname.startsWith('127.') ||
            urlObj.hostname.startsWith('192.168.') ||
            urlObj.hostname.startsWith('10.')

          if (isInternalHostname) {
            // If PUBLIC_SUPABASE_URL is set and different, use it
            if (PUBLIC_SUPABASE_URL && PUBLIC_SUPABASE_URL !== SUPABASE_URL) {
              const publicUrlObj = new URL(PUBLIC_SUPABASE_URL)
              urlObj.hostname = publicUrlObj.hostname
              urlObj.port = publicUrlObj.port || ''
              urlObj.protocol = publicUrlObj.protocol
              fileUrl = urlObj.toString()
            } else {
              // If PUBLIC_SUPABASE_URL is not set, try to construct from SUPABASE_URL
              // by replacing internal hostname patterns
              // This is a fallback - ideally PUBLIC_SUPABASE_URL should be set
              console.warn('PUBLIC_SUPABASE_URL not set, URL may contain internal hostname:', fileUrl)
              // Keep original URL but log warning
            }
          }
        } catch (e) {
          // If URL parsing fails, log and continue with original URL
          console.warn('Failed to normalize URL:', e)
        }

        uploadedUrls.push(fileUrl)
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`)
      }
    }

    // Return results
    if (uploadedUrls.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Failed to upload files',
          details: errors,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileUrls: uploadedUrls, // Return array of URLs
        errors: errors.length > 0 ? errors : undefined, // Include any errors if some files failed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in vendor-upload-poster:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

