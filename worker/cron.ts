/**
 * Cloudflare Worker for triggering Supabase Edge Functions on a schedule
 */
export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
        const SUPABASE_FUNCTION_URL = 'https://supabase.hkra.org.hk/functions/v1/vendor-reminders';

        // Ensure you have this secret set in Cloudflare: wrangler secret put SUPABASE_SERVICE_ROLE_KEY
        const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
            return;
        }

        console.log(`Triggering scheduled task: ${SUPABASE_FUNCTION_URL}`);

        try {
            const response = await fetch(SUPABASE_FUNCTION_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const text = await response.text();
                console.error(`Failed to trigger function: ${response.status} ${response.statusText}`, text);
                return;
            }

            const result = await response.json();
            console.log('Function triggered successfully:', result);
        } catch (error) {
            console.error('Error triggering function:', error);
        }
    },
};

interface Env {
    SUPABASE_SERVICE_ROLE_KEY: string;
}
