import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || ""
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || ""
const CAMPAIGN_WORKER_URL = (Deno.env.get("CAMPAIGN_WORKER_URL") || "").replace(/\/$/, "")
const CAMPAIGN_WEBHOOK_SECRET = Deno.env.get("CAMPAIGN_WEBHOOK_SECRET") || ""

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

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return null

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await userClient.auth.getUser()
  if (error || !user) return null

  const role = normalizeAuthRole(user)
  if (role !== "admin" && role !== "super-admin") return null
  return user
}

async function forwardToWorker(
  path: string,
  init: RequestInit,
): Promise<Response> {
  if (!CAMPAIGN_WORKER_URL || !CAMPAIGN_WEBHOOK_SECRET) {
    return new Response(
      JSON.stringify({ error: "Campaign worker not configured on server" }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }

  const response = await fetch(`${CAMPAIGN_WORKER_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Campaign-Webhook-Secret": CAMPAIGN_WEBHOOK_SECRET,
      ...(init.headers as Record<string, string>),
    },
  })

  const text = await response.text()
  return new Response(text, {
    status: response.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const pathParts = url.pathname.split("/").filter(Boolean)
  // /functions/v1/campaign-proxy/... -> last segments
  const subPath = pathParts.slice(pathParts.indexOf("campaign-proxy") + 1).join("/")

  const admin = await requireAdmin(req)
  if (!admin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    if (subPath === "audiences" && req.method === "GET") {
      return forwardToWorker("/campaigns/audiences", { method: "GET" })
    }

    const requestId = subPath.split("/")[0]
    if (!requestId || !UUID_RE.test(requestId)) {
      return new Response(JSON.stringify({ error: "Invalid request_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    if (subPath === requestId && req.method === "GET") {
      return forwardToWorker(`/campaigns/${requestId}`, { method: "GET" })
    }

    if (subPath === `${requestId}/approve-schedule` && req.method === "POST") {
      const body = await req.text()
      return forwardToWorker(`/campaigns/${requestId}/approve-schedule`, {
        method: "POST",
        body,
      })
    }

    if (subPath === `${requestId}/retry` && req.method === "POST") {
      const body = await req.text()
      return forwardToWorker(`/campaigns/${requestId}/retry`, {
        method: "POST",
        body: body || "{}",
      })
    }

    if (subPath === `${requestId}/start` && req.method === "POST") {
      const body = await req.text()
      return forwardToWorker(`/campaigns/${requestId}/start`, {
        method: "POST",
        body: body || "{}",
      })
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("campaign-proxy error:", error)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
