/**
 * Shared HKRA WordPress Events Manager event sync.
 * @see event-api.md — POST /wp-json/hkra-em/v1/events (hkra-em-api plugin)
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
  zoom_join_url?: string | null
  zoom_host_start_url?: string | null
  zoom_created_at?: string | null
  zoom_sync_error?: string | null
  zoom_template_webinar_id?: string | null
  zoom_template_kind?: string | null
  vendor_id?: string
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
  /** hkra-em-api: post meta _custom_attendee_form; use "none" to disable */
  attendee_form_id?: string | number
  cpd?: string
  /** Taxonomy term IDs/slugs — hkra-em-api alias for event-categories */
  categories?: (string | number)[]
  /** Taxonomy term IDs/slugs — hkra-em-api alias for event-tags */
  tags?: (string | number)[]
  subspecialties?: (string | number)[]
  /** Stored on EM Pro ticket/product meta for Zoom registrant bridge */
  zoom_webinar_id?: string
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

/** WordPress post status for new events. Default publish — live on hkra.org.hk after approval sync. */
function parseEventStatus(): string {
  const v = Deno.env.get("HKRA_DEFAULT_EVENT_STATUS")?.trim().toLowerCase()
  if (v === "publish" || v === "draft" || v === "pending" || v === "private") {
    return v
  }
  return "publish"
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
  if (row.zoom_join_url) {
    lines.push(`<p><strong>Zoom join link:</strong> ${escapeHtml(row.zoom_join_url)}</p>`)
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
    status: parseEventStatus(),
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
    payload.attendee_form_id = Deno.env.get("HKRA_DEFAULT_ATTENDEE_FORM")?.trim() || "none"
  } else {
    payload.event_rsvp = false
  }

  const bf = parseEnvInt("HKRA_DEFAULT_BOOKING_FORM_ID")
  if (bf !== undefined && bf > 0) {
    payload.booking_form_id = bf
  }

  const cats = parseJsonNumberArray("HKRA_EVENT_CATEGORIES_JSON")
  if (cats?.length) payload.categories = cats
  const tags = parseJsonNumberArray("HKRA_EVENT_TAGS_JSON")
  if (tags?.length) payload.tags = tags
  const subs = parseJsonNumberArray("HKRA_SUBSPECIALTIES_JSON")
  if (subs?.length) payload.subspecialties = subs

  const zoomId = row.zoom_webinar_id?.trim()
  if (zoomId) {
    payload.zoom_webinar_id = zoomId
  }

  return payload
}

async function readWordPressResponseBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text()
  if (!text.trim()) {
    return res.status >= 500
      ? {
        code: "wp_fatal",
        message:
          "WordPress returned an empty HTTP 500 (PHP fatal error — check hkra.org.hk debug.log and hkra-em-api plugin)",
      }
      : {}
  }
  try {
    const parsed = JSON.parse(text) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return { message: text.slice(0, 500) }
  } catch {
    return {
      code: "non_json_response",
      message: text.slice(0, 500),
    }
  }
}

function wordPressErrorMessage(status: number, body: Record<string, unknown>): string {
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message
  }
  if (typeof body.code === "string" && body.code.trim()) {
    return body.code
  }
  if (status === 500) {
    return "WordPress hkra-em/v1/events returned HTTP 500 — check hkra-em-api plugin and debug.log"
  }
  return `WordPress returned HTTP ${status}`
}

function hkraEmApiNamespace(): string {
  return Deno.env.get("HKRA_WP_API_NAMESPACE")?.trim() || "hkra-em/v1"
}

function hkraEmEventsUrl(base: string): string {
  return `${base.replace(/\/$/, "")}/wp-json/${hkraEmApiNamespace()}/events`
}

