# Security Audit Report

**Date:** 2025-01-XX
**Project:** HKRA Vendor CPD Portal
**Scope:** Full codebase security review including credential leakage, authentication, authorization, input validation, and file upload security

---

## Executive Summary

This security audit identified **8 critical issues**, **5 high-risk issues**, and **3 medium-risk issues**. The project demonstrates good security practices in several areas (no hardcoded credentials, proper use of environment variables, RLS policies), but has significant vulnerabilities that need immediate attention, particularly around CORS configuration, error message exposure, and XSS protection.

---

## 1. Credential Leakage Assessment ✅

### Status: **PASS** (No credentials found in codebase)

**Findings:**

- ✅ No hardcoded API keys, passwords, or tokens found in source code
- ✅ Environment variables properly used throughout the codebase
- ✅ `.gitignore` correctly excludes `.env` files
- ✅ Edge functions use `Deno.env.get()` for environment variables
- ✅ Frontend uses `import.meta.env` for Vite environment variables

**Recommendations:**

- ✅ Continue using environment variables for all secrets
- ✅ Ensure `.env` files are never committed to version control
- ✅ Consider using a secrets management service for production (e.g., AWS Secrets Manager, HashiCorp Vault)

---

## 2. Critical Security Issues 🔴

### 2.1 CORS Configuration - Overly Permissive

**Severity:** 🔴 **CRITICAL**

**Location:**

- `supabase/functions/vendor-requests/index.ts:14-16`
- `supabase/functions/vendor-upload/index.ts:13-15`
- `supabase/functions/vendor-upload-poster/index.ts:13-15`
- `supabase/functions/vendor-info/index.ts:13-15`

**Issue:**

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

All edge functions use `Access-Control-Allow-Origin: *`, allowing any website to make requests to your API endpoints.

**Risk:**

- Any malicious website can make authenticated requests if a user is logged into your application
- CSRF attacks become easier
- Data exfiltration possible

**Recommendation:**

```typescript
// Use environment variable for allowed origins
const ALLOWED_ORIGINS = Deno.env.get("ALLOWED_ORIGINS")?.split(",") || [];
const origin = req.headers.get("origin");

const corsHeaders = {
  "Access-Control-Allow-Origin":
    origin && ALLOWED_ORIGINS.includes(origin)
      ? origin
      : ALLOWED_ORIGINS[0] || "https://yourdomain.com",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Credentials": "true",
};
```

**Priority:** Fix immediately before production deployment

---

### 2.2 User ID Exposure in Error Messages

**Severity:** 🔴 **CRITICAL**

**Location:**

- `supabase/functions/vendor-requests/index.ts:82-87`
- `supabase/functions/vendor-upload/index.ts:88-95`
- `supabase/functions/vendor-upload-poster/index.ts:88-95`
- `src/lib/vendorApiClient.ts:78-79, 172-173`

**Issue:**
Error responses include user IDs and email addresses:

```typescript
return new Response(
  JSON.stringify({
    error: "Vendor record not found",
    details: vendorError?.message || "No vendor record found for this user",
    userId: user.id, // ⚠️ EXPOSES USER ID
  }),
  {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  }
);
```

**Risk:**

- User enumeration attacks
- Information disclosure
- Privacy violations (GDPR concerns)

**Recommendation:**
Remove sensitive information from error responses:

```typescript
// In production, use generic error messages
return new Response(
  JSON.stringify({
    error: "Vendor record not found",
    // Don't include userId or email in production
  }),
  {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  }
);

// Log detailed errors server-side only
console.error("Vendor lookup failed:", {
  userId: user.id,
  userEmail: user.email,
  vendorError: vendorError,
});
```

**Priority:** Fix immediately

---

### 2.3 XSS Vulnerability in Email Templates

**Severity:** 🔴 **CRITICAL**

**Location:**

- `supabase/functions/vendor-requests/email.ts:86, 92-95, 175`

**Issue:**
User-controlled input is directly inserted into HTML email templates without sanitization:

```typescript
<p>Dear ${request.contact_name},</p>
<p><strong>Event Name:</strong> ${request.event_name}</p>
<p><strong>Contact Email:</strong> <a href="mailto:${request.contact_email}">${request.contact_email}</a></p>
```

**Risk:**

- If email clients render HTML, malicious scripts could execute
- Email-based XSS attacks
- Phishing attacks

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

### 2.4 File Upload - Missing Content Validation

**Severity:** 🔴 **CRITICAL**

**Location:**

- `supabase/functions/vendor-upload/index.ts:110-116`
- `supabase/functions/vendor-upload-poster/index.ts:109-115`

**Issue:**
File uploads are validated by MIME type and extension, but not by actual file content (magic bytes/file signatures). Attackers can rename malicious files or spoof MIME types.

**Risk:**

