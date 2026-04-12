import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUploadPoster } from '@/hooks/useVendorRequests'
import { toast } from 'sonner'
import { normalizeStorageUrl } from '@/lib/storageUtils'
import type { CreateVendorRequestInput, UpdateVendorRequestInput } from '@/lib/vendorTypes'
import { TimePicker } from '@/components/ui/datetime-picker'

const timeToDate = (timeStr: string) => {
  if (!timeStr) return undefined
  const parts = timeStr.split(':').map(Number)
  const date = new Date()
  date.setHours(parts[0] || 0, parts[1] || 0, parts[2] || 0, 0)
  return date
}

const dateToTime = (date: Date | undefined) => {
  if (!date || isNaN(date.getTime())) return ''
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Format a Date as YYYY-MM-DD using local timezone (avoids UTC shift from toISOString) */
const formatLocalDate = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const requestSchema = z.object({
  event_name: z.string().min(1, 'Event name is required'),
  event_start_date: z.date({ message: 'Start date is required' }),
  event_end_date: z.date({ message: 'End date is required' }),
  event_start_time: z.string().min(1, 'Start time is required'),
  event_end_time: z.string().min(1, 'End time is required'),
  vendor_company_name: z.string().min(1, 'Company name is required').optional().or(z.literal('')),
  contact_name: z.string().min(1, 'Contact name is required').optional().or(z.literal('')),
  contact_email: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().email('Invalid email').optional()
  ),
  contact_phone: z.string().optional().or(z.literal('')),
  poster_file_url: z.preprocess(
    (val) => {
      if (!val || val === '') return []
      // Handle both string (legacy) and array formats
      if (Array.isArray(val)) {
        return val.filter(url => url && url !== '')
      }
      if (typeof val === 'string') {
        return [val]
      }
      return []
    },
    z.array(z.string().url()).min(1, 'At least one event-related material file is required')
  ),
  zoom_webinar_id: z.string().optional().or(z.literal('')),
  on24_key: z.string().optional().or(z.literal('')),
  on24_id: z.string().optional().or(z.literal('')),
  expected_promotion_date: z.date().optional(),
}).refine((data) => data.event_end_date >= data.event_start_date, {
  message: 'End date must be after start date',
  path: ['event_end_date'],
})

interface VendorRequestFormProps {
  initialValues?: Partial<CreateVendorRequestInput & { event_start_date?: Date; event_end_date?: Date; expected_promotion_date?: Date; event_start_time?: string; event_end_time?: string }>
  onSubmit: (values: CreateVendorRequestInput | UpdateVendorRequestInput) => Promise<void>
  isLoading?: boolean
  /** When set (e.g. admin creating for a vendor), poster uploads use this vendor's storage folder */
  posterUploadVendorId?: string
}

