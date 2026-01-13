# Security Audit Report - January 2025

**Date:** 2025-01-XX
**Project:** HKRA Vendor CPD Portal
**Auditor:** Automated Security Scan
**Scope:** Full codebase security review

---

## Executive Summary

This security audit identified **9 critical issues**, **4 high-risk issues**, and **3 medium-risk issues**. While the codebase demonstrates good security practices in several areas (no hardcoded credentials, proper use of environment variables, RLS policies), significant vulnerabilities exist that must be addressed before production deployment.

**Overall Security Rating:** 🟡 **MEDIUM** (will be 🟢 **GOOD** after critical fixes)

---

## Dependency Security ✅

**Status:** ✅ **PASS** (No vulnerabilities found)

- All dependencies scanned using `bun audit`
- No known vulnerabilities in package dependencies
- Dependencies are up-to-date

---

## Critical Security Issues 🔴

### 1. CORS Configuration - Overly Permissive

**Severity:** 🔴 **CRITICAL**

**Location:**
- `supabase/functions/vendor-requests/index.ts:14-16`
- `supabase/functions/vendor-upload/index.ts:14-16`
- `supabase/functions/vendor-upload-poster/index.ts:13-15`
- `supabase/functions/vendor-info/index.ts:13-15`

**Issue:**
All edge functions use `Access-Control-Allow-Origin: *`, allowing any website to make requests to your API endpoints.

**Vulnerable Code:**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

**Risk:**
- Any malicious website can make authenticated requests if a user is logged into your application
- CSRF attacks become easier
- Data exfiltration possible
- Privacy violations

**Recommendation:**
Restrict CORS to specific allowed origins:
```typescript
const ALLOWED_ORIGINS = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
  'http://localhost:5173',
  'https://yourdomain.com'
]

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
```

**Priority:** Fix immediately before production deployment

---

### 2. User ID and Email Exposure in Error Messages

**Severity:** 🔴 **CRITICAL**

**Location:**
- `supabase/functions/vendor-requests/index.ts:87-94`
- `supabase/functions/vendor-upload/index.ts:89-96`
- `supabase/functions/vendor-upload-poster/index.ts:99-106`
- `src/lib/vendorApiClient.ts:78-79, 189-190`

**Issue:**
Error responses include user IDs and email addresses, enabling user enumeration attacks.

**Vulnerable Code:**
```typescript
return new Response(
  JSON.stringify({
    error: 'Vendor record not found',
    details: vendorError?.message || 'No vendor record found for this user',
    userId: user.id, // ⚠️ EXPOSES USER ID
  }),
  { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
)
```

**Risk:**
- User enumeration attacks
- Information disclosure
- Privacy violations (GDPR concerns)
- Helps attackers identify valid user accounts

**Recommendation:**
Remove sensitive information from error responses:
```typescript
// Log detailed errors server-side only
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

**Priority:** Fix immediately

---

### 3. XSS Vulnerability in Email Templates

**Severity:** 🔴 **CRITICAL**

**Location:**
- `supabase/functions/vendor-requests/email.ts` (multiple locations)

**Issue:**
User-controlled input is directly inserted into HTML email templates without sanitization.

**Vulnerable Code:**
```typescript
<p>Dear ${request.contact_name},</p>
<p><strong>Event Name:</strong> ${request.event_name}</p>
<p><strong>Contact Email:</strong> <a href="mailto:${request.contact_email}">${request.contact_email}</a></p>
```

**Risk:**
- If email clients render HTML, malicious scripts could execute
- Email-based XSS attacks
- Phishing attacks
- Data exfiltration through malicious email content

**Recommendation:**
Sanitize all user input before inserting into HTML:
```typescript
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

