/** Decode GitHub API base64 file content as UTF-8 (atob alone corrupts CJK). */
export function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * Repair UTF-8 text that was mis-read as Latin-1 (e.g. 粤 → ç²¤æ¸¯).
 * No-op when content already contains CJK or repair fails.
 */
export function repairUtf8Mojibake(text: string): string {
  if (/[\u4e00-\u9fff]/.test(text)) {
    return text
  }
  if (!/[ÃÂâ€ï¼çæ]/.test(text)) {
    return text
  }
  try {
    const bytes = Uint8Array.from(text, (c) => c.charCodeAt(0) & 0xff)
    const repaired = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (/[\u4e00-\u9fff]/.test(repaired)) {
      return repaired
    }
  } catch {
    // keep original
  }
  return text
}

/** Ensure HTML declares UTF-8 for FluentCRM preview and email clients. */
export function ensureHtmlUtf8Document(html: string): string {
  if (/charset\s*=\s*["']?utf-8/i.test(html)) {
    return html
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, '<head$1>\n<meta charset="UTF-8">')
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, '<html$1>\n<head><meta charset="UTF-8"></head>')
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${html}</body></html>`
}

const IMAGE_EXT = /\.(?:jpe?g|png|gif|webp)(\?|#|$)/i

export function normalizeCampaignHtml(html: string): string {
  return stripPosterDownloadLinksFromEmailHtml(
    stripPdfLinksFromEmailHtml(ensureHtmlUtf8Document(repairUtf8Mojibake(html))),
  )
}

/** Remove PDF download links — vetting docs must not appear in member-facing email. */
export function stripPdfLinksFromEmailHtml(html: string): string {
  return html
    .replace(/<a\b[^>]*href=["'][^"']*\.pdf[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<li[^>]*>\s*Supporting document[^<]*<\/li>/gi, '')
}

/**
 * Poster is shown inline only — strip download links and "event materials" blocks.
 * Keeps <img src="..."> and registration CTAs to hkra.org.hk.
 */
export function stripPosterDownloadLinksFromEmailHtml(html: string): string {
  let out = html
  // Unwrap links whose href is an image file (poster-as-download pattern)
  out = out.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*(<img\b[^>]*>)\s*<\/a>/gi,
    (match, href: string, img: string) => (IMAGE_EXT.test(href.split('#')[0]) ? img : match),
  )
  // Remove anchor links to image/PDF files
  out = out.replace(/<a\b[^>]*href=["'][^"']*\.(?:pdf|jpe?g|png|gif|webp)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
  // Event materials / download sections agents sometimes add
  out = out.replace(
    /<h[1-4][^>]*>\s*(?:Event\s+materials|Download\s+poster|Poster\s+download)[^<]*<\/h[1-4]>[\s\S]*?(?=<h[1-4]|<div[^>]*class=["'][^"']*footer|<\/body)/gi,
    '',
  )
  out = out.replace(/<li[^>]*>[\s\S]*?(?:download|Download|poster link|Event poster|Supporting document|event materials)[\s\S]*?<\/li>/gi, '')
  out = out.replace(
    /<p[^>]*>[\s\S]*?(?:download (?:the )?poster|Download poster|attached event poster|event materials)[\s\S]*?<\/p>/gi,
    '',
  )
  // Drop empty lists left behind
  out = out.replace(/<ul[^>]*>\s*<\/ul>/gi, '')
  return out
}