// Helper function to safely extract error message
function getErrorMessage(errors: any[] | undefined, errorMap?: any): string | null {
  if (!errors || errors.length === 0) {
    // If no errors array, check errorMap
    if (errorMap) {
      for (const key in errorMap) {
        const mapError = errorMap[key]
        if (mapError && typeof mapError === 'object') {
          if ('message' in mapError && mapError.message) {
            return String(mapError.message)
          }
          if ('issues' in mapError && Array.isArray(mapError.issues) && mapError.issues.length > 0) {
            const issue = mapError.issues[0]
            if (issue && typeof issue === 'object' && 'message' in issue) {
              return String(issue.message)
            }
          }
        }
      }
    }
    return null
  }

  const error = errors[0]

  // If it's already a string, return it
  if (typeof error === 'string') return error

  // If it's an empty object, check errorMap instead
  if (error && typeof error === 'object' && Object.keys(error).length === 0) {
    if (errorMap) {
      for (const key in errorMap) {
        const mapError = errorMap[key]
        if (mapError && typeof mapError === 'object' && Object.keys(mapError).length > 0) {
          if ('message' in mapError && mapError.message) {
            return String(mapError.message)
          }
          if ('issues' in mapError && Array.isArray(mapError.issues) && mapError.issues.length > 0) {
            const issue = mapError.issues[0]
            if (issue && typeof issue === 'object' && 'message' in issue) {
              return String(issue.message)
            }
          }
        }
      }
    }
    return null
  }

  // If it's a validator object (has validate/validateAsync), skip it
  if (error && typeof error === 'object' && 'validate' in error && 'validateAsync' in error) {
    return null
  }

  // Try to extract message from various error formats
  if (error && typeof error === 'object') {
    // Check for direct message property
    if ('message' in error && error.message) {
      const msg = error.message
      if (typeof msg === 'string') return msg
      if (typeof msg === 'object' && msg?.message) return String(msg.message)
    }

    // Zod error format: error.issues[0].message
    if ('issues' in error && Array.isArray(error.issues) && error.issues.length > 0) {
      const issue = error.issues[0]
      if (issue && typeof issue === 'object' && 'message' in issue) {
        return String(issue.message)
      }
    }

    // Check for common error object patterns
    const keys = Object.keys(error)
    for (const key of ['message', 'error', 'msg', 'text', 'description']) {
      if (keys.includes(key) && error[key]) {
        const value = error[key]
        if (typeof value === 'string') return value
        if (typeof value === 'object' && value?.message) return String(value.message)
      }
    }

    // Last resort: try to stringify and look for message
    try {
      const str = JSON.stringify(error)
      const match = str.match(/"message"\s*:\s*"([^"]+)"/)
      if (match && match[1]) {
        return match[1]
      }
    } catch {
      // Ignore JSON errors
    }
  }

  // Fallback - don't show "[object Object]"
  return null
}

