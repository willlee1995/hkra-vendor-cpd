export type ZoomTemplateKind = 'template' | 'webinar' | 'past'

export interface ZoomWebinarTemplateOption {
  id: string
  kind: ZoomTemplateKind
  topic: string
  start_time?: string | null
  label: string
}

/** Form select value: `kind:id` */
export function encodeZoomTemplateValue(kind: ZoomTemplateKind, id: string): string {
  return `${kind}:${id}`
}

export function decodeZoomTemplateValue(
  value: string,
): { kind: ZoomTemplateKind; id: string } | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const idx = trimmed.indexOf(':')
  if (idx <= 0) return null
  const kind = trimmed.slice(0, idx) as ZoomTemplateKind
  const id = trimmed.slice(idx + 1)
  if (!id || !['template', 'webinar', 'past'].includes(kind)) return null
  return { kind, id }
}
