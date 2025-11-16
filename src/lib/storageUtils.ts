import { supabase } from './supabase'

/**
 * Normalize a storage URL by replacing internal hostnames with the public Supabase URL
 * This fixes URLs that contain internal Docker hostnames like 'kong:8000'
 */
export function normalizeStorageUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return url
  }

  try {
    const urlObj = new URL(url)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''

    // Check if URL contains internal hostnames
    const isInternalHostname =
      urlObj.hostname === 'kong' ||
      urlObj.hostname === 'localhost' ||
      urlObj.hostname.includes('internal') ||
      urlObj.hostname.startsWith('127.') ||
      urlObj.hostname.startsWith('192.168.') ||
      urlObj.hostname.startsWith('10.') ||
      urlObj.hostname.includes('.local')

    if (isInternalHostname && supabaseUrl) {
      // Replace with public Supabase URL
      // Preserve query string (important for signed URLs which have tokens)
      const publicUrlObj = new URL(supabaseUrl)
      urlObj.hostname = publicUrlObj.hostname
      urlObj.port = publicUrlObj.port || ''
      urlObj.protocol = publicUrlObj.protocol
      // Query string is automatically preserved by URL object
      return urlObj.toString()
    }

    return url
  } catch (error) {
    // If URL parsing fails, return original URL
    console.warn('Failed to normalize storage URL:', error)
    return url
  }
}

/**
 * Get a signed URL for a storage file
 * This is needed for private buckets where RLS policies control access
 */
export async function getSignedUrl(bucket: string, path: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('Error creating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error in getSignedUrl:', error)
    return null
  }
}

/**
 * Extract the file path from a Supabase storage URL
 */
export function extractStoragePath(url: string, bucket: string): string | null {
  try {
    // Supabase storage URLs typically look like:
    // https://[project].supabase.co/storage/v1/object/public/[bucket]/[path]
    // or for signed URLs: https://[project].supabase.co/storage/v1/object/sign/[bucket]/[path]?token=...

    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')

    // Find the bucket index
    const bucketIndex = pathParts.indexOf(bucket)
    if (bucketIndex === -1) {
      return null
    }

    // Get everything after the bucket name
    const path = pathParts.slice(bucketIndex + 1).join('/')
    return path || null
  } catch (error) {
    console.error('Error extracting storage path:', error)
    return null
  }
}

/**
 * Get a displayable URL for a storage file
 * For private buckets, this will create a signed URL
 * For public buckets, this will return the public URL
 * Also normalizes URLs to replace internal hostnames
 */
export async function getDisplayableUrl(url: string, bucket: string): Promise<string> {
  if (!url || typeof url !== 'string') {
    return url
  }

  // First normalize the URL to fix internal hostnames
  const normalizedUrl = normalizeStorageUrl(url)

  // Check if it's a Supabase storage URL
  if (normalizedUrl.includes('/storage/v1/object/')) {
    // If it's already a signed URL (has /sign/ in path and token in query), just normalize and return
    if (normalizedUrl.includes('/storage/v1/object/sign/') && normalizedUrl.includes('token=')) {
      return normalizedUrl
    }

    // If it's a public URL but bucket is private, we need to create a signed URL
    // Extract path and create signed URL for private buckets
    const path = extractStoragePath(normalizedUrl, bucket)
    if (path) {
      const signedUrl = await getSignedUrl(bucket, path, 3600) // 1 hour expiration for display
      if (signedUrl) {
        return normalizeStorageUrl(signedUrl)
      }
    }
  }

  // Fallback to normalized URL
  return normalizedUrl
}

