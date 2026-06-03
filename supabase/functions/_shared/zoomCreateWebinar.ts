/**
 * Zoom webinar create integration (Server-to-Server OAuth).
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import type { VendorRequestRow } from "./hkraCreateEvent.ts"

export type { VendorRequestRow }

export type ZoomTemplateKind = "template" | "webinar" | "past"

export interface ZoomWebinarTemplateOption {
  id: string
  kind: ZoomTemplateKind
  topic: string
  start_time?: string | null
  label: string
}

interface VendorRow {
  zoom_webinar_auto_create?: boolean | null
}

interface ZoomTokenResponse {
  access_token?: string
  expires_in?: number
}

interface ZoomWebinarCreateResponse {
  id?: number | string
  join_url?: string
  start_url?: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

export function hasZoomConfig(): boolean {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID")?.trim()
  const clientId = Deno.env.get("ZOOM_CLIENT_ID")?.trim()
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET")?.trim()
  return Boolean(accountId && clientId && clientSecret)
}

function zoomHostUserId(): string {
  const host = Deno.env.get("ZOOM_HOST_USER_ID")?.trim()
  return host && host.length > 0 ? host : "me"
}

export async function getZoomAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token
  }

  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID")!.trim()
  const clientId = Deno.env.get("ZOOM_CLIENT_ID")!.trim()
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET")!.trim()
  const basic = btoa(`${clientId}:${clientSecret}`)

  const url =
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  })

  const body = (await res.json().catch(() => ({}))) as ZoomTokenResponse
  if (!res.ok || !body.access_token) {
    const msg = typeof (body as { reason?: string }).reason === "string"
      ? (body as { reason: string }).reason
      : `Zoom OAuth failed (HTTP ${res.status})`
    throw new Error(msg)
  }

  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600
  cachedToken = {
    token: body.access_token,
    expiresAt: now + expiresIn * 1000,
  }
  return body.access_token
}

async function zoomApiGet(path: string): Promise<Response> {
  const token = await getZoomAccessToken()
  return fetch(`https://api.zoom.us/v2${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

function encodeWebinarIdForPath(webinarId: string): string {
  if (webinarId.includes("/") || webinarId.includes("//")) {
    return encodeURIComponent(encodeURIComponent(webinarId))
  }
  return encodeURIComponent(webinarId)
}

function formatDateOnly(d: string | null | undefined): string | undefined {
  if (d == null || d === "") return undefined
  const s = String(d).trim()
  if (s.length >= 10) return s.slice(0, 10)
  return s
}

function parseTimeParts(t: string | null | undefined): { h: number; m: number } | null {
  if (t == null || String(t).trim() === "") return null
  const parts = String(t).trim().split(":")
  const h = parseInt(parts[0] ?? "", 10)
  const m = parseInt(parts[1] ?? "0", 10)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return { h, m }
}

function formatOptionLabel(topic: string, startTime?: string | null, kind?: ZoomTemplateKind): string {
  const prefix = kind === "template" ? "[Template] " : kind === "past" ? "[Past] " : ""
  const t = topic.trim() || "Untitled webinar"
  if (!startTime) return `${prefix}${t}`
  try {
    const d = new Date(startTime)
    if (!Number.isNaN(d.getTime())) {
      return `${prefix}${t} — ${d.toLocaleString("en-HK", { timeZone: "Asia/Hong_Kong" })}`
    }
  } catch {
    // ignore
  }
  return `${prefix}${t} — ${startTime}`
}

/** Duration in minutes from start/end times on the same day; minimum 30. */
export function computeWebinarDurationMinutes(
  startTime?: string | null,
  endTime?: string | null,
): number {
  const start = parseTimeParts(startTime)
  const end = parseTimeParts(endTime)
  if (!start || !end) return 60
  const startMins = start.h * 60 + start.m
  const endMins = end.h * 60 + end.m
  const diff = endMins - startMins
  if (diff <= 0) return 60
  return Math.max(30, diff)
}

/** ISO8601 local datetime string for Zoom (no Z suffix; timezone field separate). */
export function buildZoomStartTime(
  eventDate: string,
  eventTime?: string | null,
): string {
  const date = formatDateOnly(eventDate) ?? eventDate
  const tp = parseTimeParts(eventTime) ?? { h: 9, m: 0 }
  const hh = String(tp.h).padStart(2, "0")
  const mm = String(tp.m).padStart(2, "0")
  return `${date}T${hh}:${mm}:00`
}

export type ZoomWebinarCreatePayload = Record<string, unknown> & {
  topic: string
  type: number
  start_time: string
  duration: number
  timezone: string
  template_id?: string
  settings?: Record<string, unknown>
  agenda?: string
  password?: string
}

