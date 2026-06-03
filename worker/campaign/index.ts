import { approveCampaignSchedule, advanceCampaignJob, processCampaignJob, syncInProgressCampaignJobs } from './process-job'
import { queueCampaignStart } from './start-request'
import { campaignBranchName, normalizeAdminPrompt } from './prompt'
import { resolveRegistrationUrl } from './registration-url'
import { createSupabaseRest, normalizePosterUrls, posterUrlsForEmail } from './supabase'
import type { Env } from './types'
import { FluentCrmClient } from './fluentcrm'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function unauthorized(): Response {
  return json({ error: 'Unauthorized' }, 401)
}

function verifyWebhook(req: Request, env: Env): boolean {
  const secret = req.headers.get('X-Campaign-Webhook-Secret')
  return Boolean(secret && env.CAMPAIGN_WEBHOOK_SECRET && secret === env.CAMPAIGN_WEBHOOK_SECRET)
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'content-type, x-campaign-webhook-secret',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        },
      })
    }

    try {
      // Internal: Supabase Edge Function on CPD approve
      if (url.pathname === '/internal/campaigns/start' && req.method === 'POST') {
        if (!verifyWebhook(req, env)) return unauthorized()

        const body = (await req.json()) as { request_id?: string }
        const requestId = body.request_id?.trim() ?? ''
        if (!UUID_RE.test(requestId)) {
          return json({ error: 'request_id must be a valid UUID' }, 400)
        }

        try {
          const result = await queueCampaignStart(env, ctx, requestId)
          return json(result, result.skipped ? 200 : 202)
        } catch (error) {
          const err = error as Error & { code?: string; job_id?: string }
          if (err.code === 'in_progress') {
            return json({ error: err.message, job_id: err.job_id }, 409)
          }
          throw error
        }
      }

      const startMatch = url.pathname.match(/^\/campaigns\/([^/]+)\/start$/)
      if (startMatch && req.method === 'POST' && verifyWebhook(req, env)) {
        const requestId = startMatch[1]
        if (!UUID_RE.test(requestId)) {
          return json({ error: 'Invalid request_id' }, 400)
        }

        const body = (await req.json().catch(() => ({}))) as { force?: boolean; admin_prompt?: string }
        try {
          const result = await queueCampaignStart(env, ctx, requestId, {
            force: body.force === true,
            adminPrompt: body.admin_prompt,
          })
          return json(result, result.skipped ? 200 : 202)
        } catch (error) {
          const err = error as Error & { code?: string; job_id?: string }
          if (err.code === 'needs_admin_prompt') {
            return json({ error: err.message }, 422)
          }
          if (err.message === 'Vendor request not found') {
            return json({ error: err.message }, 404)
          }
          if (err.message.includes('must be approved')) {
            return json({ error: err.message }, 422)
          }
          if (err.code === 'in_progress') {
            return json({ error: err.message, job_id: err.job_id }, 409)
          }
          throw error
        }
      }

      if (url.pathname === '/campaigns/audiences' && req.method === 'GET' && verifyWebhook(req, env)) {
        const fluent = new FluentCrmClient(
          env.HKRA_SITE_URL ?? 'https://www.hkra.org.hk',
          env.HKRA_PUBLISH_TOKEN,
        )
        const lists = await fluent.fetchLists()
        return json({ lists })
      }

      // Service routes (campaign-proxy or internal with secret)
      const requestMatch = url.pathname.match(/^\/campaigns\/([^/]+)$/)
      if (requestMatch && verifyWebhook(req, env)) {
        const requestId = requestMatch[1]

        if (req.method === 'GET') {
          if (!UUID_RE.test(requestId)) {
            return json({ error: 'Invalid request_id' }, 400)
          }
          const db = createSupabaseRest(env)
          let job = await db.getLatestJobForRequest(requestId)
          if (job && (job.status === 'generating' || job.status === 'queued')) {
            await advanceCampaignJob(env, job.id)
            job = await db.getLatestJobForRequest(requestId)
          }
          return json({ job })
        }
      }

      const approveMatch = url.pathname.match(/^\/campaigns\/([^/]+)\/approve-schedule$/)
      if (approveMatch && req.method === 'POST' && verifyWebhook(req, env)) {
        const requestId = approveMatch[1]
        const body = (await req.json()) as { list_ids?: string[]; schedule_at?: string }
        const listIds = body.list_ids?.map(String) ?? []
        if (!listIds.length) {
          return json({ error: 'list_ids required' }, 400)
        }
        const result = await approveCampaignSchedule(env, requestId, listIds, body.schedule_at)
        return json({ success: true, result })
      }

      const retryMatch = url.pathname.match(/^\/campaigns\/([^/]+)\/retry$/)
      if (retryMatch && req.method === 'POST' && verifyWebhook(req, env)) {
        const requestId = retryMatch[1]
        const body = (await req.json().catch(() => ({}))) as { admin_prompt?: string }
        const db = createSupabaseRest(env)
        const request = await db.getVendorRequest(requestId)
        if (!request) return json({ error: 'Request not found' }, 404)

        const adminPrompt = normalizeAdminPrompt(body.admin_prompt)

        const latest = await db.getLatestJobForRequest(requestId)
        let jobId: string

        if (latest && ['failed', 'needs_input', 'cancelled'].includes(latest.status)) {
          jobId = latest.id
          const registrationUrl = (await resolveRegistrationUrl(env, request, db)) ?? latest.registration_url
          await db.updateJob(jobId, {
            status: 'queued',
            cursor_agent_id: null,
            cursor_run_id: null,
            error_message: null,
            registration_url: registrationUrl,
            poster_urls: posterUrlsForEmail(normalizePosterUrls(request.poster_file_url)),
            admin_prompt: adminPrompt,
          })
        } else {
          const active = await db.getActiveJobForRequest(requestId)
          if (active) {
            return json({ error: 'Campaign job already in progress', job_id: active.id }, 409)
          }
          const registrationUrl = (await resolveRegistrationUrl(env, request, db)) ?? null
          const job = await db.insertJob({
            vendor_request_id: requestId,
            status: 'queued',
            github_branch: campaignBranchName(requestId),
            registration_url: registrationUrl,
            poster_urls: posterUrlsForEmail(normalizePosterUrls(request.poster_file_url)),
            admin_prompt: adminPrompt,
          })
          jobId = job.id
        }

        ctx.waitUntil(processCampaignJob(env, jobId))
        return json({ job_id: jobId, status: 'queued' }, 202)
      }

      return json({ error: 'Not found' }, 404)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('Campaign worker error:', message)
      return json({ error: message }, 500)
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    await syncInProgressCampaignJobs(env)
  },
}
