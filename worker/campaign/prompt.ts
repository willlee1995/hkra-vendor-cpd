import type { VendorRequestRow } from './types'



const ADMIN_PROMPT_MAX = 8000



/** Trim and cap admin enrichment text for Cursor prompt injection. */

export function normalizeAdminPrompt(raw: string | null | undefined): string | null {

  if (raw == null) return null

  const trimmed = raw.trim()

  if (!trimmed) return null

  return trimmed.length > ADMIN_PROMPT_MAX ? trimmed.slice(0, ADMIN_PROMPT_MAX) : trimmed

}



export function campaignBranchName(requestId: string): string {

  return `campaign/${requestId}`

}



function formatPlatformLine(request: VendorRequestRow): string {

  if (request.zoom_webinar_id) {

    return `Online via Zoom | Presented by ${request.vendor_company_name ?? 'partner'}`

  }

  if (request.on24_key || request.on24_id) {

    return `Online webinar (ON24) | Presented by ${request.vendor_company_name ?? 'partner'}`

  }

  return `Presented by ${request.vendor_company_name ?? 'HKRA'}`

}



function cpdLabel(points: number | null | undefined): string {

  if (points == null) return 'MISSING'

  const n = Number(points)

  return Number.isInteger(n) ? `${n} CPD (Pending)` : `${n} CPD (Pending)`

}



export function buildCampaignPrompt(request: VendorRequestRow, input: {

  registrationUrl: string | null

  posterUrls: string[]

  adminMaterialUrls?: string[]

  adminPrompt?: string | null

}): string {

  const adminPrompt = normalizeAdminPrompt(input.adminPrompt)

  const adminEnrichment = adminPrompt

    ? `\nAdmin extra prompt (apply faithfully; do not contradict vendor context):\n${adminPrompt}\n`

    : ''



  const adminNotes = normalizeAdminPrompt(request.admin_notes)

  const approvalNotes = adminNotes

    ? `\nAdmin notes from CPD approval (include relevant detail in email copy):\n${adminNotes}\n`

    : ''



  const posterForEmail = input.posterUrls.length

    ? input.posterUrls.map((u, i) => `${i + 1}. ${u}`).join('\n')

    : '(no poster image — still include all text sections below)'



  const adminNote =

    input.adminMaterialUrls && input.adminMaterialUrls.length > 0

      ? `\nAdmin-only vetting files (must NOT appear in email): ${input.adminMaterialUrls.length} PDF/document URL(s) on file.`

      : ''



  const vendorHint = request.vendor_company_name?.toLowerCase().includes('bayer')

    ? 'Bayer-sponsored: mirror reference/partner-bayer.html for two-step registration after pricing.'

    : 'Partner/vendor webinar: mirror reference/event-webinar.html structure and depth exactly.'



  const referenceFiles = request.vendor_company_name?.toLowerCase().includes('bayer')

    ? 'reference/partner-bayer.html, reference/footer-template.md, reference/vendor-cpd-webinar-template.md'

    : 'reference/event-webinar.html, reference/footer-template.md, reference/vendor-cpd-webinar-template.md'



  const webinarRules = request.zoom_webinar_id || request.on24_key || request.on24_id

    ? `

Webinar CPD block (mandatory — class .important-note, heading "Attendance & CPD Instructions"):

- Rename Zoom/meeting display name to match full name on Radiographers Board registry

- Use the unique link from confirmation email (not a forwarded link)

- Minimum attendance: extract from poster; if not stated use 45 minutes for CPD eligibility`

    : `

Include an attendance/CPD eligibility note if the poster specifies minimum duration or check-in rules.`



  return `Generate a FULL vendor CPD webinar invitation email (Workflow A). Do NOT publish to FluentCRM.



Read ONLY these files (do not open fluentcrm JSON exports or other reference HTML):

- ${referenceFiles}



Follow reference/vendor-cpd-webinar-template.md for mandatory sections. Match the depth of event-webinar.html (intro paragraphs, Program Highlights speaker cards, registration pricing, attendance instructions) — NOT a minimal poster+button email.



Vendor CPD request context:

- Event: ${request.event_name}

- Dates: ${request.event_start_date} to ${request.event_end_date}

- Times: ${request.event_start_time ?? 'TBD'} – ${request.event_end_time ?? 'TBD'} (display start in banner as GMT+8)

- CPD points: ${cpdLabel(request.expected_cpd_points)} — show in .cpd-badge AND again in highlight intro/body

- Registration URL: ${input.registrationUrl ?? 'MISSING — write output/JOB_STATUS.json with needs_input registration_url'}

- Vendor / co-host: ${request.vendor_company_name ?? 'HKRA'}

- Banner subline (use verbatim pattern): ${formatPlatformLine(request)}

- Zoom webinar ID: ${request.zoom_webinar_id ?? 'n/a'}

- Zoom join URL (attendance instructions only; registration CTA uses HKRA event page): ${request.zoom_join_url ?? 'n/a'}

- ON24 key/id: ${request.on24_key ?? 'n/a'} / ${request.on24_id ?? 'n/a'}

- Email poster image URL (inline <img> only):

${posterForEmail}${adminNote}${approvalNotes}${adminEnrichment}

Template hint: ${vendorHint}

${webinarRules}



Mandatory HTML sections (in order):

1. Header — HKRA logo + "Webinar Invitation"

2. .event-banner — title, date/time (GMT+8), banner subline, .cpd-badge with CPD (Pending)

3. Inline poster <img> when URL above is provided

4. .highlight-box — Dear Colleagues + 2–3 paragraphs + restate CPD grant in body

5. Program Highlights — <h2> + .speaker-card per speaker/session extracted from poster (topic, name, affiliation)

6. .reg-section — Registration Details, Free for HKRA CPD Platform Users, HKD 50 for other HKRA Members, REGISTER NOW button

7. .important-note — Attendance & CPD Instructions (webinars)

8. Closing + verbatim footer from footer-template.md



Content rules:

- English + Traditional Chinese (繁體, Hong Kong) only — never Simplified Chinese; convert poster text if needed

- Do NOT link PDFs/rundowns or add download / "Event materials" sections

- Do NOT fabricate speakers, times, or CPD not on poster/admin notes

- If speakers cannot be read from poster, write output/JOB_STATUS.json {"status":"needs_input","missing":["speakers"]}



Output:

- output/YYYY-MM-DD-{slug}.html + output/YYYY-MM-DD-{slug}.meta.json (reference/campaign-meta.schema.json)

- Commit and push to branch ${campaignBranchName(request.id)}

- If registration URL or CPD missing, JOB_STATUS.json instead of HTML



Do not run publish scripts. Do not schedule FluentCRM.`

}