function defaultSettings(): Record<string, unknown> {
  return {
    approval_type: 0,
    registration_type: 1,
    registrants_email_notification: true,
  }
}

export function buildWebinarPayloadFromVendorRequest(row: VendorRequestRow): ZoomWebinarCreatePayload {
  return {
    topic: row.event_name,
    type: 5,
    start_time: buildZoomStartTime(row.event_start_date, row.event_start_time),
    duration: computeWebinarDurationMinutes(row.event_start_time, row.event_end_time),
    timezone: Deno.env.get("ZOOM_DEFAULT_TIMEZONE")?.trim() || "Asia/Hong_Kong",
    settings: defaultSettings(),
  }
}

async function fetchWebinarDetails(webinarId: string): Promise<Record<string, unknown> | null> {
  const pathId = encodeWebinarIdForPath(webinarId)
  let res = await zoomApiGet(`/webinars/${pathId}`)
  if (!res.ok) {
    res = await zoomApiGet(`/webinars/${pathId}?type=past`)
  }
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  return data
}

/** Merge vendor request schedule/topic with template or copied webinar settings. */
export async function buildWebinarPayloadWithTemplate(
  row: VendorRequestRow,
): Promise<ZoomWebinarCreatePayload> {
  const base = buildWebinarPayloadFromVendorRequest(row)
  const templateId = row.zoom_template_webinar_id?.trim()
  const kind = (row.zoom_template_kind?.trim() || "") as ZoomTemplateKind

  if (!templateId) return base

  if (kind === "template") {
    return { ...base, template_id: templateId }
  }

  const source = await fetchWebinarDetails(templateId)
  if (!source) {
    console.warn(`[zoomCreateWebinar] Could not load source webinar ${templateId}; using defaults`)
    return base
  }

  const merged: ZoomWebinarCreatePayload = { ...base }
  const sourceSettings = source.settings
  if (sourceSettings && typeof sourceSettings === "object") {
    merged.settings = {
      ...(sourceSettings as Record<string, unknown>),
      ...(base.settings as Record<string, unknown>),
    }
  }
  if (typeof source.agenda === "string" && source.agenda.trim()) {
    merged.agenda = source.agenda
  }
  if (typeof source.password === "string" && source.password.trim()) {
    merged.password = source.password
  }
  return merged
}

export async function listZoomWebinarTemplateOptions(): Promise<ZoomWebinarTemplateOption[]> {
  const userId = encodeURIComponent(zoomHostUserId())
  const items: ZoomWebinarTemplateOption[] = []
  const seen = new Set<string>()

  const add = (opt: ZoomWebinarTemplateOption) => {
    const key = `${opt.kind}:${opt.id}`
    if (seen.has(key)) return
    seen.add(key)
    items.push(opt)
  }

  try {
    const tplRes = await zoomApiGet(`/users/${userId}/webinar_templates`)
    if (tplRes.ok) {
      const body = (await tplRes.json()) as { templates?: { id?: string; name?: string }[] }
      for (const t of body.templates ?? []) {
        if (!t.id) continue
        const topic = t.name?.trim() || `Template ${t.id}`
        add({
          id: t.id,
          kind: "template",
          topic,
          label: formatOptionLabel(topic, null, "template"),
        })
      }
    }
  } catch (e) {
    console.warn("[zoomCreateWebinar] webinar_templates:", e)
  }

  try {
    let nextPageToken: string | undefined
    do {
      const qs = new URLSearchParams({ page_size: "100" })
      if (nextPageToken) qs.set("next_page_token", nextPageToken)
      const res = await zoomApiGet(`/users/${userId}/webinars?${qs}`)
      if (!res.ok) break
      const body = (await res.json()) as {
        webinars?: { id?: number | string; topic?: string; start_time?: string }[]
        next_page_token?: string
      }
      for (const w of body.webinars ?? []) {
        if (w.id == null) continue
        const id = String(w.id)
        const topic = w.topic?.trim() || `Webinar ${id}`
        add({
          id,
          kind: "webinar",
          topic,
          start_time: w.start_time ?? null,
          label: formatOptionLabel(topic, w.start_time, "webinar"),
        })
      }
      nextPageToken = body.next_page_token
    } while (nextPageToken)
  } catch (e) {
    console.warn("[zoomCreateWebinar] list webinars:", e)
  }

  try {
    const to = new Date()
    const from = new Date()
    from.setMonth(from.getMonth() - 18)
    const fromStr = from.toISOString().slice(0, 10)
    const toStr = to.toISOString().slice(0, 10)
    const res = await zoomApiGet(
      `/report/users/${userId}/webinars?from=${fromStr}&to=${toStr}&page_size=100`,
    )
    if (res.ok) {
      const body = (await res.json()) as {
        webinars?: { id?: number | string; topic?: string; start_time?: string }[]
      }
      for (const w of body.webinars ?? []) {
        if (w.id == null) continue
        const id = String(w.id)
        const topic = w.topic?.trim() || `Webinar ${id}`
        add({
          id,
          kind: "past",
          topic,
          start_time: w.start_time ?? null,
          label: formatOptionLabel(topic, w.start_time, "past"),
        })
      }
    }
  } catch (e) {
    console.warn("[zoomCreateWebinar] report webinars:", e)
  }

  items.sort((a, b) => {
    const ta = a.start_time ? new Date(a.start_time).getTime() : 0
    const tb = b.start_time ? new Date(b.start_time).getTime() : 0
    return tb - ta
  })

  return items
}

