// Email utility functions for sending notifications

interface EmailOptions {
  to: string
  subject: string
  html: string
}

/**
 * Send email using Resend API
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'noreply@hkra.org.hk'

  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not set, skipping email send')
    return
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Failed to send email:', error)
      throw new Error(`Email send failed: ${error}`)
    }

    const result = await response.json()
    console.log('Email sent successfully:', result.id)
  } catch (error) {
    console.error('Error sending email:', error)
    // Re-throw so callers can handle it appropriately
    throw error
  }
}

/**
 * Generate confirmation email HTML for requestor
 */
export function generateRequestorConfirmationEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  expected_cpd_points: number | null
  contact_name: string
  request_id: string
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CPD Request Received</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h1 style="color: #2563eb; margin-top: 0;">CPD Request Received</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>Thank you for submitting your CPD request. We have received your request and it is now under review.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Request Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        ${request.expected_cpd_points
          ? '<p><strong>CPD Points:</strong> ' + request.expected_cpd_points + '</p>'
          : '<p><strong>CPD Points:</strong> To be determined by admin</p>'}
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      <p>Our team will review your request and notify you once a decision has been made. You can check the status of your request in the vendor portal.</p>

      <p>If you have any questions or need to make changes to your request, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate admin notification email HTML
 */
export function generateAdminNotificationEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  expected_cpd_points: number | null
  vendor_company_name: string
  contact_name: string
  contact_email: string
  contact_phone?: string
  request_id: string
  created_at: string
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const createdAt = new Date(request.created_at).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New CPD Request Requires Approval</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
        <h1 style="color: #92400e; margin-top: 0;">⚠️ New CPD Request Requires Approval</h1>
      </div>

      <p>A new CPD request has been submitted and requires your review and approval.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Request Details</h2>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        ${request.expected_cpd_points
          ? '<p><strong>CPD Points:</strong> ' + request.expected_cpd_points + '</p>'
          : '<p><strong>CPD Points:</strong> To be determined by admin</p>'}
        <p><strong>Submitted:</strong> ${createdAt}</p>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Vendor Information</h2>
        <p><strong>Company:</strong> ${request.vendor_company_name}</p>
        <p><strong>Contact Name:</strong> ${request.contact_name}</p>
        <p><strong>Contact Email:</strong> <a href="mailto:${request.contact_email}">${request.contact_email}</a></p>
        ${request.contact_phone ? `<p><strong>Contact Phone:</strong> ${request.contact_phone}</p>` : ''}
      </div>

      <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0;"><strong>Action Required:</strong> Please log in to the admin portal to review and approve this request.</p>
      </div>

      <p>Best regards,<br>
      HKRA CPD System</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated notification. Please log in to the admin portal to take action.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate approval notification email HTML for requestor
 */
export function generateApprovalEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  expected_cpd_points: number | null
  contact_name: string
  request_id: string
  admin_notes?: string | null
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CPD Request Approved</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
        <h1 style="color: #065f46; margin-top: 0;">✅ CPD Request Approved</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>We are pleased to inform you that your CPD request has been approved!</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Request Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        <p><strong>CPD Points:</strong> ${request.expected_cpd_points || 'To be determined'}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      ${request.admin_notes ? `
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="margin-top: 0; color: #92400e;">Admin Notes</h3>
        <p style="margin: 0;">${request.admin_notes}</p>
      </div>
      ` : ''}

      <p>Your event has been approved and will be promoted according to the expected promotion date. You can view the full details of your request in the vendor portal.</p>

      <p>If you have any questions or need to make changes, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate rejection notification email HTML for requestor
 */
export function generateRejectionEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  contact_name: string
  request_id: string
  rejection_reason?: string | null
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CPD Request Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ef4444;">
        <h1 style="color: #991b1b; margin-top: 0;">CPD Request Status Update</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>We regret to inform you that your CPD request has not been approved at this time.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Request Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      ${request.rejection_reason ? `
      <div style="background-color: #fee2e2; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
        <h3 style="margin-top: 0; color: #991b1b;">Reason for Rejection</h3>
        <p style="margin: 0;">${request.rejection_reason}</p>
      </div>
      ` : ''}

      <p>If you have any questions about this decision or would like to discuss your request further, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate unapproval notification email HTML for requestor
 */
