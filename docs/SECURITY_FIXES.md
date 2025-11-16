# Security Fixes - Quick Implementation Guide

This document provides step-by-step instructions to fix the critical security issues identified in the security audit.

---

## 1. Fix CORS Configuration

### Files to Update:
- `supabase/functions/vendor-requests/index.ts`
- `supabase/functions/vendor-upload/index.ts`
- `supabase/functions/vendor-upload-poster/index.ts`
- `supabase/functions/vendor-info/index.ts`

### Implementation:

```typescript
// Add at top of file
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'http://localhost:5173',
  'https://yourdomain.com'
]

// Replace corsHeaders definition
const corsHeaders = (req: Request) => {
  const origin = req.headers.get('origin')
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || 'https://yourdomain.com'

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}

// Update usage in serve() function
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) })
  }

  // ... rest of code, use corsHeaders(req) instead of corsHeaders
})
```

### Environment Variable:
Add to your `.env` or deployment config:
```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

---

## 2. Remove User IDs from Error Messages

### Files to Update:
- `supabase/functions/vendor-requests/index.ts`
- `supabase/functions/vendor-upload/index.ts`
- `supabase/functions/vendor-upload-poster/index.ts`
- `src/lib/vendorApiClient.ts`

### Implementation:

**In Edge Functions:**
```typescript
// BEFORE:
return new Response(
  JSON.stringify({
    error: 'Vendor record not found',
    details: vendorError?.message || 'No vendor record found for this user',
    userId: user.id,  // ❌ REMOVE THIS
  }),
  { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)

// AFTER:
// Log detailed error server-side only
console.error('Vendor lookup failed:', {
  userId: user.id,
  userEmail: user.email,
  vendorError: vendorError,
})

// Return generic error to client
return new Response(
  JSON.stringify({
    error: 'Vendor record not found',
    // Don't include userId or email
  }),
  { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)
```

**In vendorApiClient.ts:**
```typescript
// BEFORE:
throw new Error(`Vendor account not set up. User ID: ${userId}. Please ensure...`)

// AFTER:
throw new Error('Vendor account not set up. Please contact support if you believe this is an error.')
```

---

## 3. Sanitize Email Template Inputs

### File to Update:
- `supabase/functions/vendor-requests/email.ts`

### Implementation:

```typescript
// Add helper function at top of file
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (m) => map[m])
}

// Update email templates to use escapeHtml():
// BEFORE:
<p>Dear ${request.contact_name},</p>
<p><strong>Event Name:</strong> ${request.event_name}</p>

// AFTER:
<p>Dear ${escapeHtml(request.contact_name)},</p>
<p><strong>Event Name:</strong> ${escapeHtml(request.event_name)}</p>
```

---

## 4. Add File Content Validation (Magic Bytes)

### Files to Update:
- `supabase/functions/vendor-upload/index.ts`
- `supabase/functions/vendor-upload-poster/index.ts`

### Implementation:

**For vendor-upload-poster (images):**
```typescript
// Add validation function
async function validateImageContent(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 12))

  // JPEG: FF D8 FF
  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 &&
                bytes[2] === 0x4E && bytes[3] === 0x47

  // GIF: 47 49 46 38
  const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 &&
                bytes[2] === 0x46 && bytes[3] === 0x38

  // WebP: Check for RIFF header and WEBP
  const isWebP = bytes[0] === 0x52 && bytes[1] === 0x49 &&
                 bytes[2] === 0x46 && bytes[3] === 0x46 &&
                 new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'

  return isJPEG || isPNG || isGIF || isWebP
}

