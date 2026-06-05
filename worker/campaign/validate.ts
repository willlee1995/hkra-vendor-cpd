const REQUIRED_FOOTER_TOKENS = ['##crm.unsubscribe_url##', '{{crm.business_address}}'] as const

/** CJK unified + extension A (Traditional/Simplified on poster text in HTML body). */
const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/

export function adminRequestsBilingualChinese(adminPrompt: string | null | undefined): boolean {
  if (!adminPrompt?.trim()) return false
  return /bilingual|traditional chinese|include chinese|add chinese|chinese copy|chinese subject|繁體|繁体|中英|雙語|双语/i.test(
    adminPrompt,
  )
}

function extractVisibleTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Default vendor CPD emails are English-only unless admin extra prompt requests Chinese. */
export function validateEnglishOnlyEmailCopy(html: string, emailSubject?: string | null): string[] {
  const issues: string[] = []
  const text = extractVisibleTextFromHtml(html)
  if (CJK_REGEX.test(text)) {
    issues.push(
      'email body contains Chinese characters (use English-only copy unless Extra context requests bilingual)',
    )
  }
  if (emailSubject && CJK_REGEX.test(emailSubject)) {
    issues.push(
      'email subject contains Chinese characters (use English-only subject unless Extra context requests bilingual)',
    )
  }
  return issues
}



export function validateHtmlFooter(html: string): string[] {

  return REQUIRED_FOOTER_TOKENS.filter((token) => !html.includes(token))

}



export function validateHtmlStructure(html: string): string[] {

  const normalized = html.toLowerCase()

  const issues: string[] = []

  if (!normalized.includes('<style')) issues.push('<style> block')

  if (!normalized.includes('<html') && !normalized.includes('<!doctype')) {

    issues.push('<html> document wrapper')

  }

  if (!/charset\s*=\s*["']?utf-8/i.test(html)) {

    issues.push('<meta charset="UTF-8">')

  }

  return issues

}



/** Ensure vendor CPD webinar emails include standard CPD/pricing/attendance sections. */

export function validateWebinarEmailSections(html: string): string[] {

  const issues: string[] = []

  const lower = html.toLowerCase()



  if (!/cpd\s*\(pending\)/i.test(html)) {

    issues.push('CPD (Pending) label in banner or body')

  }

  if (!lower.includes('program highlights') && !lower.includes('speaker-card')) {

    issues.push('Program Highlights section with speaker cards')

  }

  if (

    !lower.includes('registration details') &&

    !lower.includes('register now')

  ) {

    issues.push('Registration Details section with REGISTER NOW CTA')

  }

  if (

    !lower.includes('free') ||

    (!lower.includes('cpd platform') && !lower.includes('platform users'))

  ) {

    issues.push('Free for HKRA CPD Platform Users pricing line')

  }

  if (!lower.includes('hkd 50') && !lower.includes('hk$50')) {

    issues.push('HKD 50 for other HKRA Members pricing line')

  }

  if (

    !lower.includes('attendance') ||

    (!lower.includes('zoom') && !lower.includes('cpd instructions'))

  ) {

    issues.push('Attendance & CPD Instructions block (Zoom/webinar)')

  }

  if (!lower.includes('dear colleagues')) {

    issues.push('Dear Colleagues greeting in highlight intro')

  }



  return issues

}



export async function assertPosterUrlsFetchable(urls: string[]): Promise<string | null> {

  for (const url of urls) {

    try {

      const res = await fetch(url, { method: 'HEAD', redirect: 'follow' })

      if (!res.ok && res.status !== 405) {

        return `Poster URL not reachable (${res.status}): ${url}`

      }

    } catch {

      return `Poster URL fetch failed: ${url}`

    }

  }

  return null

}


