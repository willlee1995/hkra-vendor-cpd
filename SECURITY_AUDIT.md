# Security Audit Report

## Executive Summary
* **Total Issues:** 4
* **Critical:** 0 | **High:** 1 | **Medium:** 1 | **Low:** 2

## Findings

### 1. Service Role Key Usage in Edge Functions (Severity: [HIGH])
* **File:** `supabase/functions/vendor-requests/index.ts`, `supabase/functions/vendor-upload/index.ts`
* **Description:** The Edge Functions initialize the Supabase client using `SUPABASE_SERVICE_ROLE_KEY`, which bypasses Row Level Security (RLS). While the code manually verifies the user's identity and role (checking `Authorization` header and `vendor_id`), this approach is fragile. Any oversight in manual filtering in future updates could lead to critical data leaks (IDOR).
* **Vulnerable Code:**
    ```typescript
    // supabase/functions/vendor-requests/index.ts:28
    const supabaseClient = createClient(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
    )
    ```
* **Recommended Fix:**
    *   Prefer using `createClient` with `SUPABASE_ANON_KEY` and the user's `Authorization` header for operations that should be scoped to the user. This enforces RLS policies defined in the database.
    *   Only use the `service_role` client for specific administrative tasks that strictly require elevated privileges (e.g., sending emails, admin-only overrides).

### 2. Potential Memory Exhaustion (DoS) via File Upload (Severity: [MEDIUM])
* **File:** `supabase/functions/vendor-upload/index.ts`
* **Description:** The upload function allows files up to 50MB and reads the entire file content into memory using `await file.arrayBuffer()`. Edge Functions typically have limited memory (e.g., 128MB). Concurrent uploads of large files could cause the function to crash (OOM), leading to Denial of Service.
* **Vulnerable Code:**
    ```typescript
    // supabase/functions/vendor-upload/index.ts:19
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
    // ...
    const fileBuffer = await file.arrayBuffer()
    ```
* **Recommended Fix:**
    *   Reduce `MAX_FILE_SIZE` to a safer limit (e.g., 10MB) if 50MB is not strictly necessary.
    *   If large files are required, investigate streaming the upload directly to Supabase Storage without buffering the entire file in the Edge Function memory.

### 3. Loose File Type Validation (Severity: [LOW])
* **File:** `supabase/functions/vendor-upload/index.ts`
* **Description:** The file type validation logic relies on the client-provided `file.type` (MIME type) or the file extension. Both can be spoofed by a malicious user.
* **Vulnerable Code:**
    ```typescript
    if (!ALLOWED_ATTENDANCE_TYPES.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        // ...
    }
    ```
* **Recommended Fix:**
    *   Strictly enforce file extension checks against an allowlist (already partially done, but the logic allows bypass if `file.type` matches).
    *   Ideally, inspect the file's "magic numbers" (header signature) to verify the actual content type, though this is computationally more expensive.

### 4. Permissive CORS Policy (Severity: [LOW])
* **File:** All Edge Functions (`index.ts`)
* **Description:** The API allows Cross-Origin Resource Sharing (CORS) from any origin (`*`). This allows any website to make requests to your API, which might not be desirable for a private application.
* **Vulnerable Code:**
    ```typescript
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      // ...
    }
    ```
* **Recommended Fix:**
    *   Restrict `Access-Control-Allow-Origin` to the specific domain(s) where your frontend application is hosted (e.g., `https://hkra-vendor-cpd.vercel.app`).

## Next Steps
* [ ] Agent to apply patches for High/Medium issues (Service Role usage refactor is complex, recommend starting with DoS mitigation).
* [ ] Manual review required for RLS policies if switching to Anon Key.
