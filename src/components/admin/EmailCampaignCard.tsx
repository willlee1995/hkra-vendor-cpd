import { useCallback, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { vendorApiClient } from '@/lib/vendorApiClient'
import type { EmailCampaignJob } from '@/lib/campaignTypes'
import { campaignMissingFieldLabel } from '@/lib/campaignMissingFields'
import { toast } from 'sonner'
import { Loader2, Mail, Play, RefreshCw } from 'lucide-react'

const POLL_STATUSES = new Set(['queued', 'generating'])
const POLL_MS = 4000

function isRegistrationUrlError(message: string | null | undefined): boolean {
  return Boolean(message?.includes('Registration URL missing'))
}

function statusLabel(status: EmailCampaignJob['status']): string {
  const map: Record<EmailCampaignJob['status'], string> = {
    queued: 'Queued',
    generating: 'Generating email…',
    dry_run_ready: 'Ready to schedule',
    needs_input: 'Needs input',
    scheduled: 'Scheduled on FluentCRM',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

interface EmailCampaignCardProps {
  requestId: string
  requestStatus: string
  registrationUrl?: string | null
  hkraWpEventId?: number | null
}

export function EmailCampaignCard({
  requestId,
  requestStatus,
  registrationUrl,
  hkraWpEventId,
}: EmailCampaignCardProps) {
  const queryClient = useQueryClient()
  const [selectedLists, setSelectedLists] = useState<string[]>(['4'])
  const [scheduling, setScheduling] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [starting, setStarting] = useState(false)
  const [watchProgress, setWatchProgress] = useState(false)
  const [adminPrompt, setAdminPrompt] = useState('')

  const { data: jobData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['email-campaign-job', requestId],
    queryFn: () => vendorApiClient.getEmailCampaignJob(requestId),
    enabled: requestStatus === 'approved',
    refetchInterval: (query) => {
      const status = query.state.data?.job?.status
      if (starting || retrying || watchProgress) return POLL_MS
      return status && POLL_STATUSES.has(status) ? POLL_MS : false
    },
  })

  const { data: audiencesData } = useQuery({
    queryKey: ['fluentcrm-audiences'],
    queryFn: () => vendorApiClient.getFluentCrmAudiences(),
    enabled: requestStatus === 'approved',
    staleTime: 3600_000,
  })

  const job = jobData?.job ?? null
  const isWorking =
    starting ||
    retrying ||
    (job != null && POLL_STATUSES.has(job.status))
  const needsInput = job?.status === 'needs_input'
  const missingFields = job?.missing_fields ?? []
  const onlyRegistrationMissing =
    needsInput &&
    missingFields.length === 1 &&
    missingFields[0] === 'registration_url'
  const promptRequired = needsInput && !onlyRegistrationMissing
  const registrationReady =
    onlyRegistrationMissing &&
    (Boolean(registrationUrl) || (hkraWpEventId != null && hkraWpEventId > 0))
  const generateLabel =
    needsInput || job?.status === 'failed'
      ? 'Continue with provided info'
      : 'Generate email campaign'

  useEffect(() => {
    if (job?.list_ids?.length) {
      setSelectedLists(job.list_ids.map(String))
    }
  }, [job?.list_ids])

  useEffect(() => {
    if (job?.admin_prompt != null) {
      setAdminPrompt(job.admin_prompt)
    }
  }, [job?.id, job?.admin_prompt])

  useEffect(() => {
    if (job && POLL_STATUSES.has(job.status)) {
      setWatchProgress(true)
      return
    }
    if (
      job &&
      ['dry_run_ready', 'scheduled', 'failed', 'needs_input', 'cancelled'].includes(job.status)
    ) {
      setWatchProgress(false)
    }
  }, [job?.status])

  const toggleList = useCallback((id: string) => {
    setSelectedLists((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const handleApproveSchedule = async () => {
    if (!selectedLists.length) {
      toast.error('Select at least one FluentCRM list')
      return
    }
    setScheduling(true)
    try {
      await vendorApiClient.approveEmailCampaignSchedule(requestId, selectedLists)
      toast.success('Campaign scheduled on FluentCRM')
      await refetch()
      queryClient.invalidateQueries({ queryKey: ['email-campaign-job', requestId] })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Schedule failed')
    } finally {
      setScheduling(false)
    }
  }

  const handleStart = async (force = false) => {
    if (force && !confirm('Start a new generation run? Any in-progress preview will be replaced when the new run completes.')) {
      return
    }
    if (promptRequired && !adminPrompt.trim()) {
      toast.error('Enter the missing information in the text box below, then continue.')
      return
    }
    setStarting(true)
    try {
      const result = await vendorApiClient.startEmailCampaignGeneration(requestId, {
        force,
        adminPrompt,
      })
      if (result.skipped) {
        toast.info(result.message ?? 'Campaign job already exists')
      } else {
        toast.success('Email campaign generation started')
        setWatchProgress(true)
      }
      await refetch()
      queryClient.invalidateQueries({ queryKey: ['email-campaign-job', requestId] })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to start generation')
    } finally {
      setStarting(false)
    }
  }

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await vendorApiClient.retryEmailCampaignGeneration(requestId, { adminPrompt })
      toast.success('Campaign generation restarted')
      setWatchProgress(true)
      await refetch()
      queryClient.invalidateQueries({ queryKey: ['email-campaign-job', requestId] })
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Retry failed')
    } finally {
      setRetrying(false)
    }
  }

  if (requestStatus !== 'approved') return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          FluentCRM email campaign
        </CardTitle>
        <CardDescription>
          Starts automatically on approval, or use the button below to trigger manually. Review the
          preview, then schedule (test list 4 before production list 1).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`campaign-admin-prompt-${requestId}`}>
            {promptRequired ? 'Required information to continue' : 'Extra context for generation (optional)'}
          </Label>
          {needsInput && missingFields.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900 dark:text-amber-100">
              {missingFields.map((field) => (
                <li key={field}>{campaignMissingFieldLabel(field)}</li>
              ))}
            </ul>
          )}
          <Textarea
            id={`campaign-admin-prompt-${requestId}`}
            value={adminPrompt}
            onChange={(event) => setAdminPrompt(event.target.value)}
            placeholder={
              promptRequired
                ? 'Paste speaker names, topics, affiliations, fees, minimum attendance…'
                : 'Speaker bios, co-host details, special fees, attendance rules… (add "bilingual" here only if you need Chinese copy)'
            }
            rows={5}
            maxLength={8000}
            disabled={isWorking}
            className="resize-y min-h-[7rem]"
          />
          <p className="text-xs text-muted-foreground">
            {promptRequired
              ? 'Add the missing details above, then click Continue with provided info.'
              : 'Sent to the Cursor agent with this run. Edit before Generate, Continue, Regenerate, or Retry.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="default"
            disabled={starting || retrying || (job != null && POLL_STATUSES.has(job.status))}
            onClick={() => handleStart(false)}
          >
            {starting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                {generateLabel}
              </>
            )}
          </Button>
          {job && (job.status === 'dry_run_ready' || job.status === 'scheduled') && (
            <Button
              type="button"
              variant="outline"
              disabled={starting || POLL_STATUSES.has(job.status)}
              onClick={() => handleStart(true)}
            >
              Regenerate
            </Button>
          )}
        </div>

        {isLoading && (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading campaign job…
          </p>
        )}

        {!isLoading && !job && (
          <p className="text-sm text-muted-foreground">
            No campaign job yet. Use &quot;Generate email campaign&quot; or wait for the automatic start
            after approval (when the campaign worker is configured).
          </p>
        )}

        {needsInput && !registrationReady && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-medium">More information needed</p>
            <p className="mt-1 whitespace-pre-wrap">{job?.error_message}</p>
          </div>
        )}

        {registrationReady && (
          <div className="rounded-md border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            {registrationUrl ? (
              <>
                Registration link is ready. Click{' '}
                <span className="font-medium">Continue with provided info</span> to resume — Cursor cloud
                generation usually takes a few minutes.
              </>
            ) : (
              <>
                HKRA event is linked (WordPress ID {hkraWpEventId}). Click{' '}
                <span className="font-medium">Continue with provided info</span> to resolve the registration
                URL and start Cursor cloud generation.
              </>
            )}
          </div>
        )}

        {isWorking && (
          <div className="rounded-md border border-sky-300/60 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
            <div className="flex items-start gap-2">
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
              <div className="space-y-1">
                <p className="font-medium">
                  {job?.status === 'generating'
                    ? 'Generating email in Cursor cloud…'
                    : starting || retrying
                      ? 'Starting campaign generation…'
                      : 'Queued — waiting for Cursor cloud agent…'}
                </p>
                <p className="text-sky-900/80 dark:text-sky-100/80">
                  This page refreshes every few seconds. Typical run time is 3–10 minutes.
                </p>
                {job?.updated_at && (
                  <p className="text-xs text-sky-900/70 dark:text-sky-100/70">
                    Last update{' '}
                    {formatDistanceToNow(new Date(job.updated_at), { addSuffix: true })}
                    {isFetching ? ' · checking…' : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {job && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Status:</span>
              <span className="rounded-md bg-muted px-2 py-1 text-sm">{statusLabel(job.status)}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => refetch()}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {job.error_message &&
              !needsInput &&
              !(registrationReady && isRegistrationUrlError(job.error_message)) && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {job.error_message}
              </div>
            )}

            {job.admin_prompt && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="mb-1 font-medium">Extra context used for this run</p>
                <p className="whitespace-pre-wrap text-muted-foreground">{job.admin_prompt}</p>
              </div>
            )}

            {job.dry_run_summary && (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Subject:</span>{' '}
                  {job.dry_run_summary.email_subject ?? job.dry_run_summary.campaign_title}
                </p>
                <p>
                  <span className="font-medium">Recipients:</span> {job.dry_run_summary.contact_count ?? '—'}
                </p>
                <p>
                  <span className="font-medium">Schedule:</span> {job.dry_run_summary.schedule_hkt}
                  {job.dry_run_summary.schedule_utc && ` (${job.dry_run_summary.schedule_utc})`}
                </p>
                {job.dry_run_summary.large_audience_warning && (
                  <p className="text-amber-700">Large audience — confirm before scheduling.</p>
                )}
              </div>
            )}

            {job.html_preview && job.status === 'dry_run_ready' && (
              <div>
                <Label className="mb-2 block">HTML preview</Label>
                <iframe
                  title="Email preview"
                  className="h-64 w-full rounded-md border bg-white"
                  srcDoc={job.html_preview}
                  sandbox=""
                />
              </div>
            )}

            {job.status === 'dry_run_ready' && audiencesData?.lists && (
              <div>
                <Label className="mb-2 block">FluentCRM lists</Label>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                  {audiencesData.lists.map((list) => (
                    <label key={list.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedLists.includes(list.id)}
                        onChange={() => toggleList(list.id)}
                      />
                      <span>
                        {list.title} ({list.subscribersCount} contacts) — ID {list.id}
                      </span>
                    </label>
                  ))}
                </div>
                <Button
                  type="button"
                  className="mt-3"
                  disabled={scheduling}
                  onClick={handleApproveSchedule}
                >
                  {scheduling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling…
                    </>
                  ) : (
                    'Approve & schedule on FluentCRM'
                  )}
                </Button>
              </div>
            )}

            {job.status === 'failed' && (
              <Button type="button" variant="secondary" disabled={retrying} onClick={handleRetry}>
                {retrying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Retrying…
                  </>
                ) : (
                  'Retry generation'
                )}
              </Button>
            )}

            {job.status === 'scheduled' && job.fluentcrm_campaign_id && (
              <p className="text-sm text-muted-foreground">
                FluentCRM campaign ID: {job.fluentcrm_campaign_id}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
