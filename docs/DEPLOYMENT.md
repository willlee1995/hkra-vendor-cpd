# Deployment guide (self-hosted Supabase)

HKRA runs **self-hosted Supabase** on a VPS (Docker). This is **not** Supabase Cloud.

| Layer | Where it runs | How to deploy |
| ----- | ------------- | ------------- |
| PostgreSQL schema | Self-hosted Postgres | **SQL Editor** — paste & run migration files |
| Edge Functions | Docker `supabase-edge-functions` (name may vary) | `deploy-functions` scripts → `docker cp` + restart |
| React portal | Cloudflare Pages | `bun run deploy:pages` (see [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md)) |
| Email campaign worker | Cloudflare Worker | `bun run deploy:campaign-worker` (see [CAMPAIGN_ORCHESTRATOR.md](CAMPAIGN_ORCHESTRATOR.md)) |
| WordPress event API | hkra.org.hk | Separate repo / Code Snippets (not this app) |

---

## 1. Database migrations (required for schema changes)

**Do not** rely on `supabase db push` unless your team has explicitly wired the CLI to this host.

### Automated (recommended)

From your PC (same `.env.deploy` as function deploy):

```powershell
# See what would run (no changes)
.\scripts\run-migrations-vps.ps1 -DryRun

# Apply pending migrations only
.\scripts\run-migrations-vps.ps1
```

On the VPS directly: `./scripts/run-migrations.sh` (uses `docker exec` into `POSTGRES_CONTAINER`).

The script tracks applied files in `public.hkra_schema_migrations` and runs `supabase/migrations/*.sql` in filename order.

If you see `ERROR: must be owner of table vendors`, set in `.env.deploy`:

```env
POSTGRES_USER=supabase_admin
```

Do **not** use `SET ROLE` via `postgres` — on HKRA’s host that returns `permission denied to set role "supabase_admin"`. Connecting as `supabase_admin` inside `docker exec` works without a password.

**Database already migrated manually?** One-time baseline (does not re-run SQL):

```powershell
.\scripts\run-migrations-vps.ps1 -BaselineThrough 20260522100000_email_campaign_jobs_missing_fields
```

Use the **last migration filename** you know is already live on that database, then run without flags for newer files only.

### Manual (SQL Editor)

1. Open **Supabase Studio** → **SQL Editor** (or `psql`).
2. Open [`supabase/migrations/`](../supabase/migrations/), sort by name, run only files not yet applied.
3. Copy entire file → paste → **Run**.

### New migrations (Zoom webinar feature — run if not already applied)

| File | Purpose |
| ---- | ------- |
| `20260603000000_zoom_webinar_auto_create.sql` | `vendors.zoom_webinar_auto_create`, Zoom URL/error columns on `vendor_requests` |
| `20260603100000_zoom_template_webinar.sql` | `zoom_template_webinar_id`, `zoom_template_kind` on `vendor_requests` |

### Verify columns exist (optional)

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'vendor_requests'
  AND column_name LIKE 'zoom%'
ORDER BY 1;
```

---

## 2. Edge Functions

Functions are **not** deployed with `supabase functions deploy` (Cloud). They are copied into the functions container and the container is restarted.

### From your dev machine → VPS (typical)

**Windows (repo on PC, Docker on VPS):**

One-time local config (not committed):

```powershell
copy .env.deploy.example .env.deploy
# Edit .env.deploy — set SSH_TARGET, DOCKER_CONTAINER, SSH_KEY, etc.
.\scripts\deploy-functions-vps.ps1
```

The script loads `.env.deploy` from the repo root automatically. Variables already set in your shell override the file.

Or set env vars manually for a single session:

```powershell
$env:SSH_TARGET = "deploy@YOUR.VPS.IP"
.\scripts\deploy-functions-vps.ps1
```

**Linux/Mac on VPS or with SSH:**

```bash
export DOCKER_CONTAINER=supabase-edge-functions   # use your actual container name
./scripts/deploy-functions.sh
```

See [DEPLOY_EDGE_FUNCTIONS.md](DEPLOY_EDGE_FUNCTIONS.md) for container discovery, paths, and troubleshooting.

### Functions included in deploy scripts

`_shared`, `hkra-create-event`, `zoom-create-webinar`, `zoom-list-webinars`, `vendor-requests`, `vendor-upload`, `vendor-upload-poster`, `vendor-info`, `vendor-reminders`, `manage-users`, `campaign-proxy`

After deploy, smoke-test:

```text
GET  {SUPABASE_URL}/functions/v1/vendor-info        (with auth)
POST {SUPABASE_URL}/functions/v1/zoom-list-webinars (vendor with Zoom auto on)
```

### Edge Function secrets (host / container env)

Set on the **functions runtime**, not in the React `.env`. See [supabase/functions/README.md](../supabase/functions/README.md).

| Group | Variables |
| ----- | ----------- |
| Core | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Email | `RESEND_API_KEY`, `FROM_EMAIL` |
| HKRA WordPress | `HKRA_WP_BASE_URL`, `HKRA_WP_USER`, `HKRA_WP_APP_PASSWORD` |
| Zoom (new) | `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, optional `ZOOM_HOST_USER_ID`, `ZOOM_DEFAULT_TIMEZONE` |
| Campaign | `CAMPAIGN_WORKER_URL`, `CAMPAIGN_WEBHOOK_SECRET` |

Restart the functions container after changing secrets.

---

## 3. Frontend (vendor/admin portal)

Local:

```bash
bun install
# .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY pointing at HKRA instance
bun dev
```

Production: [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md) — typically `bun run deploy:pages`.

---

## 4. Campaign worker (optional)

Only if email campaign orchestration is enabled:

```bash
bun run deploy:campaign-worker
```

Configure Worker secrets per [CAMPAIGN_ORCHESTRATOR.md](CAMPAIGN_ORCHESTRATOR.md).

---

## 5. WordPress (hkra.org.hk) — registration bridge

Out of this repo but required for Zoom auto-registrant flow:

- Accept `zoom_webinar_id` on `POST /wp-json/em-custom/v1/create-event`
- Store on EM Pro **ticket/product meta**
- On approved booking → Zoom Add Registrant API

See [event-api.md](../event-api.md) and [ZOOM_WEBINAR_INTEGRATION.md](ZOOM_WEBINAR_INTEGRATION.md).

---

## Checklist after pulling latest `main`

1. [ ] Run any **new** SQL files in `supabase/migrations/` (SQL Editor, in order).
2. [ ] Deploy Edge Functions (`deploy-functions-vps.ps1` or `deploy-functions.sh`).
3. [ ] Confirm Zoom secrets on functions container (if using Zoom auto-create).
4. [ ] Deploy frontend to Cloudflare (if UI changed).
5. [ ] Deploy campaign worker (if campaign code changed).
6. [ ] WordPress snippet updated (if create-event / booking hook changed).

---

## Agent / automation note

Coding agents should follow [AGENTS.md](../AGENTS.md): self-hosted DB = **paste migrations in SQL Editor**, not Cloud CLI push.