// Use in templates:
<p>Dear ${escapeHtml(request.contact_name)},</p>
<p><strong>Event Name:</strong> ${escapeHtml(request.event_name)}</p>
```

**Priority:** Fix before production

---

### 4. File Upload - Missing Content Validation (Magic Bytes)

**Severity:** 🔴 **CRITICAL**

**Location:**
- `supabase/functions/vendor-upload/index.ts:177-180`
- `supabase/functions/vendor-upload-poster/index.ts:134-137`

**Issue:**
File uploads are validated by MIME type and extension, but not by actual file content (magic bytes/file signatures). Attackers can rename malicious files or spoof MIME types.

**Vulnerable Code:**
```typescript
if (!ALLOWED_ATTENDANCE_TYPES.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
  errors.push(`${file.name}: Invalid file type. Only CSV and XLSX files are allowed.`)
  continue
}
```

**Risk:**
- Malicious files uploaded with spoofed MIME types
- Executable files disguised as images/CSV
- Server-side code execution if files are processed unsafely
- Malware distribution

**Recommendation:**
Add magic byte validation:
```typescript
// For images (posters)
async function validateImageContent(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 12))

  // JPEG: FF D8 FF
  const isJPEG = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF

  // PNG: 89 50 4E 47
  const isPNG = bytes[0] === 0x89 && bytes[1] === 0x50 &&
                bytes[2] === 0x4E && bytes[3] === 0x47

  // GIF: 47 49 46 38
  const isGIF = bytes[0] === 0x47 && bytes[1] === 0x49 &&
                bytes[2] === 0x46 && bytes[3] === 0x38

  return isJPEG || isPNG || isGIF
}

// For CSV/XLSX (attendance)
async function validateSpreadsheetContent(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer.slice(0, 8))

  // XLSX: 50 4B 03 04 (ZIP signature)
  const isXLSX = bytes[0] === 0x50 && bytes[1] === 0x4B &&
                 bytes[2] === 0x03 && bytes[3] === 0x04

  // For CSV, check if it's mostly text
  const textDecoder = new TextDecoder('utf-8', { fatal: false })
  const text = textDecoder.decode(buffer.slice(0, 1024))
  const isCSV = /^[\x20-\x7E\s]*$/.test(text) && text.includes(',')

  return isXLSX || isCSV
}
```

**Priority:** Fix before production

---

### 5. Error Stack Traces Exposed to Users

**Severity:** 🔴 **CRITICAL**

**Location:**
- `src/components/ErrorBoundary.tsx:40-46`

**Issue:**
Error boundary exposes full stack traces to users in production.

**Vulnerable Code:**
```typescript
{this.state.error && (
  <details className="mt-4">
    <summary className="cursor-pointer text-sm text-muted-foreground">Error details</summary>
    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto text-muted-foreground">
      {this.state.error.stack} // ⚠️ EXPOSES STACK TRACE
    </pre>
  </details>
)}
```

**Risk:**
- Information disclosure (file paths, internal structure)
- Helps attackers understand application architecture
- May expose sensitive paths or configuration
- Reveals technology stack and versions

**Recommendation:**
Only show stack traces in development:
```typescript
{this.state.error && import.meta.env.DEV && (
  <details className="mt-4">
    <summary className="cursor-pointer text-sm text-muted-foreground">Error details (dev only)</summary>
    <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto text-muted-foreground">
      {this.state.error.stack}
    </pre>
  </details>
)}
```

**Priority:** Fix immediately

---

### 6. Console Logging Sensitive Information

**Severity:** 🔴 **CRITICAL**

**Location:**
- Multiple edge functions log user IDs and emails

**Issue:**
Console logs in production may expose sensitive information that could be accessible through log aggregation services.

**Vulnerable Code:**
```typescript
console.error('Vendor lookup failed:', {
  userId: user.id, // ⚠️ Sensitive
  userEmail: user.email, // ⚠️ Sensitive
  vendorError: vendorError,
})
```

**Risk:**
- Log files may be accessible
- Log aggregation services may expose data
- Compliance violations (GDPR, etc.)
- Data breaches through log access

**Recommendation:**
Remove sensitive data from logs in production:
```typescript
const isProduction = Deno.env.get('ENVIRONMENT') === 'production'

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

**Priority:** Fix before production

---

### 7. Missing Rate Limiting

**Severity:** 🔴 **CRITICAL**

**Location:**
- All edge functions

**Issue:**
No rate limiting implemented on API endpoints.

**Risk:**
- Brute force attacks on authentication
- DDoS attacks
- Resource exhaustion
- Cost escalation (if using pay-per-use services)
- API abuse

**Recommendation:**
Implement rate limiting:
```typescript
// Simple in-memory rate limiting (for single instance)
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

// Use in serve() function after authentication
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

**Priority:** Implement before production

---

### 8. Missing Security Headers

**Severity:** 🔴 **CRITICAL**

**Location:**
- All edge functions

**Issue:**
No security headers set in responses (CSP, X-Frame-Options, etc.).

**Risk:**
- Clickjacking attacks
- MIME type sniffing attacks
- XSS attacks
- Man-in-the-middle attacks

**Recommendation:**
Add security headers:
```typescript
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
}

