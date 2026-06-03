/**

 * Cursor Cloud Agents REST API v1 (Workers-safe; no Node SDK required).

 * @see https://cursor.com/docs/cloud-agent/api/endpoints

 */



const CURSOR_API = 'https://api.cursor.com'



export interface CursorAgentCreateResult {

  agentId: string

  runId: string

  branchName?: string

}



export type CursorRunStatus = 'CREATING' | 'RUNNING' | 'FINISHED' | 'FAILED' | 'CANCELLED' | string



export type CursorRunPhase = 'running' | 'done' | 'failed'



function authHeader(apiKey: string): string {

  return `Basic ${btoa(`${apiKey}:`)}`

}



async function cursorFetch<T>(

  apiKey: string,

  path: string,

  init?: RequestInit,

): Promise<T> {

  const response = await fetch(`${CURSOR_API}${path}`, {

    ...init,

    headers: {

      Authorization: authHeader(apiKey),

      'Content-Type': 'application/json',

      ...(init?.headers ?? {}),

    },

  })



  const text = await response.text()

  if (!response.ok) {

    throw new Error(`Cursor API ${path} (${response.status}): ${text}`)

  }



  return text ? (JSON.parse(text) as T) : ({} as T)

}



/** Map Cursor run status to orchestrator phase (no blocking poll loop). */

export function classifyRunStatus(status: string): CursorRunPhase {

  const upper = status.toUpperCase()

  if (upper === 'FINISHED' || upper === 'COMPLETED' || upper === 'SUCCEEDED' || upper === 'SUCCESS') {

    return 'done'

  }

  if (

    upper === 'FAILED' ||

    upper === 'CANCELLED' ||

    upper === 'CANCELED' ||

    upper === 'ERROR' ||

    upper === 'STOPPED' ||

    upper === 'EXPIRED'

  ) {

    return 'failed'

  }

  return 'running'

}



export async function createCloudAgent(

  apiKey: string,

  options: {

    promptText: string

    repoUrl: string

    startingRef?: string

  },

): Promise<CursorAgentCreateResult> {

  const body: Record<string, unknown> = {

    prompt: { text: options.promptText },

    model: { id: 'composer-2.5' },

    repos: [

      {

        url: options.repoUrl,

        startingRef: options.startingRef ?? 'main',

      },

    ],

    autoCreatePR: false,

  }



  const data = await cursorFetch<{

    agent: { id: string; branchName?: string; latestRunId?: string }

    run?: { id: string }

  }>(apiKey, '/v1/agents', {

    method: 'POST',

    body: JSON.stringify(body),

  })



  const runId = data.run?.id ?? data.agent.latestRunId

  if (!runId) {

    throw new Error('Cursor API /v1/agents: missing run id in response')

  }



  return {

    agentId: data.agent.id,

    runId,

    branchName: data.agent.branchName,

  }

}



export async function getRun(

  apiKey: string,

  agentId: string,

  runId: string,

): Promise<{ status: CursorRunStatus; updatedAt?: string }> {

  const data = await cursorFetch<{ status: CursorRunStatus; updatedAt?: string }>(

    apiKey,

    `/v1/agents/${agentId}/runs/${runId}`,

  )

  return { status: data.status, updatedAt: data.updatedAt }

}



export interface CursorArtifact {

  path: string

  sizeBytes?: number

}



export async function listArtifacts(

  apiKey: string,

  agentId: string,

): Promise<CursorArtifact[]> {

  const data = await cursorFetch<{ items?: CursorArtifact[] }>(

    apiKey,

    `/v1/agents/${agentId}/artifacts`,

  )

  return data.items ?? []

}



export async function downloadArtifactText(

  apiKey: string,

  agentId: string,

  artifactPath: string,

): Promise<string> {

  const url = new URL(`${CURSOR_API}/v1/agents/${agentId}/artifacts/download`)

  url.searchParams.set('path', artifactPath)



  const meta = await cursorFetch<{ url: string }>(apiKey, url.pathname + url.search)

  const fileRes = await fetch(meta.url)

  if (!fileRes.ok) {

    throw new Error(`Artifact download failed (${fileRes.status})`)

  }

  const buffer = await fileRes.arrayBuffer()

  return new TextDecoder('utf-8').decode(buffer)

}



export async function getAgent(

  apiKey: string,

  agentId: string,

): Promise<{ branchName?: string; status?: string; latestRunId?: string; url?: string }> {

  const data = await cursorFetch<{

    branchName?: string

    status?: string

    latestRunId?: string

    url?: string

  }>(apiKey, `/v1/agents/${agentId}`)

  return {

    branchName: data.branchName,

    status: data.status,

    latestRunId: data.latestRunId,

    url: data.url,

  }

}


