import { processCampaignJob } from './process-job'
import { requiresAdminPromptToContinue } from './job-status'
import { campaignBranchName, normalizeAdminPrompt } from './prompt'
import { resolveRegistrationUrl } from './registration-url'
import { createSupabaseRest, normalizePosterUrls, posterUrlsForEmail } from './supabase'
import type { Env } from './types'

export interface StartCampaignResult {
  job_id: string
  status: string
  skipped?: boolean
  message?: string
}

/**
 * Queue Cursor cloud email generation for an approved vendor request.
 * Idempotent unless force=true (regenerate after dry_run_ready / scheduled / failed).
 */
export async function queueCampaignStart(
  env: Env,
  ctx: ExecutionContext,
  requestId: string,
  options?: { force?: boolean; adminPrompt?: string | null },
): Promise<StartCampaignResult> {
  const force = options?.force === true
  const adminPrompt = normalizeAdminPrompt(options?.adminPrompt)
  const db = createSupabaseRest(env)

  const request = await db.getVendorRequest(requestId)
  if (!request) {
    throw new Error('Vendor request not found')
  }

  if (request.status !== 'approved') {
    throw new Error('Vendor request must be approved before generating email campaign')
  }

  const posterUrls = posterUrlsForEmail(normalizePosterUrls(request.poster_file_url))
  const registrationUrl = (await resolveRegistrationUrl(env, request, db)) ?? null

  const active = await db.getActiveJobForRequest(requestId)
  if (active && (active.status === 'queued' || active.status === 'generating')) {
    throw Object.assign(new Error('Campaign generation already in progress'), {
      code: 'in_progress',
      job_id: active.id,
    })
  }

  if (active && !force) {
    if (active.status === 'needs_input' || active.status === 'failed') {
      if (active.status === 'needs_input') {
        const missing = active.missing_fields ?? []
        if (requiresAdminPromptToContinue(missing) && !adminPrompt) {
          throw Object.assign(
            new Error(
              'Provide the missing details in "Extra context for generation" before continuing.',
            ),
            { code: 'needs_admin_prompt' },
          )
        }
      }
      await db.updateJob(active.id, {
        status: 'queued',
        cursor_agent_id: null,
        cursor_run_id: null,
        error_message: null,
        registration_url: registrationUrl,
        poster_urls: posterUrls,
        github_branch: campaignBranchName(requestId),
        admin_prompt: adminPrompt,
      })
      ctx.waitUntil(processCampaignJob(env, active.id))
      return { job_id: active.id, status: 'queued' }
    }

    return {
      job_id: active.id,
      status: active.status,
      skipped: true,
      message: 'An active campaign job already exists for this request',
    }
  }

  if (active && force) {
    await db.updateJob(active.id, { status: 'cancelled' })
  }

  const latest = await db.getLatestJobForRequest(requestId)
  let jobId: string

  if (
    latest &&
    !force &&
    ['failed', 'needs_input', 'cancelled'].includes(latest.status) &&
    !active
  ) {
    jobId = latest.id
    await db.updateJob(jobId, {
      status: 'queued',
      cursor_agent_id: null,
      cursor_run_id: null,
      error_message: null,
      registration_url: registrationUrl,
      poster_urls: posterUrls,
      github_branch: campaignBranchName(requestId),
      admin_prompt: adminPrompt,
    })
  } else if (latest && force && latest.status !== 'queued' && latest.status !== 'generating') {
    if (['failed', 'needs_input', 'cancelled'].includes(latest.status)) {
      jobId = latest.id
      await db.updateJob(jobId, {
        status: 'queued',
        cursor_agent_id: null,
        cursor_run_id: null,
        error_message: null,
        registration_url: registrationUrl,
        poster_urls: posterUrls,
        github_branch: campaignBranchName(requestId),
        admin_prompt: adminPrompt,
      })
    } else {
      if (latest.status !== 'cancelled') {
        await db.updateJob(latest.id, { status: 'cancelled' })
      }
      const job = await db.insertJob({
        vendor_request_id: requestId,
        status: 'queued',
        github_branch: campaignBranchName(requestId),
        registration_url: registrationUrl,
        poster_urls: posterUrls,
        admin_prompt: adminPrompt,
      })
      jobId = job.id
    }
  } else if (!active || force) {
    const job = await db.insertJob({
      vendor_request_id: requestId,
      status: 'queued',
      github_branch: campaignBranchName(requestId),
      registration_url: registrationUrl,
      poster_urls: posterUrls,
      admin_prompt: adminPrompt,
    })
    jobId = job.id
  } else {
    jobId = active!.id
  }

  ctx.waitUntil(processCampaignJob(env, jobId))

  return { job_id: jobId, status: 'queued' }
}
