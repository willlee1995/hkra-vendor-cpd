import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sendEmailToVendorRecipients, collectVendorNotificationRecipients } from '../vendor-requests/email.ts'
import { generate1MonthReminderEmail, generate3MonthReminderEmail } from './email.ts'

async function fetchVendorNotificationMap(
    supabaseClient: ReturnType<typeof createClient>,
    vendorIds: string[],
): Promise<Map<string, string[] | null | undefined>> {
    const map = new Map<string, string[] | null | undefined>()
    const unique = [...new Set(vendorIds)].filter(Boolean)
    if (unique.length === 0) return map

    const { data, error } = await supabaseClient
        .from('vendors')
        .select('id, notification_emails')
        .in('id', unique)

    if (error) {
        console.error('fetchVendorNotificationMap:', error)
        return map
    }
    for (const row of data ?? []) {
        map.set(row.id, row.notification_emails)
    }
    return map
}

// Get Supabase credentials from environment variables
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // Create Supabase client with service role key to bypass RLS and access all data
        const supabaseClient = createClient(
            SUPABASE_URL,
            SUPABASE_SERVICE_ROLE_KEY,
        )

        // Calculate dates
        const now = new Date()

        // 1 month ago
        const oneMonthAgo = new Date(now)
        oneMonthAgo.setMonth(now.getMonth() - 1)
        const oneMonthAgoStr = oneMonthAgo.toISOString().split('T')[0]

        // 3 months ago
        const threeMonthsAgo = new Date(now)
        threeMonthsAgo.setMonth(now.getMonth() - 3)
        const threeMonthsAgoStr = threeMonthsAgo.toISOString().split('T')[0]

        console.log(`Checking for overdue events. 1m threshold: ${oneMonthAgoStr}, 3m threshold: ${threeMonthsAgoStr}`)

        const results = {
            sent1MonthReminders: 0,
            sent3MonthReminders: 0,
            errors: [] as string[]
        }

        // 1. Process 1-Month Reminders
        // Criteria: Event ended <= 1 month ago AND > 3 months ago AND status approved AND no attendance file AND no 1m reminder sent
        const { data: requests1m, error: error1m } = await supabaseClient
            .from('vendor_requests')
            .select('*')
            .eq('status', 'approved')
            .is('attendance_file_url', null)
            .is('reminder_sent_at_1m', null)
            .lte('event_end_date', oneMonthAgoStr)
            .gt('event_end_date', threeMonthsAgoStr)

        if (error1m) {
            console.error('Error fetching 1m reminder candidates:', error1m)
            results.errors.push(`Error fetching 1m candidates: ${error1m.message}`)
        } else if (requests1m && requests1m.length > 0) {
            console.log(`Found ${requests1m.length} candidates for 1-month reminder`)

            const notifyMap1m = await fetchVendorNotificationMap(
                supabaseClient,
                requests1m.map((r: { vendor_id: string }) => r.vendor_id),
            )

            for (const request of requests1m) {
                const recipients = collectVendorNotificationRecipients(
                    request.contact_email,
                    notifyMap1m.get(request.vendor_id),
                )
                if (recipients.length === 0) continue

                try {
                    await sendEmailToVendorRecipients(
                        recipients,
                        `Reminder: Attendance File Upload Pending - ${request.event_name}`,
                        generate1MonthReminderEmail({
                            event_name: request.event_name,
                            event_end_date: request.event_end_date,
                            contact_name: request.contact_name,
                            request_id: request.id,
                        }),
                    )

                    // Update DB
                    const { error: updateError } = await supabaseClient
                        .from('vendor_requests')
                        .update({ reminder_sent_at_1m: new Date().toISOString() })
                        .eq('id', request.id)

                    if (updateError) {
                        console.error(`Failed to update reminder_sent_at_1m for ${request.id}:`, updateError)
                    } else {
                        results.sent1MonthReminders++
                    }
                } catch (emailError: any) {
                    console.error(`Failed to send 1m reminder for request ${request.id}:`, emailError)
                    results.errors.push(`Failed to send 1m reminder for request ${request.id}: ${emailError.message}`)
                }
            }
        }

        // 2. Process 3-Month Reminders
        // Criteria: Event ended <= 3 months ago AND status approved AND no attendance file AND no 3m reminder sent
        const { data: requests3m, error: error3m } = await supabaseClient
            .from('vendor_requests')
            .select('*')
            .eq('status', 'approved')
            .is('attendance_file_url', null)
            .is('reminder_sent_at_3m', null)
            .lte('event_end_date', threeMonthsAgoStr)

        if (error3m) {
            console.error('Error fetching 3m reminder candidates:', error3m)
            results.errors.push(`Error fetching 3m candidates: ${error3m.message}`)
        } else if (requests3m && requests3m.length > 0) {
            console.log(`Found ${requests3m.length} candidates for 3-month reminder`)

            const notifyMap3m = await fetchVendorNotificationMap(
                supabaseClient,
                requests3m.map((r: { vendor_id: string }) => r.vendor_id),
            )

            for (const request of requests3m) {
                const recipients = collectVendorNotificationRecipients(
                    request.contact_email,
                    notifyMap3m.get(request.vendor_id),
                )
                if (recipients.length === 0) continue

                try {
                    await sendEmailToVendorRecipients(
                        recipients,
                        `URGENT: Attendance File Upload Overdue - ${request.event_name}`,
                        generate3MonthReminderEmail({
                            event_name: request.event_name,
                            event_end_date: request.event_end_date,
                            contact_name: request.contact_name,
                            request_id: request.id,
                        }),
                    )

                    // Update DB
                    const { error: updateError } = await supabaseClient
                        .from('vendor_requests')
                        .update({ reminder_sent_at_3m: new Date().toISOString() })
                        .eq('id', request.id)

                    if (updateError) {
                        console.error(`Failed to update reminder_sent_at_3m for ${request.id}:`, updateError)
                    } else {
                        results.sent3MonthReminders++
                    }
                } catch (emailError: any) {
                    console.error(`Failed to send 3m reminder for request ${request.id}:`, emailError)
                    results.errors.push(`Failed to send 3m reminder for request ${request.id}: ${emailError.message}`)
                }
            }
        }

        return new Response(
            JSON.stringify(results),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error: any) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
