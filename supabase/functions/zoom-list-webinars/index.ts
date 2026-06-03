import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import {
  hasZoomConfig,
  listZoomWebinarTemplateOptions,
} from "../_shared/zoomCreateWebinar.ts"

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

  if (req.method !== "GET") {
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
    const isVendor = authRole === "vendor"

    if (!isAdmin && !isVendor) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (isVendor) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: vendor } = await supabase
        .from("vendors")
        .select("zoom_webinar_auto_create")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!vendor?.zoom_webinar_auto_create) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }
    }

    if (!hasZoomConfig()) {
      return new Response(
        JSON.stringify({
          items: [],
          configured: false,
          message: "Zoom API is not configured on the server",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const items = await listZoomWebinarTemplateOptions()

    return new Response(
      JSON.stringify({ items, configured: true }),
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