// Add validation after MIME type check:
if (!ALLOWED_POSTER_TYPES.includes(file.type)) {
  return new Response(
    JSON.stringify({ error: 'Invalid file type. Only image files (JPEG, PNG, GIF, WebP) are allowed.' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Add content validation
const isValidImage = await validateImageContent(file)
if (!isValidImage) {
  return new Response(
    JSON.stringify({ error: 'Invalid file content. File does not match declared type.' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

**For vendor-upload (CSV/XLSX):**
```typescript
// Add validation function
async function validateSpreadsheetContent(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 8))

  // XLSX: 50 4B 03 04 (ZIP signature)
  const isXLSX = bytes[0] === 0x50 && bytes[1] === 0x4B &&
                 bytes[2] === 0x03 && bytes[3] === 0x04

  // CSV: Check if it's text content
  const textDecoder = new TextDecoder('utf-8', { fatal: false })
  const text = textDecoder.decode(buffer.slice(0, 1024))
  const isCSV = /^[\x20-\x7E\s]*$/.test(text) && text.includes(',')

  return isXLSX || isCSV
}

// Add validation after MIME type check:
const isValidSpreadsheet = await validateSpreadsheetContent(file)
if (!isValidSpreadsheet) {
  return new Response(
    JSON.stringify({ error: 'Invalid file content. File does not match declared type.' }),
    { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
```

---

## 5. Hide Stack Traces in Production

### File to Update:
- `src/components/ErrorBoundary.tsx`

### Implementation:

```typescript
// BEFORE:
{this.state.error && (
  <details className="mt-4">
    <summary className="cursor-pointer text-sm text-gray-600">Error details</summary>
    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
      {this.state.error.stack}
    </pre>
  </details>
)}

// AFTER:
{this.state.error && import.meta.env.DEV && (
  <details className="mt-4">
    <summary className="cursor-pointer text-sm text-gray-600">Error details (dev only)</summary>
    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
      {this.state.error.stack}
    </pre>
  </details>
)}
```

---

## 6. Remove Sensitive Data from Console Logs

### Files to Update:
- All edge functions

### Implementation:

```typescript
// Add at top of file
const isProduction = Deno.env.get('ENVIRONMENT') === 'production'

// BEFORE:
console.error('Vendor lookup failed:', {
  userId: user.id,
  userEmail: user.email,
  vendorError: vendorError,
})

// AFTER:
if (!isProduction) {
  console.error('Vendor lookup failed:', {
    userId: user.id,
    userEmail: user.email,
    vendorError: vendorError,
  })
} else {
  // Production: log only non-sensitive info
  console.error('Vendor lookup failed:', {
    vendorError: vendorError?.message,
    // Don't log userId or email
  })
}
```

---

## 7. Add Rate Limiting

### Implementation Option 1: Simple In-Memory (for single instance)

```typescript
// Add at top of edge function file
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  userLimit.count++
  return true
}

// Use in serve() function:
const { data: { user } } = await userClient.auth.getUser()
if (authError || !user) {
  return new Response(
    JSON.stringify({ error: 'Unauthorized' }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// Add rate limiting check
if (!checkRateLimit(user.id)) {
  return new Response(
    JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': '60'
      }
    }
  )
}
```

### Implementation Option 2: Using Deno KV (recommended for production)

```typescript
// Requires Deno KV setup
const kv = await Deno.openKv()

async function checkRateLimit(userId: string): Promise<boolean> {
  const key = ['ratelimit', userId]
  const limit = await kv.get<{ count: number; resetAt: number }>(key)
  const now = Date.now()

  if (!limit.value || now > limit.value.resetAt) {
    await kv.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (limit.value.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false
  }

  await kv.set(key, { count: limit.value.count + 1, resetAt: limit.value.resetAt })
  return true
}
```

---

## 8. Add Security Headers

### Files to Update:
- All edge functions

### Implementation:

```typescript
// Add security headers helper
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// Merge with corsHeaders:
const corsHeaders = (req: Request) => {
  const origin = req.headers.get('origin')
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0] || 'https://yourdomain.com'

  return {
    ...securityHeaders,
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Credentials': 'true',
  }
}
```

---

## 9. Add Strict Status Validation

### File to Update:
- `supabase/functions/vendor-requests/index.ts`

### Implementation:

```typescript
// Add constant at top
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const

// Update status handling:
const { searchParams } = url
const status = searchParams.get('status')

if (status) {
  if (!VALID_STATUSES.includes(status as any)) {
    return new Response(
      JSON.stringify({ error: 'Invalid status parameter. Must be one of: pending, approved, rejected, withdrawn' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  query = query.eq('status', status)
}
```

---

## Testing Checklist

After implementing fixes, test:

- [ ] CORS: Try accessing API from unauthorized origin (should fail)
- [ ] Error messages: Check that user IDs are not exposed
- [ ] Email templates: Try submitting request with `<script>` tags in fields
- [ ] File upload: Try uploading executable file with .jpg extension
- [ ] Stack traces: Verify not shown in production build
- [ ] Rate limiting: Make 100+ requests quickly (should get 429)
- [ ] Security headers: Check response headers in browser dev tools

---

## Deployment Notes

1. **Environment Variables:**
   - Add `ALLOWED_ORIGINS` to your deployment environment
   - Add `ENVIRONMENT=production` for production deployments

2. **Deno KV (if using for rate limiting):**
   - Ensure Deno KV is enabled in your Supabase/Deno Deploy setup
   - Or use Redis/external service for distributed rate limiting

3. **Testing:**
   - Test all fixes in staging environment first
   - Verify no functionality is broken
   - Check error handling still works correctly

---

*Last updated: [DATE]*


