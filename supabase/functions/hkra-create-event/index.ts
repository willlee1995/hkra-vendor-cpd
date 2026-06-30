import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"
import { syncHkraEventFromRequest } from "../_shared/hkraCreateEvent.ts"

function getSupabaseConfig():
  | { url: string; serviceRoleKey: string; anonKey: string }
  | null {
  const url = Deno.env.get("SUPABASE_URL") || ""
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || ""
  if (!url || !serviceRoleKey || !anonKey) return null
  return { url, serviceRoleKey, anonKey }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeAuthRole(user: {
  user_metadata?: { role?: unknown }
  raw_user_meta_data?: { role?: unknown }
  app_metadata?: { role?: unknown }
}): "vendor" | "admin" | "super-admin" | null {
  const raw = user.user_metadata?.role ?? user.raw_user_meta_data?.role ?? user.app_metadata?.role
  if (typeof raw !== "string") return null
  const compact = raw.trim().toLowerCase().replace(/[\s_-]/g, "")
  if (compact === "superadmin") return "super-admin"
  const n = raw.trim().toLowerCase().replace(/_/g, "-")
  if (n === "vendor" || n === "admin" || n === "super-admin") return n
  return null
}

serve(async (req) => {
  const cors = corsHeaders(req)

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }

  const config = getSupabaseConfig()
  if (!config) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: missing Supabase env vars" }),
      { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
    )
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const userClient = createClient(config.url, config.anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const authRole = normalizeAuthRole(user)
    const isAdmin = authRole === "admin" || authRole === "super-admin"
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({})) as {
      request_id?: string
      force?: boolean
    }

    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : ""
    if (!requestId || !UUID_RE.test(requestId)) {
      return new Response(JSON.stringify({ error: "request_id must be a valid UUID" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(config.url, config.serviceRoleKey)

    const result = await syncHkraEventFromRequest(supabase, requestId, {
      force: Boolean(body.force),
    })

    if (result.ok && result.skipped && result.reason === "already_exists" && !body.force) {
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "already_exists",
          message: "HKRA event already linked. Pass force: true to create another (support only).",
          request: result.request,
        }),
        { status: 409, headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    if (result.ok && result.skipped && result.reason === "not_configured") {
      return new Response(
        JSON.stringify({
          success: false,
          skipped: true,
          reason: "not_configured",
          message: "HKRA WordPress credentials are not configured on the server.",
          request: result.request,
        }),
        { status: 503, headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          request: result.request,
        }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        skipped: false,
        wp_event_id: (result.request as { hkra_wp_event_id?: number }).hkra_wp_event_id,
        link: (result.request as { hkra_event_permalink?: string }).hkra_event_permalink,
        request: result.request,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
