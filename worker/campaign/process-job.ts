import { resolveCampaignGeneration } from './artifacts'
import {
  classifyRunStatus,
  createCloudAgent,
  getAgent,
  getRun,
} from './cursor-api'
import {
  computeDefaultSchedule,
  FluentCrmClient,
  LARGE_AUDIENCE_THRESHOLD,
  recipientsFromListIds,
} from './fluentcrm'
import {
  CampaignNeedsInputError,
  formatMissingFieldsMessage,
  missingFromSectionValidation,
} from './job-status'
import { buildCampaignPrompt, campaignBranchName } from './prompt'
import { resolveRegistrationUrl } from './registration-url'
import { createSupabaseRest, normalizePosterUrls, posterUrlsForEmail, adminMaterialUrls } from './supabase'
import type { CampaignJobRow, Env, VendorRequestRow } from './types'
import { assertPosterUrlsFetchable, validateHtmlFooter, validateHtmlStructure, validateWebinarEmailSections } from './validate'

const STALE_GENERATING_MS = 20 * 60 * 1000
const INACTIVE_AGENT_FAIL_MS = 3 * 60 * 1000

async function failJob(
  db: ReturnType<typeof createSupabaseRest>,
  jobId: string,
  message: string,
): Promise<void> {
  await db.updateJob(jobId, {
    status: 'failed',
    error_message: message,
    missing_fields: null,
  })
}

async function setNeedsInputJob(
  db: ReturnType<typeof createSupabaseRest>,
  jobId: string,
  missing: string[],
  message: string,
): Promise<void> {
  await db.updateJob(jobId, {
    status: 'needs_input',
    missing_fields: missing,
    error_message: message,
    cursor_agent_id: null,
    cursor_run_id: null,
  })
}

async function validateJobInputs(
  env: Env,
  db: ReturnType<typeof createSupabaseRest>,
  job: CampaignJobRow,
  request: VendorRequestRow,
): Promise<{ registrationUrl: string; posterUrls: string[]; adminMaterialUrls: string[] } | null> {
  const allMaterials = normalizePosterUrls(request.poster_file_url)
  const posterUrls = posterUrlsForEmail(allMaterials)
  const registrationUrl =
    job.registration_url ?? (await resolveRegistrationUrl(env, request, db)) ?? null

  if (request.expected_cpd_points == null) {
    await setNeedsInputJob(
      db,
      job.id,
      ['cpd'],
      formatMissingFieldsMessage(['cpd'], 'Set CPD points on the approved request, then continue generation.'),
    )
    return null
  }

  if (!registrationUrl) {
    const wpHint =
      request.hkra_wp_event_id != null && request.hkra_wp_event_id > 0
        ? ` WordPress event ID ${request.hkra_wp_event_id} is linked but no public URL could be resolved.`
        : ''
    await setNeedsInputJob(
      db,
      job.id,
      ['registration_url'],
      `Registration URL missing (create the HKRA site event first, then continue).${wpHint}`,
    )
    await db.updateJob(job.id, { poster_urls: posterUrls })
    return null
  }

  if (posterUrls.length > 0) {
    const posterErr = await assertPosterUrlsFetchable(posterUrls)
    if (posterErr) {
      await failJob(db, job.id, posterErr)
      return null
    }
  }

  return { registrationUrl, posterUrls, adminMaterialUrls: adminMaterialUrls(allMaterials) }
}

async function ensureCursorAgentStarted(
  env: Env,
  db: ReturnType<typeof createSupabaseRest>,
  job: CampaignJobRow,
  request: VendorRequestRow,
  registrationUrl: string,
  posterUrls: string[],
  adminMaterialUrlsList: string[],
): Promise<CampaignJobRow> {
  const repoUrl = env.HKRA_CAMPAIGN_REPO ?? 'https://github.com/willlee1995/hkra-email-campaign'
  const branch = job.github_branch ?? campaignBranchName(request.id)

  if (job.cursor_agent_id && job.cursor_run_id) {
    if (job.status === 'queued') {
      await db.updateJob(job.id, {
        status: 'generating',
        poster_urls: posterUrls,
        registration_url: registrationUrl,
        github_branch: branch,
        error_message: null,
      })
    }
    return { ...job, status: 'generating' }
  }

  await db.updateJob(job.id, {
    status: 'generating',
    poster_urls: posterUrls,
    registration_url: registrationUrl,
    github_branch: branch,
    error_message: null,
  })

  const promptText = buildCampaignPrompt(request, {
    registrationUrl,
    posterUrls,
    adminMaterialUrls: adminMaterialUrlsList,
    adminPrompt: job.admin_prompt,
  })
  const created = await createCloudAgent(env.CURSOR_API_KEY, { promptText, repoUrl })

  await db.updateJob(job.id, {
    cursor_agent_id: created.agentId,
    cursor_run_id: created.runId,
    github_branch: created.branchName ?? branch,
  })

  return {
    ...job,
    status: 'generating',
    cursor_agent_id: created.agentId,
    cursor_run_id: created.runId,
    github_branch: created.branchName ?? branch,
  }
}

