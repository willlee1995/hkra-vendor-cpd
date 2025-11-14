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
  expected_cpd_points: number
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
        <p><strong>Event Dates:</strong> ${startDate} - ${endDate}</p>
        <p><strong>Expected CPD Points:</strong> ${request.expected_cpd_points}</p>
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
  expected_cpd_points: number
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
        <p><strong>Event Dates:</strong> ${startDate} - ${endDate}</p>
        <p><strong>Expected CPD Points:</strong> ${request.expected_cpd_points}</p>
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

