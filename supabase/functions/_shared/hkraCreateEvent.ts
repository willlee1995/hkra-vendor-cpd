/**
 * Shared HKRA WordPress Events Manager create-event integration.
 * @see event-api.md
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"

export interface VendorRequestRow {
  id: string
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string | null
  event_end_time?: string | null
  expected_cpd_points?: number | string | null
  vendor_company_name?: string | null
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  zoom_webinar_id?: string | null
  on24_key?: string | null
  on24_id?: string | null
  expected_promotion_date?: string | null
  poster_file_url?: string | string[] | null
  hkra_wp_event_id?: number | null
  hkra_event_permalink?: string | null
  hkra_event_created_at?: string | null
  hkra_event_sync_error?: string | null
  status?: string | null
}

export interface HkraCreateEventPayload {
  title: string
  content?: string
  status?: string
  event_timezone?: string
  event_start_date?: string
  event_end_date?: string
  event_start_time?: string
  event_end_time?: string
  event_all_day?: boolean
  location_id?: number
  event_rsvp?: boolean
  ticket_price?: number
  ticket_spaces?: number
  ticket_name?: string
  allowed_roles?: string[]
  booking_form_id?: number
  cpd?: string
  event_categories?: (string | number)[]
  event_tags?: (string | number)[]
  subspecialties?: (string | number)[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function formatDateOnly(d: string | null | undefined): string | undefined {
  if (d == null || d === "") return undefined
  const s = String(d).trim()
  if (s.length >= 10) return s.slice(0, 10)
  return s
}

function normalizeTime(t: string | null | undefined): string | undefined {
  if (t == null || String(t).trim() === "") return undefined
  const s = String(t).trim()
  const parts = s.split(":")
  if (parts.length === 2) return `${parts[0]}:${parts[1]}:00`
  return s
}

function parseEnvInt(name: string): number | undefined {
  const v = Deno.env.get(name)
  if (v == null || v === "") return undefined
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

function parseEnvFloat(name: string, fallback: number): number {
  const v = Deno.env.get(name)
  if (v == null || v === "") return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

function parseEnvBool(name: string, defaultTrue: boolean): boolean {
  const v = Deno.env.get(name)
  if (v == null || v === "") return defaultTrue
  const lower = v.toLowerCase().trim()
  if (["0", "false", "no", "off"].includes(lower)) return false
  if (["1", "true", "yes", "on"].includes(lower)) return true
  return defaultTrue
}

function parseJsonArray(name: string): string[] | undefined {
  const raw = Deno.env.get(name)
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    return parsed.filter((x): x is string => typeof x === "string")
  } catch {
    return undefined
  }
}

function parseJsonNumberArray(name: string): (string | number)[] | undefined {
  const raw = Deno.env.get(name)
  if (!raw?.trim()) return undefined
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return undefined
    return parsed.filter(
      (x): x is string | number => typeof x === "string" || typeof x === "number",
    )
  } catch {
    return undefined
  }
}

export function hasHkraWordPressConfig(): boolean {
  const base = Deno.env.get("HKRA_WP_BASE_URL")?.trim()
  const user = Deno.env.get("HKRA_WP_USER")?.trim()
  const pass = Deno.env.get("HKRA_WP_APP_PASSWORD")?.trim()
  return Boolean(base && user && pass)
}

export function buildPayloadFromVendorRequest(row: VendorRequestRow): HkraCreateEventPayload {
  const lines: string[] = []
  if (row.vendor_company_name) {
    lines.push(`<p><strong>Organizer:</strong> ${escapeHtml(row.vendor_company_name)}</p>`)
  }
  if (row.contact_name || row.contact_email) {
    const bits: string[] = []
    if (row.contact_name) bits.push(escapeHtml(row.contact_name))
    if (row.contact_email) bits.push(escapeHtml(row.contact_email))
    lines.push(`<p><strong>Contact:</strong> ${bits.join(" — ")}</p>`)
  }
  if (row.contact_phone) {
    lines.push(`<p><strong>Phone:</strong> ${escapeHtml(row.contact_phone)}</p>`)
  }
  if (row.zoom_webinar_id) {
    lines.push(`<p><strong>Zoom webinar ID:</strong> ${escapeHtml(row.zoom_webinar_id)}</p>`)
  }
  if (row.on24_key || row.on24_id) {
    const bits: string[] = []
    if (row.on24_key) bits.push(`Key: ${escapeHtml(row.on24_key)}`)
    if (row.on24_id) bits.push(`ID: ${escapeHtml(row.on24_id)}`)
    lines.push(`<p><strong>ON24:</strong> ${bits.join(", ")}</p>`)
  }
  if (row.expected_promotion_date) {
    lines.push(`<p><strong>Expected promotion date:</strong> ${escapeHtml(String(row.expected_promotion_date))}</p>`)
  }

  const content = lines.length > 0 ? lines.join("\n") : `<p>${escapeHtml(row.event_name)}</p>`

  const event_rsvp = parseEnvBool("HKRA_DEFAULT_EVENT_RSVP", true)
  const payload: HkraCreateEventPayload = {
    title: row.event_name,
    content,
    status: "publish",
    event_timezone: Deno.env.get("HKRA_DEFAULT_TIMEZONE")?.trim() || "Asia/Hong_Kong",
    event_start_date: formatDateOnly(row.event_start_date),
    event_end_date: formatDateOnly(row.event_end_date),
    event_start_time: normalizeTime(row.event_start_time),
    event_end_time: normalizeTime(row.event_end_time),
    event_all_day: false,
  }

  const loc = parseEnvInt("HKRA_DEFAULT_LOCATION_ID")
  if (loc !== undefined && loc > 0) payload.location_id = loc

  if (row.expected_cpd_points != null && row.expected_cpd_points !== "") {
    payload.cpd = String(row.expected_cpd_points)
  }

  if (event_rsvp) {
    payload.event_rsvp = true
    payload.ticket_price = parseEnvFloat("HKRA_DEFAULT_TICKET_PRICE", 50)
    payload.ticket_spaces = parseEnvInt("HKRA_DEFAULT_TICKET_SPACES") ?? 500
    payload.ticket_name = Deno.env.get("HKRA_DEFAULT_TICKET_NAME")?.trim() || "HKRA - Registration"
    const roles = parseJsonArray("HKRA_ALLOWED_ROLES_JSON")
    if (roles?.length) payload.allowed_roles = roles
  } else {
    payload.event_rsvp = false
  }

  const bf = parseEnvInt("HKRA_DEFAULT_BOOKING_FORM_ID")
  if (bf !== undefined && bf > 0) payload.booking_form_id = bf

  const cats = parseJsonNumberArray("HKRA_EVENT_CATEGORIES_JSON")
  if (cats?.length) payload.event_categories = cats
  const tags = parseJsonNumberArray("HKRA_EVENT_TAGS_JSON")
  if (tags?.length) payload.event_tags = tags
  const subs = parseJsonNumberArray("HKRA_SUBSPECIALTIES_JSON")
  if (subs?.length) payload.subspecialties = subs

  return payload
}

async function postCreateEventToWordPress(
  payload: HkraCreateEventPayload,
): Promise<{ ok: true; id: number; link: string } | { ok: false; status: number; body: unknown }> {
  const base = Deno.env.get("HKRA_WP_BASE_URL")!.replace(/\/$/, "")
  const user = Deno.env.get("HKRA_WP_USER")!
  const password = Deno.env.get("HKRA_WP_APP_PASSWORD")!
  const auth = btoa(`${user}:${password}`)
  const url = `${base}/wp-json/em-custom/v1/create-event`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => ({}))

  if (res.ok && body && typeof body === "object" && (body as { success?: boolean }).success === true) {
    const rawId = (body as { id?: number | string }).id
    const id =
      typeof rawId === "number"
        ? rawId
        : typeof rawId === "string"
        ? parseInt(rawId, 10)
        : NaN
    const link = (body as { link?: string }).link
    if (Number.isFinite(id) && typeof link === "string" && link.length > 0) {
      return { ok: true, id, link }
    }
  }

  return { ok: false, status: res.status, body }
}

export type SyncHkraResult =
  | {
    ok: true
    skipped: true
    reason: "not_configured" | "already_exists"
    request: VendorRequestRow
  }
  | {
    ok: true
    skipped: false
    request: VendorRequestRow
  }
  | {
    ok: false
    error: string
    request?: VendorRequestRow
  }

export async function syncHkraEventFromRequest(
  supabase: SupabaseClient,
  requestId: string,
  options: { force?: boolean } = {},
): Promise<SyncHkraResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("vendor_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message || "Request not found" }
  }

  const r = row as VendorRequestRow

  if (r.hkra_wp_event_id != null && r.hkra_wp_event_id > 0 && !options.force) {
    return { ok: true, skipped: true, reason: "already_exists", request: r }
  }

  if (!hasHkraWordPressConfig()) {
    console.warn(
      "[hkraCreateEvent] HKRA_WP_BASE_URL / HKRA_WP_USER / HKRA_WP_APP_PASSWORD not set; skipping WordPress sync",
    )
    return { ok: true, skipped: true, reason: "not_configured", request: r }
  }

  const payload = buildPayloadFromVendorRequest(r)
  if (!payload.title?.trim()) {
    const msg = "Event title is required for HKRA sync"
    await supabase
      .from("vendor_requests")
      .update({ hkra_event_sync_error: msg })
      .eq("id", requestId)
    const { data: again } = await supabase.from("vendor_requests").select("*").eq("id", requestId).single()
    return { ok: false, error: msg, request: (again || r) as VendorRequestRow }
  }

  try {
    const wp = await postCreateEventToWordPress(payload)
    if (wp.ok) {
      await supabase
        .from("vendor_requests")
        .update({
          hkra_wp_event_id: wp.id,
          hkra_event_permalink: wp.link,
          hkra_event_created_at: new Date().toISOString(),
          hkra_event_sync_error: null,
        })
        .eq("id", requestId)

      const { data: updated } = await supabase.from("vendor_requests").select("*").eq("id", requestId).single()
      return {
        ok: true,
        skipped: false,
        request: (updated || r) as VendorRequestRow,
      }
    }

    const errBody = wp.body as { message?: string; code?: string }
    const msg =
      typeof errBody?.message === "string"
        ? errBody.message
        : typeof errBody?.code === "string"
        ? errBody.code
        : `WordPress returned HTTP ${wp.status}`

    await supabase
      .from("vendor_requests")
      .update({ hkra_event_sync_error: msg })
      .eq("id", requestId)

    const { data: again } = await supabase.from("vendor_requests").select("*").eq("id", requestId).single()
    return { ok: false, error: msg, request: (again || r) as VendorRequestRow }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[hkraCreateEvent] sync error:", e)
    await supabase
      .from("vendor_requests")
      .update({ hkra_event_sync_error: msg })
      .eq("id", requestId)
    const { data: again } = await supabase.from("vendor_requests").select("*").eq("id", requestId).single()
    return { ok: false, error: msg, request: (again || r) as VendorRequestRow }
  }
}