async function completeJobWithArtifacts(
  env: Env,
  db: ReturnType<typeof createSupabaseRest>,
  job: CampaignJobRow,
  request: VendorRequestRow,
  agentId: string,
  branch: string,
): Promise<void> {
  const repoUrl = env.HKRA_CAMPAIGN_REPO ?? 'https://github.com/willlee1995/hkra-email-campaign'
  const siteUrl = env.HKRA_SITE_URL ?? 'https://www.hkra.org.hk'
  const defaultListIds = (env.HKRA_DEFAULT_LIST_IDS ?? '4').split(',').map((s) => s.trim())

  const outcome = await resolveCampaignGeneration(
    env.CURSOR_API_KEY,
    agentId,
    env.GITHUB_TOKEN,
    repoUrl,
    branch,
  )

  if (outcome.kind === 'needs_input') {
    await setNeedsInputJob(
      db,
      job.id,
      outcome.missing,
      formatMissingFieldsMessage(outcome.missing, outcome.message),
    )
    return
  }

  if (outcome.kind === 'not_found') {
    throw new Error('No campaign HTML/meta or JOB_STATUS.json found in Cursor artifacts or GitHub branch')
  }

  const artifacts = outcome.data

  const footerMissing = validateHtmlFooter(artifacts.html)
  if (footerMissing.length) {
    throw new Error(`HTML missing footer tokens: ${footerMissing.join(', ')}`)
  }

  const structureMissing = validateHtmlStructure(artifacts.html)
  if (structureMissing.length) {
    throw new Error(`HTML missing structure: ${structureMissing.join(', ')}`)
  }

  const sectionMissing = validateWebinarEmailSections(artifacts.html)
  if (sectionMissing.length) {
    const missing = missingFromSectionValidation(sectionMissing)
    throw new CampaignNeedsInputError(
      missing,
      formatMissingFieldsMessage(
        missing,
        `Generated email is incomplete (${sectionMissing.join('; ')}). Add the details below and continue generation.`,
      ),
    )
  }

  const meta = { ...artifacts.meta }
  if (!meta.title) meta.title = `INVITATION: ${request.event_name}`.slice(0, 120)
  if (!meta.email_subject) meta.email_subject = String(meta.title)
  if (!meta.email_pre_header) meta.email_pre_header = ''
  meta.design_template = 'raw_html'

  const listIds = defaultListIds
  const recipients = recipientsFromListIds(listIds)
  const fluent = new FluentCrmClient(siteUrl, env.HKRA_PUBLISH_TOKEN)
  const lists = await fluent.fetchLists()
  const listTitles = listIds.map((id) => lists.find((l) => l.id === id)?.title ?? `List ${id}`)
  const estimatedCount = await fluent.estimateRecipients(recipients)
  const schedule = computeDefaultSchedule(1)

  if (estimatedCount <= 0) {
    throw new Error('FluentCRM estimate returned 0 recipients')
  }

  meta.recipients = recipients
  meta.schedule = {
    offset_days: 1,
    local_time: '09:00:00',
    local_timezone: 'Asia/Hong_Kong',
    scheduled_at_local: schedule.scheduledAtLocal,
    scheduled_at_utc: schedule.scheduledAtUtc,
  }

  await db.updateJob(job.id, {
    status: 'dry_run_ready',
    html_preview: artifacts.html,
    meta_json: meta,
    list_ids: listIds,
    scheduled_at_local: schedule.scheduledAtLocal,
    dry_run_summary: {
      campaign_title: meta.title,
      email_subject: meta.email_subject,
      slug: artifacts.slug,
      audience: listTitles.map((title, i) => ({ id: listIds[i], title })),
      contact_count: estimatedCount,
      schedule_hkt: schedule.displayLocal,
      schedule_utc: schedule.displayUtc,
      large_audience_warning: estimatedCount >= LARGE_AUDIENCE_THRESHOLD,
    },
    error_message: null,
    missing_fields: null,
  })
}

/**
 * One non-blocking sync with Cursor — safe inside Worker CPU/time limits.
 * Call on GET status polls, cron, and after starting a job.
 */
