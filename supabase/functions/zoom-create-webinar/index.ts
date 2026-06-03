import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { syncHkraEventFromRequest } from "../_shared/hkraCreateEvent.ts"
import { syncZoomWebinarFromRequest } from "../_shared/zoomCreateWebinar.ts"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY",
  )
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const authRole = normalizeAuthRole(user)
    const isAdmin = authRole === "admin" || authRole === "super-admin"
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const body = await req.json().catch(() => ({})) as {
      request_id?: string
      force?: boolean
      resync_wp?: boolean
    }

    const requestId = typeof body.request_id === "string" ? body.request_id.trim() : ""
    if (!requestId || !UUID_RE.test(requestId)) {
      return new Response(JSON.stringify({ error: "request_id must be a valid UUID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const force = Boolean(body.force)
    const resyncWp = body.resync_wp !== false

    const result = await syncZoomWebinarFromRequest(supabase, requestId, { force })

    if (result.ok && result.skipped) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: result.reason,
          request: result.request,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    if (!result.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error,
          request: result.request,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    let request = result.request
    if (resyncWp && !result.skipped) {
      try {
        const wp = await syncHkraEventFromRequest(supabase, requestId, { force: true })
        if (wp.request) request = wp.request
      } catch (wpErr) {
        console.error("[zoom-create-webinar] WP re-sync after Zoom:", wpErr)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        skipped: false,
        zoom_webinar_id: request.zoom_webinar_id,
        zoom_join_url: (request as { zoom_join_url?: string }).zoom_join_url,
        request,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
