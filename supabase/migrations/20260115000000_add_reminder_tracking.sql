-- Add columns to track when reminders were sent
ALTER TABLE public.vendor_requests
ADD COLUMN reminder_sent_at_1m TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN reminder_sent_at_3m TIMESTAMP WITH TIME ZONE NULL;

-- Add comment to explain columns
COMMENT ON COLUMN public.vendor_requests.reminder_sent_at_1m IS 'Timestamp when the 1-month post-event reminder was sent';
COMMENT ON COLUMN public.vendor_requests.reminder_sent_at_3m IS 'Timestamp when the 3-month post-event reminder was sent';
