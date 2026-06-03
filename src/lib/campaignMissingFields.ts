/** Labels for email_campaign_jobs.missing_fields — keep in sync with worker/campaign/job-status.ts */
export const CAMPAIGN_MISSING_FIELD_LABELS: Record<string, string> = {
  speakers: 'Speaker names, talk titles, and affiliations',
  registration_url: 'HKRA event registration URL',
  cpd: 'CPD points',
  poster: 'Poster / event details readable from image',
  email_content: 'Program highlights, pricing, and attendance rules',
  fees: 'Registration fees (if not standard Free / HKD 50)',
}

export function campaignMissingFieldLabel(key: string): string {
  return CAMPAIGN_MISSING_FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
}
