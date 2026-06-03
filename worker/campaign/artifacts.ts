import {
  downloadArtifactText,
  listArtifacts,
  type CursorArtifact,
} from './cursor-api'
import { normalizeCampaignHtml } from './encoding'
import { fetchCampaignFilesFromGithub, fetchJobStatusFromGithub, type GithubCampaignFiles } from './github'
import { parseJobStatusFile, type CampaignJobStatusFile } from './job-status'
import type { CampaignArtifacts } from './types'

export type CampaignGenerationResult =
  | { kind: 'artifacts'; data: CampaignArtifacts }
  | { kind: 'needs_input'; missing: string[]; message: string }
  | { kind: 'not_found' }

export async function resolveCampaignGeneration(
  apiKey: string,
  agentId: string,
  githubToken: string,
  repoUrl: string,
  branch: string,
): Promise<CampaignGenerationResult> {
  const fromArtifacts = await loadJobStatusFromCursorArtifacts(apiKey, agentId)
  if (fromArtifacts) {
    return toNeedsInputResult(fromArtifacts)
  }

  const fromGithubStatus = await fetchJobStatusFromGithub(githubToken, repoUrl, branch)
  if (fromGithubStatus) {
    return toNeedsInputResult(fromGithubStatus)
  }

  const htmlArtifacts = await loadHtmlFromCursorArtifacts(apiKey, agentId)
  if (htmlArtifacts) {
    return { kind: 'artifacts', data: htmlArtifacts }
  }

  const fromGithub = await fetchCampaignFilesFromGithub(githubToken, repoUrl, branch)
  if (fromGithub) {
    return {
      kind: 'artifacts',
      data: {
        html: normalizeCampaignHtml(fromGithub.html),
        meta: fromGithub.meta,
        slug: fromGithub.slug,
      },
    }
  }

  return { kind: 'not_found' }
}

function toNeedsInputResult(status: CampaignJobStatusFile): CampaignGenerationResult {
  const missing = status.missing?.length ? status.missing : ['email_content']
  return {
    kind: 'needs_input',
    missing,
    message: status.message ?? 'Cursor agent reported insufficient data to generate the email.',
  }
}

async function loadJobStatusFromCursorArtifacts(
  apiKey: string,
  agentId: string,
): Promise<CampaignJobStatusFile | null> {
  const items = await listArtifacts(apiKey, agentId)
  const path =
    items.find((a) => a.path === 'output/JOB_STATUS.json')?.path ??
    items.find((a) => a.path.endsWith('JOB_STATUS.json'))?.path
  if (!path) return null
  const text = await downloadArtifactText(apiKey, agentId, path)
  return parseJobStatusFile(text)
}

async function loadHtmlFromCursorArtifacts(
  apiKey: string,
  agentId: string,
): Promise<CampaignArtifacts | null> {
  const items = await listArtifacts(apiKey, agentId)
  const htmlArtifact = findBestHtmlArtifact(items)
  if (!htmlArtifact) return null

  const html = await downloadArtifactText(apiKey, agentId, htmlArtifact.path)
  const basePath = htmlArtifact.path.replace(/\.html$/i, '')
  const metaPath =
    items.find((a) => a.path === `${basePath}.meta.json`)?.path ??
    items.find((a) => a.path.endsWith('.meta.json') && a.path.includes('output/'))?.path

  let meta: Record<string, unknown> = {}
  if (metaPath) {
    const metaText = await downloadArtifactText(apiKey, agentId, metaPath)
    meta = JSON.parse(metaText) as Record<string, unknown>
  }

  const slug = basePath.replace(/^.*output\//, '').replace(/\.html$/i, '')
  return { html: normalizeCampaignHtml(html), meta, slug }
}

function findBestHtmlArtifact(items: CursorArtifact[]): CursorArtifact | undefined {
  const htmls = items.filter(
    (a) => a.path.endsWith('.html') && a.path.includes('output') && !a.path.includes('JOB_STATUS'),
  )
  return htmls.sort((a, b) => a.path.localeCompare(b.path)).pop()
}

/** @deprecated Use resolveCampaignGeneration */
export async function resolveCampaignArtifacts(
  apiKey: string,
  agentId: string,
  githubToken: string,
  repoUrl: string,
  branch: string,
): Promise<CampaignArtifacts> {
  const result = await resolveCampaignGeneration(apiKey, agentId, githubToken, repoUrl, branch)
  if (result.kind === 'artifacts') return result.data
  if (result.kind === 'needs_input') {
    throw new Error(result.message)
  }
  throw new Error('No campaign HTML/meta found in Cursor artifacts or GitHub branch')
}