export async function createZoomWebinar(
  payload: ZoomWebinarCreatePayload,
): Promise<{ id: string; join_url: string; start_url: string }> {
  const token = await getZoomAccessToken()
  const userId = encodeURIComponent(zoomHostUserId())
  const res = await fetch(`https://api.zoom.us/v2/users/${userId}/webinars`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const body = (await res.json().catch(() => ({}))) as ZoomWebinarCreateResponse & {
    message?: string
    code?: number
  }

  if (!res.ok) {
    const msg = typeof body.message === "string" ? body.message : `Zoom API HTTP ${res.status}`
    throw new Error(msg)
  }

  const id = body.id != null ? String(body.id) : ""
  const join_url = typeof body.join_url === "string" ? body.join_url : ""
  const start_url = typeof body.start_url === "string" ? body.start_url : ""

  if (!id) {
    throw new Error("Zoom API did not return a webinar id")
  }

  return { id, join_url, start_url }
}

function hasOn24Fields(row: VendorRequestRow): boolean {
  const key = row.on24_key?.trim()
  const id = row.on24_id?.trim()
  return Boolean(key || id)
}

export type SyncZoomResult =
  | {
    ok: true
    skipped: true
    reason: "not_configured" | "not_eligible" | "on24" | "already_exists"
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

export async function syncZoomWebinarFromRequest(
  supabase: SupabaseClient,
  requestId: string,
  options: { force?: boolean } = {},
): Promise<SyncZoomResult> {
  const { data: row, error: fetchErr } = await supabase
    .from("vendor_requests")
    .select("*")
    .eq("id", requestId)
    .single()

  if (fetchErr || !row) {
    return { ok: false, error: fetchErr?.message || "Request not found" }
  }

  const r = row as VendorRequestRow & { vendor_id?: string }

  const { data: vendor, error: vendorErr } = await supabase
    .from("vendors")
    .select("zoom_webinar_auto_create")
    .eq("id", r.vendor_id)
    .maybeSingle()

  if (vendorErr) {
    return { ok: false, error: vendorErr.message, request: r }
  }

  const vendorRow = vendor as VendorRow | null
  if (!vendorRow?.zoom_webinar_auto_create) {
    return { ok: true, skipped: true, reason: "not_eligible", request: r }
  }

  if (hasOn24Fields(r)) {
    return { ok: true, skipped: true, reason: "on24", request: r }
  }

  const existingId = r.zoom_webinar_id?.trim()
  if (existingId && !options.force) {
    return { ok: true, skipped: true, reason: "already_exists", request: r }
  }

  if (!hasZoomConfig()) {
    console.warn("[zoomCreateWebinar] ZOOM_* env not set; skipping Zoom create")
    return { ok: true, skipped: true, reason: "not_configured", request: r }
  }

  if (!r.event_name?.trim()) {
    const msg = "Event name is required for Zoom webinar create"
    await supabase.from("vendor_requests").update({ zoom_sync_error: msg }).eq("id", requestId)
    const { data: again } = await supabase.from("vendor_requests").select("*").eq("id", requestId)
      .single()
    return { ok: false, error: msg, request: (again || r) as VendorRequestRow }
  }

  try {
    const payload = await buildWebinarPayloadWithTemplate(r)
    const created = await createZoomWebinar(payload)

    await supabase
      .from("vendor_requests")
      .update({
        zoom_webinar_id: created.id,
        zoom_join_url: created.join_url || null,
        zoom_host_start_url: created.start_url || null,
        zoom_created_at: new Date().toISOString(),
        zoom_sync_error: null,
      })
      .eq("id", requestId)

    const { data: updated } = await supabase.from("vendor_requests").select("*").eq("id", requestId)
      .single()
    return {
      ok: true,
      skipped: false,
      request: (updated || r) as VendorRequestRow,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error("[zoomCreateWebinar] sync error:", e)
    await supabase.from("vendor_requests").update({ zoom_sync_error: msg }).eq("id", requestId)
    const { data: again } = await supabase.from("vendor_requests").select("*").eq("id", requestId)
      .single()
    return { ok: false, error: msg, request: (again || r) as VendorRequestRow }
  }
}