function parseCreateEventResponse(
  body: Record<string, unknown>,
): { id: number; link?: string } | null {
  const event = body.event
  const src =
    event && typeof event === "object" && !Array.isArray(event)
      ? (event as Record<string, unknown>)
      : body
  const rawId = src.event_id ?? src.post_id ?? src.id
  const id =
    typeof rawId === "number"
      ? rawId
      : typeof rawId === "string"
      ? parseInt(rawId, 10)
      : NaN
  if (!Number.isFinite(id)) return null
  const link = src.link
  return {
    id,
    link: typeof link === "string" && link.length > 0 ? link : undefined,
  }
}

async function postCreateEventToWordPress(
  payload: HkraCreateEventPayload,
): Promise<{ ok: true; id: number; link: string } | { ok: false; status: number; body: unknown }> {
  const base = Deno.env.get("HKRA_WP_BASE_URL")!.replace(/\/$/, "")
  const user = Deno.env.get("HKRA_WP_USER")!
  const password = Deno.env.get("HKRA_WP_APP_PASSWORD")!
  const auth = btoa(`${user}:${password}`)
  const url = hkraEmEventsUrl(base)

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await readWordPressResponseBody(res)
  const parsed = parseCreateEventResponse(body)

  if (res.ok && parsed) {
    if (parsed.link) {
      return { ok: true, id: parsed.id, link: parsed.link }
    }
    const fetched = await fetchWordPressEventPermalink(base, parsed.id)
    if (fetched) {
      return { ok: true, id: parsed.id, link: fetched }
    }
  }

  return { ok: false, status: res.status, body }
}

async function fetchWordPressEventPermalink(baseUrl: string, wpEventId: number): Promise<string | null> {
  const base = baseUrl.replace(/\/$/, "")
  const user = Deno.env.get("HKRA_WP_USER")?.trim()
  const pass = Deno.env.get("HKRA_WP_APP_PASSWORD")?.trim()
  const headers: Record<string, string> = { Accept: "application/json" }
  if (user && pass) {
    headers.Authorization = `Basic ${btoa(`${user}:${pass}`)}`
  }

  const ns = hkraEmApiNamespace()
  const paths = [
    `/wp-json/${ns}/events/${wpEventId}`,
    `/wp-json/wp/v2/events/${wpEventId}`,
    `/wp-json/wp/v2/event/${wpEventId}`,
    `/wp-json/wp/v2/posts/${wpEventId}`,
  ]

  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, { headers })
      if (!res.ok) continue
      const data = (await res.json()) as { link?: string; guid?: { rendered?: string } }
      const link = data.link ?? data.guid?.rendered
      if (typeof link === "string" && link.length > 0) {
        return link
      }
    } catch {
      // try next endpoint
    }
  }

  return null
}

async function backfillPermalinkIfMissing(
  supabase: SupabaseClient,
  requestId: string,
  row: VendorRequestRow,
): Promise<VendorRequestRow> {
  if (row.hkra_event_permalink) return row
  const wpId = row.hkra_wp_event_id
  if (wpId == null || wpId <= 0) return row
  if (!hasHkraWordPressConfig()) return row

  const base = Deno.env.get("HKRA_WP_BASE_URL")!.replace(/\/$/, "")
  const link = await fetchWordPressEventPermalink(base, wpId)
  if (!link) return row

  await supabase
    .from("vendor_requests")
    .update({
      hkra_event_permalink: link,
      hkra_event_sync_error: null,
    })
    .eq("id", requestId)

  const { data: updated } = await supabase.from("vendor_requests").select("*").eq("id", requestId).single()
  return (updated || { ...row, hkra_event_permalink: link }) as VendorRequestRow
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
    const backfilled = await backfillPermalinkIfMissing(supabase, requestId, r)
    return { ok: true, skipped: true, reason: "already_exists", request: backfilled }
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

    const errBody = wp.body as Record<string, unknown>
    const msg = wordPressErrorMessage(wp.status, errBody)
    console.error("[hkraCreateEvent] WordPress create-event failed:", wp.status, errBody)

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