- Malicious files uploaded with spoofed MIME types
- Executable files disguised as images/CSV
- Server-side code execution if files are processed unsafely

**Recommendation:**
Add magic byte validation:

```typescript
// For images (posters)
async function validateImageFile(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 12));

  // JPEG: FF D8 FF
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  // GIF: 47 49 46 38
  // WebP: RIFF ... WEBP

  const isJPEG = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPNG =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const isGIF =
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38;

  return isJPEG || isPNG || isGIF;
}

// For CSV/XLSX (attendance)
async function validateSpreadsheetFile(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer.slice(0, 8));

  // CSV: Check for text content
  // XLSX: 50 4B 03 04 (ZIP signature, XLSX is a ZIP archive)

  const isXLSX =
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04;

  // For CSV, check if it's mostly text
  const textDecoder = new TextDecoder("utf-8", { fatal: false });
  const text = textDecoder.decode(buffer.slice(0, 1024));
  const isCSV = /^[\x20-\x7E\s]*$/.test(text) && text.includes(",");

  return isXLSX || isCSV;
}
```

**Priority:** Fix before production

---

### 2.5 Error Stack Traces Exposed to Users

**Severity:** 🔴 **CRITICAL**

**Location:**

- `src/components/ErrorBoundary.tsx:40-46`

**Issue:**
Error boundary exposes full stack traces to users:

```typescript
{
  this.state.error && (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm text-gray-600">
        Error details
      </summary>
      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
        {this.state.error.stack} // ⚠️ EXPOSES STACK TRACE
      </pre>
    </details>
  );
}
```

**Risk:**

- Information disclosure (file paths, internal structure)
- Helps attackers understand application architecture
- May expose sensitive paths or configuration

**Recommendation:**
Only show stack traces in development:

```typescript
{
  this.state.error && import.meta.env.DEV && (
    <details className="mt-4">
      <summary className="cursor-pointer text-sm text-gray-600">
        Error details (dev only)
      </summary>
      <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
        {this.state.error.stack}
      </pre>
    </details>
  );
}
```

**Priority:** Fix immediately

---

### 2.6 Console Logging Sensitive Information

**Severity:** 🔴 **CRITICAL**

**Location:**

- Multiple edge functions log user IDs and emails

**Issue:**
Console logs in production may expose sensitive information:

```typescript
console.error("Vendor lookup failed:", {
  userId: user.id, // ⚠️ Sensitive
  userEmail: user.email, // ⚠️ Sensitive
  vendorError: vendorError,
  vendorData: vendor,
});
```

**Risk:**

- Log files may be accessible
- Log aggregation services may expose data
- Compliance violations (GDPR, etc.)

**Recommendation:**

- Remove sensitive data from logs in production
- Use structured logging with log levels
- Implement log sanitization

```typescript
// Use environment-based logging
const isProduction = Deno.env.get("ENVIRONMENT") === "production";

if (!isProduction) {
  console.error("Vendor lookup failed:", {
    userId: user.id,
    userEmail: user.email,
    vendorError: vendorError,
  });
} else {
  // Production: log only non-sensitive info
  console.error("Vendor lookup failed:", {
    vendorError: vendorError?.message,
    // Don't log userId or email
  });
}
```

**Priority:** Fix before production

---

### 2.7 Missing Rate Limiting

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

**Recommendation:**
Implement rate limiting:

```typescript
// Use Deno KV or Redis for rate limiting
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

async function checkRateLimit(userId: string): Promise<boolean> {
  // Implement rate limiting logic
  // Return true if within limits, false if exceeded
}
```

**Priority:** Implement before production

---

### 2.8 Missing Input Sanitization for Database Queries

**Severity:** 🔴 **CRITICAL**

**Location:**

- `supabase/functions/vendor-requests/index.ts:130, 138`

**Issue:**
While Supabase client uses parameterized queries, user input from URL parameters is used directly:

```typescript
const status = searchParams.get("status");
// ...
if (status) {
  query = query.eq("status", status);
}
```

**Risk:**

- If status validation is bypassed, could lead to unexpected behavior
- Enum validation should be strict

**Current Status:** ✅ Actually safe - Supabase client handles this, but validation should be stricter

**Recommendation:**
Add strict validation:

```typescript
const VALID_STATUSES = ["pending", "approved", "rejected", "withdrawn"];
const status = searchParams.get("status");

if (status && VALID_STATUSES.includes(status)) {
  query = query.eq("status", status);
} else if (status) {
  return new Response(JSON.stringify({ error: "Invalid status parameter" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

**Priority:** Medium (already somewhat protected by Supabase)

---

## 3. High-Risk Security Issues 🟠

### 3.1 Service Role Key Usage Pattern

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

---

### 3.2 File Path Traversal Risk

**Severity:** 🟠 **HIGH**

**Location:**

- `supabase/functions/vendor-upload/index.ts:149-151`
- `supabase/functions/vendor-upload-poster/index.ts:126-128`

**Issue:**
File paths are constructed from user input (requestId):

```typescript
const filePath = `${vendor.id}/${requestId}/${fileName}`;
```

**Current Status:** ✅ Protected by vendor_id validation, but should sanitize requestId

**Recommendation:**
Validate requestId format:

```typescript
// Ensure requestId is a valid UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!UUID_REGEX.test(requestId)) {
  return new Response(JSON.stringify({ error: "Invalid request ID format" }), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```

---

### 3.3 Missing CSRF Protection

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

---

### 3.4 Email Address Enumeration

**Severity:** 🟠 **HIGH**

**Location:**

- `supabase/functions/vendor-requests/index.ts:240-252`

**Issue:**
Admin notification email logic lists all users to find admins, which could be used for enumeration.

**Current Status:** ✅ Protected by service role requirement

**Recommendation:**

- Consider caching admin list
- Rate limit admin listing operations
- Use a separate admin table instead of scanning all users

---

### 3.5 Missing Security Headers

**Severity:** 🟠 **HIGH**

**Issue:**
No security headers set in responses (CSP, X-Frame-Options, etc.).

**Recommendation:**
Add security headers:

```typescript
const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Content-Security-Policy": "default-src 'self'",
};
```

---

## 4. Medium-Risk Security Issues 🟡

### 4.1 Password Policy Not Enforced

**Severity:** 🟡 **MEDIUM**

**Location:**

- Supabase Auth (not in codebase)

**Issue:**
No password complexity requirements visible in code.

**Recommendation:**

- Configure Supabase Auth password policy
- Enforce minimum length, complexity requirements
- Implement password strength meter in UI

---

### 4.2 Session Management

**Severity:** 🟡 **MEDIUM**

**Issue:**
No explicit session timeout or refresh token rotation visible.

**Recommendation:**

- Implement session timeout
- Rotate refresh tokens
- Implement "remember me" functionality securely

---

### 4.3 File Size Limits

**Severity:** 🟡 **MEDIUM**

**Location:**

- `supabase/functions/vendor-upload/index.ts:18`
- `supabase/functions/vendor-upload-poster/index.ts:18`

**Issue:**
50MB limit may be too large for some use cases.

**Recommendation:**

- Consider reducing limit for posters (e.g., 10MB)
- Keep 50MB for attendance files if needed
- Document limits clearly

---

## 5. Positive Security Practices ✅

1. ✅ **No hardcoded credentials** - All secrets use environment variables
2. ✅ **Row Level Security (RLS)** - Properly implemented in database
3. ✅ **Input validation** - Zod schemas on frontend, validation on backend
4. ✅ **Authentication required** - All endpoints check for valid auth token
5. ✅ **Vendor isolation** - Vendors can only access their own data
6. ✅ **File type validation** - MIME type checking implemented
7. ✅ **File size limits** - Maximum file sizes enforced
8. ✅ **Parameterized queries** - Using Supabase client (safe from SQL injection)
9. ✅ **Environment variable protection** - `.gitignore` properly configured

---

## 6. Recommendations Summary

### Immediate Actions (Before Production):

1. 🔴 Fix CORS configuration - restrict to specific origins
2. 🔴 Remove user IDs/emails from error messages
3. 🔴 Sanitize email template inputs (XSS protection)
4. 🔴 Add file content validation (magic bytes)
5. 🔴 Hide stack traces in production
6. 🔴 Remove sensitive data from console logs
7. 🔴 Implement rate limiting

### High Priority (Before Production):

1. 🟠 Add CSRF protection
2. 🟠 Add security headers
3. 🟠 Validate file path inputs more strictly

### Medium Priority (Post-Launch):

1. 🟡 Review password policies
2. 🟡 Implement session management improvements
3. 🟡 Review file size limits

---

## 7. Security Checklist

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
- [ ] Password policy configured
- [ ] Session management improved

---

## 8. Testing Recommendations

1. **Penetration Testing:**

   - Test file upload with spoofed MIME types
   - Test CORS with malicious origins
   - Test rate limiting
   - Test CSRF attacks

2. **Security Scanning:**

   - Use tools like OWASP ZAP or Burp Suite
   - Scan for common vulnerabilities
   - Check dependencies for known CVEs

3. **Code Review:**
   - Review all user input handling
   - Review authentication/authorization logic
   - Review error handling

---

## Conclusion

The codebase demonstrates good security practices in several areas, particularly around credential management and database security. However, critical vulnerabilities exist around CORS, error message exposure, and XSS protection that must be addressed before production deployment. The recommended fixes are straightforward to implement and will significantly improve the security posture of the application.

**Overall Security Rating:** 🟡 **MEDIUM** (will be 🟢 **GOOD** after critical fixes)

---

_This audit was performed on [DATE]. Regular security audits should be conducted quarterly or after significant changes._