export function VendorRequestForm({ initialValues, onSubmit, isLoading, posterUploadVendorId }: VendorRequestFormProps) {
  const uploadPoster = useUploadPoster()

  const form = useForm({
    defaultValues: {
      event_name: initialValues?.event_name || '',
      event_start_date: initialValues?.event_start_date || undefined,
      event_end_date: initialValues?.event_end_date || undefined,
      event_start_time: initialValues?.event_start_time || '',
      event_end_time: initialValues?.event_end_time || '',
      vendor_company_name: initialValues?.vendor_company_name || '',
      contact_name: initialValues?.contact_name || '',
      contact_email: initialValues?.contact_email || '',
      contact_phone: initialValues?.contact_phone || '',
      poster_file_url: Array.isArray(initialValues?.poster_file_url)
        ? initialValues.poster_file_url
        : initialValues?.poster_file_url
          ? [initialValues.poster_file_url]
          : [],
      zoom_webinar_id: initialValues?.zoom_webinar_id || '',
      on24_key: initialValues?.on24_key || '',
      on24_id: initialValues?.on24_id || '',
      expected_promotion_date: initialValues?.expected_promotion_date || undefined,
    },
    onSubmit: async ({ value }) => {
      try {
        // Validate required fields
        if (!value.event_name || !value.event_start_date || !value.event_end_date || !value.event_start_time || !value.event_end_time) {
          throw new Error('Please fill in all required fields')
        }

        const submitData: CreateVendorRequestInput = {
          event_name: value.event_name,
          event_start_date: formatLocalDate(value.event_start_date),
          event_end_date: formatLocalDate(value.event_end_date),
          event_start_time: value.event_start_time,
          event_end_time: value.event_end_time,
          vendor_company_name: value.vendor_company_name || undefined,
          contact_name: value.contact_name || undefined,
          contact_email: value.contact_email || undefined,
          contact_phone: value.contact_phone || undefined,
          poster_file_url: value.poster_file_url && value.poster_file_url.length > 0 ? value.poster_file_url : undefined,
          zoom_webinar_id: value.zoom_webinar_id || undefined,
          on24_key: value.on24_key || undefined,
          on24_id: value.on24_id || undefined,
          expected_promotion_date: value.expected_promotion_date ? formatLocalDate(value.expected_promotion_date) : undefined,
        }
        await onSubmit(submitData)
      } catch (error: any) {
        console.error('onSubmit error:', error)
        throw error // Re-throw to be caught by handleFormSubmit
      }
    },
  })

  // Update form values when initialValues change
  useEffect(() => {
    if (initialValues) {
      if (initialValues.vendor_company_name !== undefined) {
        form.setFieldValue('vendor_company_name', initialValues.vendor_company_name || '')
      }
      if (initialValues.contact_name !== undefined) {
        form.setFieldValue('contact_name', initialValues.contact_name || '')
      }
      if (initialValues.contact_email !== undefined) {
        form.setFieldValue('contact_email', initialValues.contact_email || '')
      }
      if (initialValues.contact_phone !== undefined) {
        form.setFieldValue('contact_phone', initialValues.contact_phone || '')
      }
    }
  }, [initialValues, form])

  const [posterUploadError, setPosterUploadError] = useState<string | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setPosterUploadError(null)

    // Validate all files
    const invalidFiles: string[] = []
    files.forEach(file => {
      if (!file.type.startsWith('image/')) {
        invalidFiles.push(`${file.name}: Not an image file`)
      }
      if (file.size > 50 * 1024 * 1024) {
        invalidFiles.push(`${file.name}: File size exceeds 50MB`)
      }
    })

    if (invalidFiles.length > 0) {
      setPosterUploadError(invalidFiles.join(', '))
      return
    }

    try {
      const urls = await uploadPoster.mutateAsync({ files, vendorId: posterUploadVendorId })
      // Normalize URLs to fix any internal hostnames
      const normalizedUrls = urls.map(url => normalizeStorageUrl(url))
      // Merge with existing URLs
      const currentUrls = Array.isArray(form.state.values.poster_file_url)
        ? form.state.values.poster_file_url
        : form.state.values.poster_file_url
          ? [form.state.values.poster_file_url]
          : []
      form.setFieldValue('poster_file_url', [...currentUrls, ...normalizedUrls])
      setPosterUploadError(null)
      toast.success(`Successfully uploaded ${urls.length} file(s)`)
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error?.message || 'Failed to upload files. Please try again.'
      setPosterUploadError(errorMessage)

      // If vendor record not found, provide helpful guidance
      if (errorMessage.includes('Vendor account not set up') || errorMessage.includes('Vendor record not found')) {
        toast.error('Vendor account not set up. Please contact administrator to create your vendor profile before uploading files.')
      } else {
        toast.error(errorMessage)
      }
    }
  }

  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setSubmitError(null)

    // Mark all required fields as touched so errors will show
    const requiredFields = ['event_name', 'event_start_date', 'event_end_date', 'event_start_time', 'event_end_time'] as const
    requiredFields.forEach(fieldName => {
      form.setFieldMeta(fieldName as any, (prev) => ({ ...prev, isTouched: true }))
    })

    // Validate all fields first and wait for completion
    const validationResult = await form.validateAllFields('submit')

    // Wait a tick for state to update
    await new Promise(resolve => setTimeout(resolve, 0))

    // Check form state after validation
    const formState = form.state
    console.log('Form state after validation:', {
      isValid: formState.isValid,
      errors: formState.errors,
      fieldErrors: formState.fieldMeta,
      values: formState.values,
      validationResult,
    })

    // Validate against Zod schema directly
    const values = formState.values
    // Ensure dates are Date objects (they might be serialized as strings)
    const valuesForValidation = {
      ...values,
      event_start_date: (values.event_start_date && typeof values.event_start_date === 'object' && 'getTime' in values.event_start_date)
        ? values.event_start_date as Date
        : (values.event_start_date ? new Date(values.event_start_date as string) : undefined),
      event_end_date: (values.event_end_date && typeof values.event_end_date === 'object' && 'getTime' in values.event_end_date)
        ? values.event_end_date as Date
        : (values.event_end_date ? new Date(values.event_end_date as string) : undefined),
      expected_promotion_date: values.expected_promotion_date ?
        ((values.expected_promotion_date && typeof values.expected_promotion_date === 'object' && 'getTime' in values.expected_promotion_date)
          ? values.expected_promotion_date as Date
          : new Date(values.expected_promotion_date as string)) :
        undefined,
    }
    const schemaResult = requestSchema.safeParse(valuesForValidation)

    console.log('Schema validation result:', {
      success: schemaResult.success,
      error: schemaResult.success ? null : schemaResult.error?.issues,
      valuesForValidation,
    })

    // Also manually check required fields
    const missingRequiredFields = []
    if (!values.event_name || values.event_name.trim() === '') {
      missingRequiredFields.push('Event name')
    }
    if (!values.event_start_date) {
      missingRequiredFields.push('Event start date')
    }
    if (!values.event_start_time || values.event_start_time.trim() === '') {
      missingRequiredFields.push('Event start time')
    }
    const posterUrls = Array.isArray(values.poster_file_url) ? values.poster_file_url : (values.poster_file_url ? [values.poster_file_url] : [])
    if (posterUrls.length === 0) {
      missingRequiredFields.push('Event related materials')
    }
    if (!values.event_end_date) {
      missingRequiredFields.push('Event end date')
    }
    if (!values.event_end_time || values.event_end_time.trim() === '') {
      missingRequiredFields.push('Event end time')
    }

    // Check if validation passed
    const hasSchemaErrors = !schemaResult.success
    const hasFormErrors = !formState.isValid

    // If schema validation passes and required fields are filled, allow submission
    // (even if form state says invalid, schema is the source of truth)
    if (schemaResult.success && missingRequiredFields.length === 0 && !hasSchemaErrors) {
      // Form is valid, proceed with submission
      // Since schema validation passed, we can directly call onSubmit with the values
      try {
        const submitData: CreateVendorRequestInput = {
          event_name: values.event_name,
          event_start_date: formatLocalDate(valuesForValidation.event_start_date!),
          event_end_date: formatLocalDate(valuesForValidation.event_end_date!),
          event_start_time: values.event_start_time,
          event_end_time: values.event_end_time,
          vendor_company_name: values.vendor_company_name || undefined,
          contact_name: values.contact_name || undefined,
          contact_email: values.contact_email || undefined,
          contact_phone: values.contact_phone || undefined,
          poster_file_url: Array.isArray(values.poster_file_url) ? values.poster_file_url : (values.poster_file_url ? [values.poster_file_url] : undefined),
          zoom_webinar_id: values.zoom_webinar_id || undefined,
          on24_key: values.on24_key || undefined,
          on24_id: values.on24_id || undefined,
          expected_promotion_date: valuesForValidation.expected_promotion_date ? formatLocalDate(valuesForValidation.expected_promotion_date) : undefined,
        }

        console.log('Submitting form with data:', submitData)
        await onSubmit(submitData)
        return
      } catch (error: any) {
        console.error('Form submission error:', error)
        const errorMessage = error?.message || 'Failed to submit form. Please check all fields and try again.'
        setSubmitError(errorMessage)
        toast.error(errorMessage)
        return
      }
    }

    // If form is invalid, has schema errors, or missing required fields, show them
    if (hasFormErrors || hasSchemaErrors || missingRequiredFields.length > 0) {
      // Try to get first error from any field
      const fieldNames = Object.keys(formState.fieldMeta) as Array<keyof typeof formState.fieldMeta>
      let firstErrorMsg: string | null = null

      for (const fieldName of fieldNames) {
        const fieldMeta = formState.fieldMeta[fieldName]
        // Check both errors array and errorMap
        if (fieldMeta?.errors && fieldMeta.errors.length > 0) {
          const errorMsg = getErrorMessage(fieldMeta.errors, fieldMeta.errorMap)
          if (errorMsg) {
            firstErrorMsg = errorMsg
            break
          }
        } else if (fieldMeta?.errorMap && Object.keys(fieldMeta.errorMap).length > 0) {
          const errorMsg = getErrorMessage(undefined, fieldMeta.errorMap)
          if (errorMsg) {
            firstErrorMsg = errorMsg
            break
          }
        }
      }

      // If schema validation failed, use schema error messages
      if (hasSchemaErrors && schemaResult.error) {
        const schemaError = schemaResult.error.issues[0]
        if (schemaError) {
          const errorMsg = schemaError.message || 'Validation error'
          setSubmitError(`Please fix: ${errorMsg}`)
          toast.error(`Please fix: ${errorMsg}`)
          return
        }
      }

      if (firstErrorMsg) {
        setSubmitError(`Please fix errors: ${firstErrorMsg}`)
        toast.error(`Please fix errors: ${firstErrorMsg}`)
      } else if (missingRequiredFields.length > 0) {
        setSubmitError(`Please fill in: ${missingRequiredFields.join(', ')}`)
        toast.error(`Please fill in: ${missingRequiredFields.join(', ')}`)
      } else {
        // Fallback error message
        setSubmitError('Please fill in all required fields')
        toast.error('Please fill in all required fields')
      }
      return
    }
  }

  return (
    <form
      onSubmit={handleFormSubmit}
      className="space-y-6"
    >
      <form.Field
        name="event_name"
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Event Name *</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {(() => {
              const errorMsg = getErrorMessage(field.state.meta.errors, field.state.meta.errorMap)
              // Show error if field is touched or if there are errors (for submit validation)
              const hasErrors = field.state.meta.errors.length > 0 || (field.state.meta.errorMap && Object.keys(field.state.meta.errorMap).length > 0)
              const shouldShowError = errorMsg && (field.state.meta.isTouched || hasErrors)
              return shouldShowError ? (
                <p className="text-sm text-red-500">{errorMsg}</p>
              ) : null
            })()}
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form.Field
          name="event_start_date"
        >
          {(field) => (
            <div className="space-y-2">
              <Label>Event Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.state.value && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.state.value ? format(field.state.value, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.state.value}
                    onSelect={(date) => {
                      if (date) {
                        field.handleChange(date as any)
                        // Auto-set end date to start date if end date is not set
                        const currentEndDate = form.state.values.event_end_date
                        if (!currentEndDate) {
                          form.setFieldValue('event_end_date', date as any)
                        }
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {(() => {
                const errorMsg = getErrorMessage(field.state.meta.errors)
                return errorMsg ? (
                  <p className="text-sm text-red-500">{errorMsg}</p>
                ) : null
              })()}
            </div>
          )}
        </form.Field>

        <form.Field
          name="event_end_date"
        >
          {(field) => (
            <div className="space-y-2">
              <Label>Event End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !field.state.value && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.state.value ? format(field.state.value, 'PPP') : 'Pick a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={field.state.value}
                    onSelect={(date) => {
                      if (date) {
                        field.handleChange(date as any)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {(() => {
                const errorMsg = getErrorMessage(field.state.meta.errors)
                return errorMsg ? (
                  <p className="text-sm text-red-500">{errorMsg}</p>
                ) : null
              })()}
            </div>
          )}
        </form.Field>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form.Field
          name="event_start_time"
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Event Start Time *</Label>
              <div className="flex items-center">
                <TimePicker
                  date={timeToDate(field.state.value)}
                  onChange={(date) => field.handleChange(date ? dateToTime(date) : '')}
                  granularity="minute"
                  hourCycle={24}
                />
              </div>
              {(() => {
                const errorMsg = getErrorMessage(field.state.meta.errors, field.state.meta.errorMap)
                const hasErrors = field.state.meta.errors.length > 0 || (field.state.meta.errorMap && Object.keys(field.state.meta.errorMap).length > 0)
                const shouldShowError = errorMsg && (field.state.meta.isTouched || hasErrors)
                return shouldShowError ? (
                  <p className="text-sm text-red-500">{errorMsg}</p>
                ) : null
              })()}
            </div>
          )}
        </form.Field>

        <form.Field
          name="event_end_time"
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Event End Time *</Label>
              <div className="flex items-center">
                <TimePicker
                  date={timeToDate(field.state.value)}
                  onChange={(date) => field.handleChange(date ? dateToTime(date) : '')}
                  granularity="minute"
                  hourCycle={24}
                />
              </div>
              {(() => {
                const errorMsg = getErrorMessage(field.state.meta.errors, field.state.meta.errorMap)
                const hasErrors = field.state.meta.errors.length > 0 || (field.state.meta.errorMap && Object.keys(field.state.meta.errorMap).length > 0)
                const shouldShowError = errorMsg && (field.state.meta.isTouched || hasErrors)
                return shouldShowError ? (
                  <p className="text-sm text-red-500">{errorMsg}</p>
                ) : null
              })()}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="vendor_company_name">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Company Name</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form.Field name="contact_name">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Contact Name</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
            </div>
          )}
        </form.Field>

        <form.Field
          name="contact_email"
        >
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Contact Email</Label>
              <Input
                id={field.name}
                type="email"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
              />
              {(() => {
                const errorMsg = getErrorMessage(field.state.meta.errors)
                return errorMsg ? (
                  <p className="text-sm text-red-500">{errorMsg}</p>
                ) : null
              })()}
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="contact_phone">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Contact Phone</Label>
            <Input
              id={field.name}
              type="tel"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="poster_file_url">
        {(field) => {
          const fileUrls = Array.isArray(field.state.value)
            ? field.state.value
            : field.state.value
              ? [field.state.value]
              : []

          const removeFile = (indexToRemove: number) => {
            const updatedUrls = fileUrls.filter((_, index) => index !== indexToRemove)
            form.setFieldValue('poster_file_url', updatedUrls.length > 0 ? updatedUrls : [])
          }

          return (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="event-materials">Event related materials</Label>
                <span
                  className="text-xs text-muted-foreground cursor-help"
                  title="For example poster, rundown"
                >
                  (ℹ️)
                </span>
              </div>
              <div className="space-y-2">
                <Input
                  id="event-materials"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploadPoster.isPending}
                  className="cursor-pointer"
                />
                {fileUrls.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Uploaded files ({fileUrls.length}):
                    </p>
                    <div className="space-y-1">
                      {fileUrls.map((url, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <a
                            href={normalizeStorageUrl(url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline dark:text-blue-400 flex-1 truncate"
                          >
                            View file {index + 1}
                          </a>
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {uploadPoster.isPending && (
                <p className="text-sm text-muted-foreground">Uploading...</p>
              )}
              {posterUploadError && (
                <p className="text-sm text-red-500">{posterUploadError}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Required: Upload at least one event-related material file such as posters, rundowns, etc. (max 50MB per file).
              </p>
            </div>
          )
        }}
      </form.Field>

      <form.Field name="zoom_webinar_id">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Zoom Webinar ID</Label>
            <Input
              id={field.name}
              type="text"
              value={field.state.value || ''}
              onChange={(e) => field.handleChange(e.target.value)}
              placeholder="e.g., 123456789"
            />
            <p className="text-sm text-muted-foreground">
              Optional: Enter the Zoom webinar ID if this is an online event.
            </p>
          </div>
        )}
      </form.Field>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <form.Field name="on24_key">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>ON24 Key</Label>
              <Input
                id={field.name}
                type="text"
                value={field.state.value || ''}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g., 1234abcd"
              />
              <p className="text-sm text-muted-foreground">
                Optional: For ON24 integration only.
              </p>
            </div>
          )}
        </form.Field>

        <form.Field name="on24_id">
          {(field) => (
            <div className="space-y-2">
              <Label htmlFor={field.name}>ON24 ID</Label>
              <Input
                id={field.name}
                type="text"
                value={field.state.value || ''}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g., 9876543"
              />
              <p className="text-sm text-muted-foreground">
                Optional: For ON24 integration only.
              </p>
            </div>
          )}
        </form.Field>
      </div>

      <form.Field name="expected_promotion_date">
        {(field) => (
          <div className="space-y-2">
            <Label>Expected Promotion Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !field.state.value && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {field.state.value ? format(field.state.value, 'PPP') : 'Pick a date (optional)'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={field.state.value}
                  onSelect={(date) => field.handleChange(date as any)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        )}
      </form.Field>

      {submitError && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{submitError}</p>
        </div>
      )}
      <div className="flex gap-4">
        <Button type="submit" disabled={isLoading || uploadPoster.isPending}>
          {isLoading ? 'Submitting...' : 'Submit Request'}
        </Button>
      </div>
    </form>
  )
}

