# Email campaign orchestrator (Cloudflare Worker)

Runs Cursor cloud generation and FluentCRM scheduling for approved vendor CPD requests. **Does not** run on CyberPanel/WordPress — only Cloudflare + Supabase + hkra.org.hk REST.

## Deploy (Bun)

```bash
bun install
bun run deploy:campaign-worker
```

Set secrets:

```bash
bunx wrangler secret put CURSOR_API_KEY -c wrangler.campaign.toml
bunx wrangler secret put HKRA_PUBLISH_TOKEN -c wrangler.campaign.toml
bunx wrangler secret put GITHUB_TOKEN -c wrangler.campaign.toml
bunx wrangler secret put CAMPAIGN_WEBHOOK_SECRET -c wrangler.campaign.toml
bunx wrangler secret put SUPABASE_URL -c wrangler.campaign.toml
bunx wrangler secret put SUPABASE_SERVICE_ROLE_KEY -c wrangler.campaign.toml
```

## Supabase Edge Functions

Add to environment (Docker / `supabase secrets`):

- `CAMPAIGN_WORKER_URL` — deployed Worker URL (e.g. `https://hkra-campaign-orchestrator.<account>.workers.dev`)
- `CAMPAIGN_WEBHOOK_SECRET` — same value as Worker

Deploy functions including `campaign-proxy`:

```bash
./scripts/deploy-functions-vps.sh
```

Apply migration:

```bash
# via your usual Supabase migration path
supabase db push
```

## Local dev

```bash
bun run dev:campaign-worker
```

## API (HMAC `X-Campaign-Webhook-Secret`)

| Route | Purpose |
|-------|---------|
| `POST /internal/campaigns/start` | Start job (Edge Function on approve) |
| `GET /campaigns/:requestId` | Job status + preview |
| `POST /campaigns/:requestId/approve-schedule` | FluentCRM publish (`confirm: true`) |
| `POST /campaigns/:requestId/start` | Manual start (`{ "force": true, "admin_prompt": "…" }` optional) |
| `POST /campaigns/:requestId/retry` | Retry failed / needs_input (optional `admin_prompt`) |
| `GET /campaigns/audiences` | FluentCRM list picker |

Admin UI uses **campaign-proxy** Edge Function (JWT admin) → Worker.

## Cursor API

Worker uses [Cloud Agents REST v1](https://cursor.com/docs/cloud-agent/api/endpoints) (`POST /v1/agents`) — no Node SDK required in the Worker bundle.
