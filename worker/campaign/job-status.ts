export interface CampaignJobStatusFile {
  status: string
  missing?: string[]
  message?: string
}

const FIELD_LABELS: Record<string, string> = {
  speakers: 'Speaker names, talk titles, and affiliations',
  registration_url: 'HKRA event registration URL (create/sync the WordPress event first)',
  cpd: 'CPD points for this event',
  poster: 'Readable poster image (speakers and event details visible)',
  email_content: 'Email body details (program highlights, pricing, attendance rules)',
  fees: 'Registration fees (if not standard Free / HKD 50)',
}

export function parseJobStatusFile(text: string): CampaignJobStatusFile | null {
  try {
    const data = JSON.parse(text) as CampaignJobStatusFile
    if (data.status !== 'needs_input') return null
    return data
  } catch {
    return null
  }
}

export function normalizeMissingFields(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.map((v) => String(v).trim()).filter(Boolean))]
}

export function labelMissingField(key: string): string {
  return FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}

export function formatMissingFieldsMessage(missing: string[], prefix?: string): string {
  const lines = missing.map((k) => `- ${labelMissingField(k)}`)
  const head = prefix ?? 'Additional information required before the email can be generated:'
  return `${head}\n${lines.join('\n')}`
}

export class CampaignNeedsInputError extends Error {
  readonly missing: string[]

  constructor(missing: string[], message: string) {
    super(message)
    this.name = 'CampaignNeedsInputError'
    this.missing = missing
  }
}

/** Map worker HTML section validation gaps to admin-actionable missing keys. */
export function missingFromSectionValidation(issues: string[]): string[] {
  const missing = new Set<string>()
  for (const issue of issues) {
    const lower = issue.toLowerCase()
    if (lower.includes('program highlights') || lower.includes('speaker')) {
      missing.add('speakers')
    } else if (lower.includes('registration')) {
      missing.add('email_content')
    } else if (lower.includes('attendance') || lower.includes('cpd instructions')) {
      missing.add('email_content')
    } else if (lower.includes('cpd (pending)')) {
      missing.add('cpd')
    } else if (lower.includes('hkd 50') || lower.includes('cpd platform')) {
      missing.add('fees')
    } else {
      missing.add('email_content')
    }
  }
  return [...missing]
}

export function requiresAdminPromptToContinue(missing: string[]): boolean {
  if (missing.length === 0) return true
  const onlyRegistration =
    missing.length === 1 && missing[0] === 'registration_url'
  return !onlyRegistration
}