export async function advanceCampaignJob(env: Env, jobId: string): Promise<void> {
  const db = createSupabaseRest(env)
  const job = await db.getJobById(jobId)
  if (!job) return
  if (job.status !== 'queued' && job.status !== 'generating') return

  const request = await db.getVendorRequest(job.vendor_request_id)
  if (!request) {
    await failJob(db, jobId, 'Vendor request not found')
    return
  }

  try {
    const inputs = await validateJobInputs(env, db, job, request)
    if (!inputs) return

    const activeJob = await ensureCursorAgentStarted(
      env,
      db,
      job,
      request,
      inputs.registrationUrl,
      inputs.posterUrls,
      inputs.adminMaterialUrls,
    )

    const agentId = activeJob.cursor_agent_id
    let runId = activeJob.cursor_run_id
    if (!agentId || !runId) return

    const agentMeta = await getAgent(env.CURSOR_API_KEY, agentId)
    if (!runId && agentMeta.latestRunId) {
      runId = agentMeta.latestRunId
      await db.updateJob(jobId, { cursor_run_id: runId })
    }

    const branch = agentMeta.branchName ?? activeJob.github_branch ?? campaignBranchName(request.id)
    const { status: runStatus } = await getRun(env.CURSOR_API_KEY, agentId, runId)
    const phase = classifyRunStatus(runStatus)

    if (phase === 'running') {
      const updatedAtMs = job.updated_at ? Date.parse(job.updated_at) : Date.parse(job.created_at ?? '')
      const elapsed = Number.isFinite(updatedAtMs) ? Date.now() - updatedAtMs : 0
      const agentInactive =
        agentMeta.status != null && agentMeta.status.toUpperCase() !== 'ACTIVE'

      if (agentInactive && elapsed > INACTIVE_AGENT_FAIL_MS) {
        const hint = agentMeta.url ? ` Check Cursor: ${agentMeta.url}` : ''
        await failJob(
          db,
          jobId,
          `Cursor agent is inactive but the run has not finished (run status: ${runStatus}). Configure the repo environment in Cursor dashboard if scope shows Unconfigured.${hint}`,
        )
      } else if (elapsed > STALE_GENERATING_MS) {
        const hint = agentMeta.url ? ` Check Cursor: ${agentMeta.url}` : ''
        await failJob(
          db,
          jobId,
          `Campaign generation timed out waiting for Cursor (run status: ${runStatus}).${hint}`,
        )
      }
      return
    }

    if (phase === 'failed') {
      const hint = agentMeta.url ? ` See ${agentMeta.url}` : ''
      await failJob(db, jobId, `Cursor run ended with status ${runStatus}.${hint}`)
      return
    }

    await completeJobWithArtifacts(env, db, activeJob, request, agentId, branch)
  } catch (error) {
    if (error instanceof CampaignNeedsInputError) {
      await setNeedsInputJob(db, jobId, error.missing, error.message)
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    await failJob(db, jobId, message)
  }
}

/** Start validation + Cursor agent; completion happens on later advance calls. */
export async function processCampaignJob(env: Env, jobId: string): Promise<void> {
  await advanceCampaignJob(env, jobId)
}

export async function syncInProgressCampaignJobs(env: Env): Promise<void> {
  const db = createSupabaseRest(env)
  const jobs = await db.listJobsByStatus(['queued', 'generating'])
  for (const job of jobs) {
    await advanceCampaignJob(env, job.id)
  }
}

export async function approveCampaignSchedule(
  env: Env,
  requestId: string,
  listIds: string[],
  scheduleAtLocal?: string,
): Promise<Record<string, unknown>> {
  const db = createSupabaseRest(env)
  const job = await db.getLatestJobForRequest(requestId)
  if (!job || job.status !== 'dry_run_ready') {
    throw new Error('No dry_run_ready campaign job for this request')
  }
  if (!job.html_preview || !job.meta_json) {
    throw new Error('Campaign HTML/meta missing on job')
  }

  const meta = job.meta_json as Record<string, unknown>
  const recipients = recipientsFromListIds(listIds)
  const fluent = new FluentCrmClient(env.HKRA_SITE_URL ?? 'https://www.hkra.org.hk', env.HKRA_PUBLISH_TOKEN)

  const count = await fluent.estimateRecipients(recipients)
  if (count <= 0) {
    throw new Error('Cannot schedule: recipient count is 0')
  }

  const schedule = scheduleAtLocal
    ? { scheduledAtLocal: scheduleAtLocal, scheduledAtUtc: '', displayLocal: scheduleAtLocal, displayUtc: '' }
    : computeDefaultSchedule(1)

  const payload: Record<string, unknown> = {
    title: meta.title,
    email_subject: meta.email_subject,
    email_pre_header: meta.email_pre_header ?? '',
    email_body: job.html_preview,
    design_template: 'raw_html',
    recipients,
    scheduled_at_local: schedule.scheduledAtLocal,
    timezone: 'Asia/Hong_Kong',
    confirm: true,
  }

  if (job.fluentcrm_campaign_id) {
    payload.campaign_id = job.fluentcrm_campaign_id
  }

  const result = await fluent.publishCampaign(payload)

  await db.updateJob(job.id, {
    status: 'scheduled',
    list_ids: listIds,
    scheduled_at_local: schedule.scheduledAtLocal,
    fluentcrm_campaign_id: Number(result.campaign_id ?? result.id ?? 0) || job.fluentcrm_campaign_id,
    dry_run_summary: {
      ...(job.dry_run_summary as Record<string, unknown>),
      published: result,
      contact_count: count,
    },
  })

  return result
}
