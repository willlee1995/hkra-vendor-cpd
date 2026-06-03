import type { Env, VendorRequestRow } from './types'

type SupabasePatch = {
  updateVendorRequest(requestId: string, patch: Partial<VendorRequestRow>): Promise<void>
}

export async function fetchWordPressEventPermalink(
  siteUrl: string,
  wpEventId: number,
): Promise<string | null> {
  const base = siteUrl.replace(/\/$/, '')
  const paths = [
    `/wp-json/wp/v2/events/${wpEventId}`,
    `/wp-json/wp/v2/event/${wpEventId}`,
    `/wp-json/wp/v2/posts/${wpEventId}`,
  ]

  for (const path of paths) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Accept: 'application/json', 'User-Agent': 'hkra-campaign-orchestrator' },
      })
      if (!res.ok) continue
      const data = (await res.json()) as { link?: string; guid?: { rendered?: string } }
      const link = data.link ?? data.guid?.rendered
      if (typeof link === 'string' && link.length > 0) {
        return link
      }
    } catch {
      // try next endpoint
    }
  }

  return null
}

/**
 * Resolve registration URL from vendor_requests, falling back to WordPress public REST
 * when hkra_wp_event_id exists but hkra_event_permalink was never stored.
 */
export async function resolveRegistrationUrl(
  env: Env,
  request: VendorRequestRow,
  db?: SupabasePatch,
): Promise<string | null> {
  if (request.hkra_event_permalink) {
    return request.hkra_event_permalink
  }

  const wpEventId = request.hkra_wp_event_id
  if (wpEventId == null || wpEventId <= 0) {
    return null
  }

  const siteUrl = env.HKRA_SITE_URL ?? 'https://www.hkra.org.hk'
  const link = await fetchWordPressEventPermalink(siteUrl, wpEventId)
  if (!link) {
    return null
  }

  if (db) {
    await db.updateVendorRequest(request.id, {
      hkra_event_permalink: link,
      hkra_event_sync_error: null,
    })
  }

  return link
}
