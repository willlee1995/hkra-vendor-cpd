/**
 * Fallback: read output/*.html and *.meta.json from campaign branch via GitHub API.
 */

import { decodeBase64Utf8 } from './encoding'
import { parseJobStatusFile, type CampaignJobStatusFile } from './job-status'

export interface GithubCampaignFiles {
  html: string
  meta: Record<string, unknown>
  slug: string
}

export async function fetchCampaignFilesFromGithub(
  token: string,
  repo: string,
  branch: string,
): Promise<GithubCampaignFiles | null> {
  const [owner, name] = parseRepo(repo)
  const treeUrl = `https://api.github.com/repos/${owner}/${name}/git/trees/${encodeURIComponent(branch)}?recursive=1`

  const treeRes = await fetch(treeUrl, {
    headers: githubHeaders(token),
  })
  if (!treeRes.ok) {
    return null
  }

  const treeData = (await treeRes.json()) as {
    tree?: Array<{ path: string; type: string }>
  }

  const outputFiles =
    treeData.tree?.filter(
      (e) => e.type === 'blob' && e.path.startsWith('output/') && !e.path.includes('JOB_STATUS'),
    ) ?? []

  const htmlPath = outputFiles
    .map((e) => e.path)
    .filter((p) => p.endsWith('.html'))
    .sort()
    .pop()

  if (!htmlPath) return null

  const base = htmlPath.replace(/\.html$/, '')
  const metaPath = `${base}.meta.json`

  const html = await fetchBlobContent(token, owner, name, htmlPath, branch)
  let meta: Record<string, unknown> = {}

  if (outputFiles.some((e) => e.path === metaPath)) {
    const metaText = await fetchBlobContent(token, owner, name, metaPath, branch)
    meta = JSON.parse(metaText) as Record<string, unknown>
  }

  const slug = base.replace(/^output\//, '')
  return { html, meta, slug }
}

export async function fetchJobStatusFromGithub(
  token: string,
  repo: string,
  branch: string,
): Promise<CampaignJobStatusFile | null> {
  const [owner, name] = parseRepo(repo)
  for (const path of ['output/JOB_STATUS.json', 'JOB_STATUS.json']) {
    try {
      const text = await fetchBlobContent(token, owner, name, path, branch)
      const parsed = parseJobStatusFile(text)
      if (parsed) return parsed
    } catch {
      // try next path
    }
  }
  return null
}

function parseRepo(repoUrl: string): [string, string] {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/i)
  if (!match) throw new Error(`Invalid GitHub repo URL: ${repoUrl}`)
  return [match[1], match[2]]
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'hkra-campaign-orchestrator',
  }
}

async function fetchBlobContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<string> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`
  const res = await fetch(url, { headers: githubHeaders(token) })
  if (!res.ok) {
    throw new Error(`GitHub contents ${path} (${res.status})`)
  }
  const data = (await res.json()) as { content?: string; encoding?: string }
  if (!data.content) throw new Error(`Empty GitHub content for ${path}`)
  return decodeBase64Utf8(data.content)
}