// Merge with corsHeaders
const corsHeaders = (req: Request) => {
  // ... CORS logic ...
  return {
    ...securityHeaders,
    'Access-Control-Allow-Origin': allowedOrigin,
    // ... other headers ...
  }
}
```

**Priority:** Fix before production

---

### 9. XSS Risk via innerHTML Usage

**Severity:** 🔴 **CRITICAL**

**Location:**
- `src/pages/admin/AdminRequestDetail.tsx:376`

**Issue:**
Direct `innerHTML` assignment without sanitization, though the content appears to be controlled.

**Vulnerable Code:**
```typescript
parent.innerHTML = `
  <div class="p-8 border rounded-lg bg-muted text-center">
    <p class="text-sm text-muted-foreground mb-4">File ${index + 1} could not be loaded</p>
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline inline-flex items-center gap-2">
      ...
    </a>
  </div>
`
```

**Risk:**
- If `url` or `index` is user-controlled, XSS is possible
- Even if controlled, innerHTML is risky practice

**Recommendation:**
Use React components instead of innerHTML, or sanitize if necessary:
```typescript
// Better: Use React state to conditionally render
// Or sanitize URL:
const sanitizedUrl = url.replace(/[<>"']/g, '')
```

**Priority:** Fix before production

---

## High-Risk Security Issues 🟠

### 1. Service Role Key Usage Pattern

**Severity:** 🟠 **HIGH**

**Location:**
- All edge functions use service role key

**Issue:**
Edge functions use service role key to bypass RLS, which is necessary but risky if misused.

**Current Status:** ✅ Properly implemented with user validation

**Recommendation:**
- Continue current pattern (validate user first, then use service role)
- Document why service role is needed
- Consider creating a custom role with limited permissions instead
- Regular code reviews to ensure proper authorization checks

---

### 2. File Path Traversal Risk

**Severity:** 🟠 **HIGH**

**Location:**
- `supabase/functions/vendor-upload/index.ts:192`
- `supabase/functions/vendor-upload-poster/index.ts:149`

**Issue:**
File paths are constructed from user input (requestId).

**Vulnerable Code:**
```typescript
const filePath = `${vendor.id}/${requestId}/${fileName}`
```

**Current Status:** ✅ Protected by vendor_id validation, but should sanitize requestId

**Recommendation:**
Validate requestId format:
```typescript
// Ensure requestId is a valid UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
if (!UUID_REGEX.test(requestId)) {
  return new Response(JSON.stringify({ error: 'Invalid request ID format' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

---

### 3. Missing CSRF Protection

**Severity:** 🟠 **HIGH**

**Issue:**
No CSRF tokens implemented for state-changing operations.

**Risk:**
- Cross-site request forgery attacks
- Unauthorized actions performed on behalf of users

**Recommendation:**
- Implement CSRF tokens for POST/PATCH/DELETE requests
- Use SameSite cookies
- Verify Origin header
- Consider using Supabase's built-in CSRF protection

---

### 4. Missing Input Sanitization for Status Parameter

**Severity:** 🟠 **HIGH**

**Location:**
- `supabase/functions/vendor-requests/index.ts:155-157`

**Issue:**
Status parameter validation could be stricter.

**Vulnerable Code:**
```typescript
if (status) {
  query = query.eq('status', status)
}
```

**Current Status:** ✅ Actually safe - Supabase client handles this, but validation should be stricter

**Recommendation:**
Add strict validation:
```typescript
const VALID_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
const status = searchParams.get('status')

if (status && VALID_STATUSES.includes(status as any)) {
  query = query.eq('status', status)
} else if (status) {
  return new Response(JSON.stringify({ error: 'Invalid status parameter' }), {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

---

## Medium-Risk Security Issues 🟡

### 1. File Size Limits May Be Too Large

**Severity:** 🟡 **MEDIUM**

**Location:**
- `supabase/functions/vendor-upload/index.ts:19`
- `supabase/functions/vendor-upload-poster/index.ts:18`

**Issue:**
50MB limit may be too large for some use cases and could cause memory issues.

**Recommendation:**
- Consider reducing limit for posters (e.g., 10MB)
- Keep 50MB for attendance files if needed
- Document limits clearly
- Consider streaming uploads for large files

---

### 2. Memory Exhaustion Risk via File Upload

**Severity:** 🟡 **MEDIUM**

**Location:**
- `supabase/functions/vendor-upload/index.ts:195`
- `supabase/functions/vendor-upload-poster/index.ts:152`

**Issue:**
Files are read entirely into memory using `await file.arrayBuffer()`. Edge Functions typically have limited memory (e.g., 128MB).

**Risk:**
- Concurrent uploads of large files could cause OOM
- Denial of Service

**Recommendation:**
- Reduce `MAX_FILE_SIZE` to a safer limit (e.g., 10MB)
- If large files are required, investigate streaming the upload directly to Supabase Storage without buffering

---

### 3. Password Policy Not Enforced

**Severity:** 🟡 **MEDIUM**

**Location:**
- Supabase Auth (not in codebase)

**Issue:**
No password complexity requirements visible in code.

**Recommendation:**
- Configure Supabase Auth password policy
- Enforce minimum length, complexity requirements
- Implement password strength meter in UI
- Consider implementing password expiration policies

---

## Positive Security Practices ✅

1. ✅ **No hardcoded credentials** - All secrets use environment variables
2. ✅ **Row Level Security (RLS)** - Properly implemented in database
3. ✅ **Input validation** - Zod schemas on frontend, validation on backend
4. ✅ **Authentication required** - All endpoints check for valid auth token
5. ✅ **Vendor isolation** - Vendors can only access their own data
6. ✅ **File type validation** - MIME type checking implemented
7. ✅ **File size limits** - Maximum file sizes enforced
8. ✅ **Parameterized queries** - Using Supabase client (safe from SQL injection)
9. ✅ **Environment variable protection** - `.gitignore` properly configured
10. ✅ **No dependency vulnerabilities** - All packages scanned and clean

---

## Recommendations Summary

### Immediate Actions (Before Production):

1. 🔴 Fix CORS configuration - restrict to specific origins
2. 🔴 Remove user IDs/emails from error messages
3. 🔴 Sanitize email template inputs (XSS protection)
4. 🔴 Add file content validation (magic bytes)
5. 🔴 Hide stack traces in production
6. 🔴 Remove sensitive data from console logs
7. 🔴 Implement rate limiting
8. 🔴 Add security headers
9. 🔴 Fix innerHTML usage

### High Priority (Before Production):

1. 🟠 Add CSRF protection
2. 🟠 Validate file path inputs more strictly
3. 🟠 Add strict status parameter validation

### Medium Priority (Post-Launch):

1. 🟡 Review password policies
2. 🟡 Review file size limits
3. 🟡 Consider streaming for large file uploads

---

## Security Checklist

- [ ] CORS restricted to specific origins
- [ ] User IDs removed from error responses
- [ ] Email templates sanitize HTML
- [ ] File uploads validate magic bytes
- [ ] Stack traces hidden in production
- [ ] Sensitive data removed from logs
- [ ] Rate limiting implemented
- [ ] CSRF protection added
- [ ] Security headers configured
- [ ] File path validation strengthened
- [ ] Status parameter validation added
- [ ] innerHTML usage fixed
- [ ] Password policy configured

---

## Testing Recommendations

1. **Penetration Testing:**
   - Test file upload with spoofed MIME types
   - Test CORS with malicious origins
   - Test rate limiting
   - Test CSRF attacks
   - Test XSS in email templates

2. **Security Scanning:**
   - Use tools like OWASP ZAP or Burp Suite
   - Scan for common vulnerabilities
   - Check dependencies for known CVEs (already done ✅)

3. **Code Review:**
   - Review all user input handling
   - Review authentication/authorization logic
   - Review error handling

---

## Conclusion

The codebase demonstrates good security practices in several areas, particularly around credential management and database security. However, critical vulnerabilities exist around CORS, error message exposure, XSS protection, and file upload validation that must be addressed before production deployment. The recommended fixes are straightforward to implement and will significantly improve the security posture of the application.

**Next Steps:**
1. Prioritize fixing all critical issues
2. Implement high-priority fixes
3. Conduct security testing after fixes
4. Schedule regular security audits (quarterly recommended)

---

_This audit was performed on January 2025. Regular security audits should be conducted quarterly or after significant changes._

