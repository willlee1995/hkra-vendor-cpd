/**
 * FluentCRM publish API client (hkra-campaign-publisher plugin).
 */

export interface AudienceList {
  id: string
  title: string
  slug: string
  subscribersCount: number
}

export interface ScheduleTimes {
  scheduledAtLocal: string
  scheduledAtUtc: string
  displayLocal: string
  displayUtc: string
}

const HKT_OFFSET_MS = 8 * 60 * 60 * 1000

export class FluentCrmClient {
  constructor(
    private siteUrl: string,
    private publishToken: string,
  ) {}

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'HKRA-Campaign-Publisher/1.0',
      'X-HKRA-Publish-Token': this.publishToken,
      'Cache-Control': 'no-cache',
    }
  }

  private async request<T>(
    method: string,
    path: string,
    payload?: Record<string, unknown>,
  ): Promise<T> {
    let url = `${this.siteUrl.replace(/\/$/, '')}/wp-json/fluent-crm/v2/${path.replace(/^\//, '')}`
    if (method === 'GET') {
      url += `?_${Date.now()}`
    }

    const res = await fetch(url, {
      method,
      headers: this.headers(),
      body: payload ? JSON.stringify(payload) : undefined,
    })

    const text = await res.text()
    if (!res.ok) {
      throw new Error(`FluentCRM ${method} ${path} (${res.status}): ${text}`)
    }

    const json = text ? JSON.parse(text) : {}
    return (json.data ?? json) as T
  }

  async discovery(): Promise<Record<string, unknown>> {
    try {
      return await this.request('GET', 'hkra-campaigns/discovery')
    } catch {
      return await this.request('GET', 'hkra-campaigns/status')
    }
  }

  async fetchLists(): Promise<AudienceList[]> {
    const payload = await this.request<{ lists?: Array<Record<string, unknown>> }>(
      'GET',
      'hkra-campaigns/audiences',
    )
    const raw = payload.lists ?? []
    return raw
      .map((item) => ({
        id: String(item.id),
        title: String(item.title),
        slug: String(item.slug ?? ''),
        subscribersCount: Number(item.subscribersCount ?? item.totalCount ?? 0),
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  }

  async estimateRecipients(recipients: Array<{ list: string; tag: string }>): Promise<number> {
    const data = await this.request<{ count?: number }>('POST', 'hkra-campaigns/estimate', {
      recipients,
    })
    return Number(data.count ?? 0)
  }

  async publishCampaign(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.request('POST', 'hkra-campaigns/publish', payload)
  }
}

export function recipientsFromListIds(listIds: string[]): Array<{ list: string; tag: string }> {
  return listIds.map((id) => ({ list: id, tag: 'all' }))
}

export function computeDefaultSchedule(offsetDays = 1): ScheduleTimes {
  const now = Date.now()
  const hktNow = new Date(now + HKT_OFFSET_MS)
  const utcDate = new Date(hktNow.getUTCFullYear(), hktNow.getUTCMonth(), hktNow.getUTCDate())
  utcDate.setUTCDate(utcDate.getUTCDate() + offsetDays)

  const scheduledAtLocal = `${utcDate.getUTCFullYear()}-${pad(utcDate.getUTCMonth() + 1)}-${pad(utcDate.getUTCDate())} 09:00:00`
  const scheduledHkt = parseHktLocal(scheduledAtLocal)
  const scheduledUtc = new Date(scheduledHkt.getTime() - HKT_OFFSET_MS)
  const scheduledAtUtc = formatUtc(scheduledUtc)

  return {
    scheduledAtLocal,
    scheduledAtUtc,
    displayLocal: `${scheduledAtLocal} HKT`,
    displayUtc: `${scheduledAtUtc} UTC`,
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseHktLocal(local: string): Date {
  const [datePart, timePart] = local.split(' ')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm, ss] = timePart.split(':').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hh - 8, mm, ss))
}

function formatUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

export const LARGE_AUDIENCE_THRESHOLD = 500