export function generateUnapprovalEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  contact_name: string
  request_id: string
  admin_notes?: string | null
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CPD Request Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
        <h1 style="color: #92400e; margin-top: 0;">⚠️ CPD Request Status Update</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>We are writing to inform you that your previously approved CPD request has been changed back to pending status and requires further review.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Request Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      ${request.admin_notes ? `
      <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
        <h3 style="margin-top: 0; color: #92400e;">Admin Notes</h3>
        <p style="margin: 0;">${request.admin_notes}</p>
      </div>
      ` : ''}

      <p>Your request is now under review again. We will notify you once a decision has been made. You can check the status of your request in the vendor portal.</p>

      <p>If you have any questions, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate unrejection notification email HTML for requestor
 */
export function generateUnrejectionEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  contact_name: string
  request_id: string
  admin_notes?: string | null
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CPD Request Status Update</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
        <h1 style="color: #065f46; margin-top: 0;">✅ CPD Request Status Update</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>We are writing to inform you that your previously rejected CPD request has been changed back to pending status and is now under review again.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Request Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      ${request.admin_notes ? `
      <div style="background-color: #d1fae5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
        <h3 style="margin-top: 0; color: #065f46;">Admin Notes</h3>
        <p style="margin: 0;">${request.admin_notes}</p>
      </div>
      ` : ''}

      <p>Your request is now under review again. We will notify you once a decision has been made. You can check the status of your request in the vendor portal.</p>

      <p>If you have any questions, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate attendance file upload confirmation email HTML for vendor
 */
export function generateAttendanceUploadConfirmationEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  contact_name: string
  request_id: string
  uploaded_at: string
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const uploadedDate = new Date(request.uploaded_at).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Attendance File Uploaded</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #d1fae5; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #10b981;">
        <h1 style="color: #065f46; margin-top: 0;">✅ Attendance File Uploaded Successfully</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>This is to confirm that your attendance file has been successfully uploaded for your CPD event.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Event Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
        <p><strong>Uploaded On:</strong> ${uploadedDate}</p>
      </div>

      <p>The attendance file is now available for review by the admin team. You can view and manage your request in the vendor portal.</p>

      <p>If you have any questions, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated message. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate attendance file upload notification email HTML for admin
 */
export function generateAttendanceUploadAdminNotificationEmail(request: {
  event_name: string
  event_start_date: string
  event_end_date: string
  event_start_time?: string
  event_end_time?: string
  vendor_company_name: string
  contact_name: string
  contact_email: string
  request_id: string
  uploaded_at: string
}): string {
  const startDate = new Date(request.event_start_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const endDate = new Date(request.event_end_date).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const uploadedDate = new Date(request.uploaded_at).toLocaleDateString('en-HK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  // Format time if provided
  const formatTime = (time: string | undefined) => {
    if (!time) return ''
    try {
      const [hours, minutes] = time.split(':')
      const hour = parseInt(hours, 10)
      const ampm = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour % 12 || 12
      return `${displayHour}:${minutes} ${ampm}`
    } catch {
      return time
    }
  }

  const startTime = formatTime(request.event_start_time)
  const endTime = formatTime(request.event_end_time)

  const eventDateRange = startTime && endTime
    ? `${startDate} ${startTime} - ${endDate} ${endTime}`
    : startTime
    ? `${startDate} ${startTime} - ${endDate}`
    : `${startDate} - ${endDate}`

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Attendance File Uploaded</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
        <h1 style="color: #1e40af; margin-top: 0;">📎 Attendance File Uploaded</h1>
      </div>

      <p>A vendor has uploaded an attendance file for an approved CPD event.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Event Details</h2>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event Dates:</strong> ${eventDateRange}</p>
        <p><strong>Uploaded On:</strong> ${uploadedDate}</p>
      </div>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Vendor Information</h2>
        <p><strong>Company:</strong> ${request.vendor_company_name}</p>
        <p><strong>Contact Name:</strong> ${request.contact_name}</p>
        <p><strong>Contact Email:</strong> <a href="mailto:${request.contact_email}">${request.contact_email}</a></p>
      </div>

      <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
        <p style="margin: 0;"><strong>Action Required:</strong> Please log in to the admin portal to review the attendance file.</p>
      </div>

      <p>Best regards,<br>
      HKRA CPD System</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated notification. Please log in to the admin portal to take action.
      </p>
    </body>
    </html>
  `
}
