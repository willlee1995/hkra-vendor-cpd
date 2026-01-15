// Email utility functions for sending vendor reminders

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
 * Generate 1-month reminder email HTML
 */
export function generate1MonthReminderEmail(request: {
    event_name: string
    event_end_date: string
    contact_name: string
    request_id: string
}): string {
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
      <title>Reminder: Attendance File Upload Pending</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #dbeafe; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
        <h1 style="color: #1e40af; margin-top: 0;">ℹ️ Reminder: Attendance File Upload</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>This is a reminder that it has been over a month since your CPD event ended. We have not yet received the attendance file for this event.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Event Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event End Date:</strong> ${endDate}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      <p>Please log in to the vendor portal and upload the attendance file as soon as possible to ensure CPD points are processed correctly.</p>

      <p>If you have already uploaded the file or believe this message was sent in error, please contact us.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated reminder. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}

/**
 * Generate 3-month reminder email HTML
 */
export function generate3MonthReminderEmail(request: {
    event_name: string
    event_end_date: string
    contact_name: string
    request_id: string
}): string {
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
      <title>Action Required: Attendance File Overdue</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fef3c7; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #f59e0b;">
        <h1 style="color: #92400e; margin-top: 0;">⚠️ Action Required: Attendance File Overdue</h1>
      </div>

      <p>Dear ${request.contact_name},</p>

      <p>It has been over 3 months since your CPD event ended, and we still have not received the attendance file.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2563eb;">Event Details</h2>
        <p><strong>Event Name:</strong> ${request.event_name}</p>
        <p><strong>Event End Date:</strong> ${endDate}</p>
        <p><strong>Request ID:</strong> ${request.request_id}</p>
      </div>

      <p><strong>Please upload the attendance file immediately.</strong> Failure to provide attendance records may affect future CPD event approvals.</p>

      <p>If you have any questions or require assistance, please contact us immediately.</p>

      <p>Best regards,<br>
      HKRA CPD Team</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
      <p style="font-size: 12px; color: #6b7280;">
        This is an automated reminder. Please do not reply to this email.
      </p>
    </body>
    </html>
  `
}
