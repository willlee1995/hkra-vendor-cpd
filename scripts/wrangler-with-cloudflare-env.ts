/**
 * Run wrangler with CLOUDFLARE_* credentials from repo .env.cloudflare only.
 * Avoids OAuth refresh timeouts when a global/shell token conflicts with wrangler login.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const wranglerEntry = require.resolve('wrangler/bin/wrangler.js')

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const envPath = join(root, '.env.cloudflare')

function loadEnvFile(path: string): void {
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

if (!existsSync(envPath)) {
  console.error(
    `Missing ${envPath}\nCopy .env.cloudflare.example → .env.cloudflare and set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN.`,
  )
  process.exit(1)
}

// Repo token wins over inherited shell/user env for deploy commands.
delete process.env.CLOUDFLARE_API_TOKEN
delete process.env.CLOUDFLARE_ACCOUNT_ID
loadEnvFile(envPath)

if (!process.env.CLOUDFLARE_API_TOKEN?.trim()) {
  console.error('CLOUDFLARE_API_TOKEN is empty in .env.cloudflare')
  process.exit(1)
}

const wranglerArgs = process.argv.slice(2)
if (wranglerArgs.length === 0) {
  console.error('Usage: bun run scripts/wrangler-with-cloudflare-env.ts -- <wrangler args...>')
  process.exit(1)
}

/** Wrangler must run under Node; `bun run` sets process.execPath to the Bun binary. */
function resolveNodeExecutable(): string {
  const fromNpm = process.env.npm_node_execpath?.trim()
  if (fromNpm) return fromNpm
  if (process.versions.bun) return 'node'
  return process.execPath
}

const nodeExecutable = resolveNodeExecutable()
const result = spawnSync(nodeExecutable, [wranglerEntry, ...wranglerArgs], {
  stdio: 'inherit',
  env: process.env,
  cwd: root,
  shell: process.platform === 'win32' && nodeExecutable === 'node',
})

process.exit(result.status ?? 1)
