import type { CampaignJobRow, Env, VendorRequestRow } from './types'

export function createSupabaseRest(env: Env) {
  const base = env.SUPABASE_URL.replace(/\/$/, '')
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  async function rest<T>(
    path: string,
    init?: RequestInit & { prefer?: string },
  ): Promise<T> {
    const headers: Record<string, string> = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    }
    if (init?.prefer) headers.Prefer = init.prefer

    const res = await fetch(`${base}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string>) },
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`Supabase ${path} (${res.status}): ${text}`)
    }
    return text ? (JSON.parse(text) as T) : ({} as T)
  }

  return {
    async getVendorRequest(requestId: string): Promise<VendorRequestRow | null> {
      const rows = await rest<VendorRequestRow[]>(
        `vendor_requests?id=eq.${requestId}&select=*`,
      )
      return rows[0] ?? null
    },

    async getActiveJobForRequest(requestId: string): Promise<CampaignJobRow | null> {
      const rows = await rest<CampaignJobRow[]>(
        `email_campaign_jobs?vendor_request_id=eq.${requestId}&status=in.(queued,generating,dry_run_ready,needs_input)&order=created_at.desc&limit=1`,
      )
      return rows[0] ?? null
    },

    async getLatestJobForRequest(requestId: string): Promise<CampaignJobRow | null> {
      const rows = await rest<CampaignJobRow[]>(
        `email_campaign_jobs?vendor_request_id=eq.${requestId}&order=created_at.desc&limit=1`,
      )
      return rows[0] ?? null
    },

    async getJobById(jobId: string): Promise<CampaignJobRow | null> {
      const rows = await rest<CampaignJobRow[]>(`email_campaign_jobs?id=eq.${jobId}&select=*`)
      return rows[0] ?? null
    },

    async insertJob(row: Partial<CampaignJobRow>): Promise<CampaignJobRow> {
      const rows = await rest<CampaignJobRow[]>('email_campaign_jobs', {
        method: 'POST',
        body: JSON.stringify(row),
        prefer: 'return=representation',
      })
      return rows[0]
    },

    async updateJob(jobId: string, patch: Partial<CampaignJobRow>): Promise<void> {
      await rest(`email_campaign_jobs?id=eq.${jobId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    },

    async listJobsByStatus(statuses: CampaignJobRow['status'][]): Promise<CampaignJobRow[]> {
      const encoded = statuses.map((s) => encodeURIComponent(s)).join(',')
      return rest<CampaignJobRow[]>(
        `email_campaign_jobs?status=in.(${encoded})&order=updated_at.asc&limit=50&select=*`,
      )
    },

    async updateVendorRequest(
      requestId: string,
      patch: Partial<VendorRequestRow>,
    ): Promise<void> {
      await rest(`vendor_requests?id=eq.${requestId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
    },
  }
}

export function normalizePosterUrls(raw: VendorRequestRow['poster_file_url']): string[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  return [String(raw)]
}

const EMAIL_POSTER_IMAGE = /\.(jpe?g|png|gif|webp)(\?|#|$)/i

/** Poster image for the email only — excludes PDFs/rundowns used for CPD admin vetting. */
export function posterUrlsForEmail(allUrls: string[]): string[] {
  return allUrls.filter((url) => EMAIL_POSTER_IMAGE.test(url.split('#')[0]))
}

export function adminMaterialUrls(allUrls: string[]): string[] {
  const email = new Set(posterUrlsForEmail(allUrls))
  return allUrls.filter((url) => !email.has(url))
}
