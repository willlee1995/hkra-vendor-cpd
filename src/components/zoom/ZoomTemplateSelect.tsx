import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useZoomWebinarTemplates } from '@/hooks/useZoomWebinarTemplates'
import { encodeZoomTemplateValue } from '@/lib/zoomTypes'

interface ZoomTemplateSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
  label?: string
  description?: string
}

export function ZoomTemplateSelect({
  value,
  onChange,
  disabled,
  id = 'zoom_template_selection',
  label = 'Zoom webinar template',
  description,
}: ZoomTemplateSelectProps) {
  const { data: zoomTemplates, isLoading, isError } = useZoomWebinarTemplates({ enabled: true })

  return (
    <div className="space-y-2">
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || '__default__'}
        onValueChange={(v) => onChange(v === '__default__' ? '' : v)}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id={id}>
          <SelectValue placeholder={isLoading ? 'Loading webinars…' : 'Select a template'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">HKRA default settings (no template)</SelectItem>
          {(zoomTemplates?.items ?? []).map((item) => (
            <SelectItem key={`${item.kind}:${item.id}`} value={encodeZoomTemplateValue(item.kind, item.id)}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && (
        <p className="text-sm text-destructive">Could not load Zoom webinars. You can continue without a template.</p>
      )}
      {!isLoading && zoomTemplates?.configured === false && (
        <p className="text-sm text-amber-700">{zoomTemplates?.message ?? 'Zoom is not configured; default settings will be used.'}</p>
      )}
      {!isLoading && zoomTemplates?.configured && (zoomTemplates?.items?.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">No historical webinars found yet. Default settings will be used.</p>
      )}
    </div>
  )
}
