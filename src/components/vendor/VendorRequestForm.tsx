import { useState, useEffect } from 'react'
import { useForm } from '@tanstack/react-form'
import { zodValidator } from '@tanstack/zod-form-adapter'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUploadPoster } from '@/hooks/useVendorRequests'
import { toast } from 'sonner'
import type { CreateVendorRequestInput, UpdateVendorRequestInput } from '@/lib/vendorTypes'

const requestSchema = z.object({
  event_name: z.string().min(1, 'Event name is required'),
  event_start_date: z.date({ required_error: 'Start date is required' }),
  event_end_date: z.date({ required_error: 'End date is required' }),
  expected_cpd_points: z.number().min(0.5).max(8.0),
  vendor_company_name: z.string().min(1, 'Company name is required').optional().or(z.literal('')),
  contact_name: z.string().min(1, 'Contact name is required').optional().or(z.literal('')),
  contact_email: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().email('Invalid email').optional()
  ),
  contact_phone: z.string().optional().or(z.literal('')),
  poster_file_url: z.preprocess(
    (val) => val === '' ? undefined : val,
    z.string().url().optional()
  ),
  expected_promotion_date: z.date().optional(),
}).refine((data) => data.event_end_date >= data.event_start_date, {
  message: 'End date must be after start date',
  path: ['event_end_date'],
})

interface VendorRequestFormProps {
  initialValues?: Partial<CreateVendorRequestInput & { event_start_date?: Date; event_end_date?: Date; expected_promotion_date?: Date }>
  onSubmit: (values: CreateVendorRequestInput | UpdateVendorRequestInput) => Promise<void>
  isLoading?: boolean
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

export function VendorRequestForm({ initialValues, onSubmit, isLoading }: VendorRequestFormProps) {
  const uploadPoster = useUploadPoster()

  const form = useForm({
    defaultValues: {
      event_name: initialValues?.event_name || '',
      event_start_date: initialValues?.event_start_date || undefined,
      event_end_date: initialValues?.event_end_date || undefined,
      expected_cpd_points: initialValues?.expected_cpd_points || 1.0,
      vendor_company_name: initialValues?.vendor_company_name || '',
      contact_name: initialValues?.contact_name || '',
      contact_email: initialValues?.contact_email || '',
      contact_phone: initialValues?.contact_phone || '',
      poster_file_url: initialValues?.poster_file_url || '',
      expected_promotion_date: initialValues?.expected_promotion_date || undefined,
    },
    validatorAdapter: zodValidator(),
    defaultMeta: {
      isTouched: false,
    },
    onSubmit: async ({ value }) => {
      try {
        // Validate required fields
        if (!value.event_name || !value.event_start_date || !value.event_end_date) {
          throw new Error('Please fill in all required fields')
        }

        const submitData: CreateVendorRequestInput = {
          event_name: value.event_name,
          event_start_date: value.event_start_date.toISOString().split('T')[0],
          event_end_date: value.event_end_date.toISOString().split('T')[0],
          expected_cpd_points: value.expected_cpd_points,
          vendor_company_name: value.vendor_company_name || undefined,
          contact_name: value.contact_name || undefined,
          contact_email: value.contact_email || undefined,
          contact_phone: value.contact_phone || undefined,
          poster_file_url: value.poster_file_url || undefined,
          expected_promotion_date: value.expected_promotion_date?.toISOString().split('T')[0] || undefined,
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
    const file = e.target.files?.[0]
    if (!file) return

    setPosterUploadError(null)

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setPosterUploadError('Please upload an image file')
      return
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
      setPosterUploadError('File size must be less than 50MB')
      return
    }

    try {
      const url = await uploadPoster.mutateAsync(file)
      form.setFieldValue('poster_file_url', url)
      setPosterUploadError(null)
    } catch (error: any) {
      console.error('Upload error:', error)
      const errorMessage = error?.message || 'Failed to upload poster. Please try again.'
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
    const requiredFields = ['event_name', 'event_start_date', 'event_end_date']
    requiredFields.forEach(fieldName => {
      form.setFieldMeta(fieldName, (prev) => ({ ...prev, isTouched: true }))
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
      event_start_date: values.event_start_date instanceof Date ? values.event_start_date : (values.event_start_date ? new Date(values.event_start_date) : undefined),
      event_end_date: values.event_end_date instanceof Date ? values.event_end_date : (values.event_end_date ? new Date(values.event_end_date) : undefined),
      expected_promotion_date: values.expected_promotion_date ?
        (values.expected_promotion_date instanceof Date ? values.expected_promotion_date : new Date(values.expected_promotion_date)) :
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
    if (!values.event_end_date) {
      missingRequiredFields.push('Event end date')
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
          event_start_date: valuesForValidation.event_start_date.toISOString().split('T')[0],
          event_end_date: valuesForValidation.event_end_date.toISOString().split('T')[0],
          expected_cpd_points: values.expected_cpd_points,
          vendor_company_name: values.vendor_company_name || undefined,
          contact_name: values.contact_name || undefined,
          contact_email: values.contact_email || undefined,
          contact_phone: values.contact_phone || undefined,
          poster_file_url: values.poster_file_url || undefined,
          expected_promotion_date: valuesForValidation.expected_promotion_date?.toISOString().split('T')[0] || undefined,
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
      const fieldNames = Object.keys(formState.fieldMeta)
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
        validators={{
          onChange: zodValidator(z.string().min(1, 'Event name is required')),
        }}
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
          validators={{
            onChange: zodValidator(z.date({ required_error: 'Start date is required' })),
          }}
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
                        field.handleChange(date)
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
          validators={{
            onChange: zodValidator(z.date({ required_error: 'End date is required' })),
          }}
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
                        field.handleChange(date)
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

      <form.Field
        name="expected_cpd_points"
        validators={{
          onChange: zodValidator(z.number().min(0.5).max(8.0)),
        }}
      >
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={field.name}>Expected CPD Points (0.5 - 8.0) *</Label>
            <Input
              id={field.name}
              type="number"
              step="0.5"
              min="0.5"
              max="8.0"
              value={field.state.value}
              onChange={(e) => field.handleChange(parseFloat(e.target.value) || 0)}
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
          validators={{
            onChange: zodValidator(z.string().email('Invalid email').optional().or(z.literal(''))),
          }}
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
        {(field) => (
          <div className="space-y-2">
            <Label>Event Poster</Label>
            <div className="flex items-center gap-4">
              <Input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploadPoster.isPending}
                className="cursor-pointer"
              />
              {field.state.value && (
                <a
                  href={field.state.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                >
                  View uploaded poster
                </a>
              )}
            </div>
            {uploadPoster.isPending && (
              <p className="text-sm text-muted-foreground">Uploading...</p>
            )}
            {posterUploadError && (
              <p className="text-sm text-red-500">{posterUploadError}</p>
            )}
            <p className="text-sm text-muted-foreground">
              Optional: Upload an event poster image (max 50MB). You can submit the form without a poster.
            </p>
          </div>
        )}
      </form.Field>

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
                  onSelect={(date) => field.handleChange(date)}
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

