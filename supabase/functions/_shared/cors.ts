const DEFAULT_ORIGINS = [
  "https://cpdapproval.hkra.org.hk",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]

function allowedOrigins(): string[] {
  const fromEnv = Deno.env.get("ALLOWED_ORIGINS")
  if (!fromEnv?.trim()) return DEFAULT_ORIGINS
  return fromEnv.split(",").map((s) => s.trim()).filter(Boolean)
}

/** CORS headers for Edge Function responses (reflects allowed browser origins). */
export function corsHeaders(req: Request): Record<string, string> {
  const allowed = allowedOrigins()
  const origin = req.headers.get("Origin")
  let allowOrigin = "*"
  if (origin && allowed.includes(origin)) {
    allowOrigin = origin
  } else if (origin && allowed.length === 1 && allowed[0] !== "*") {
    allowOrigin = allowed[0]
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  }
}
