# Agent notes — hkra-vendor-cpd

Guidance for coding agents working in this repository.

## Supabase is self-hosted

This project uses **self-hosted Supabase** (HKRA VPS / Docker), **not** Supabase Cloud.

- Do **not** assume `supabase link`, `supabase db push`, or a cloud `project-ref` will apply schema changes.
- Do **not** tell the user to “push migrations” via the Supabase CLI unless they explicitly use that workflow on their host.

## Database migrations — how to deploy

Prefer the automated script (tracks applied versions in `public.hkra_schema_migrations`):

```powershell
.\scripts\run-migrations-vps.ps1 -DryRun   # list pending
.\scripts\run-migrations-vps.ps1             # apply pending via SSH + docker psql
```

Config: `SSH_TARGET`, `POSTGRES_CONTAINER` (default `supabase-db`) in [`.env.deploy.example`](.env.deploy.example). On a DB that already has schema from manual SQL Editor runs, baseline once with `-BaselineThrough <last_applied_version>` before the first real apply.

Manual fallback: Supabase Studio **SQL Editor** — paste each new file under [`supabase/migrations/`](supabase/migrations/) in **filename sort order** (`YYYYMMDDHHMMSS_…`). Prefer `IF NOT EXISTS`; if a migration partially failed, fix forward with a new migration rather than editing history.

When adding a feature that needs new columns or tables:

- Add a **new** file in `supabase/migrations/` (do not rewrite old migrations that may already be live).
- Document the filename in the PR/commit message so ops can run it manually.

## Edge Functions — how to deploy

Edge Functions are deployed to the **Docker** `supabase-edge-functions` (or equivalent) container, not via `supabase functions deploy` to Cloud.

- See [`docs/DEPLOY_EDGE_FUNCTIONS.md`](docs/DEPLOY_EDGE_FUNCTIONS.md)
- Scripts: [`scripts/deploy-functions.sh`](scripts/deploy-functions.sh), [`scripts/deploy-functions-vps.ps1`](scripts/deploy-functions-vps.ps1)
- After changing `_shared/` or any function, redeploy **all** function folders listed in those scripts (including `_shared`, `zoom-create-webinar`, `zoom-list-webinars`, etc.).

Set secrets (Zoom, HKRA WordPress, campaign worker, Resend) on the **functions container / host environment** — see [`supabase/functions/README.md`](supabase/functions/README.md).

## Full deployment checklist (humans)

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** — migrations (SQL Editor), Edge Functions (Docker scripts), Cloudflare frontend, secrets, and post-deploy checklist.

## Related docs

- [CONTEXT.md](CONTEXT.md) — domain glossary
- [docs/ZOOM_WEBINAR_INTEGRATION.md](docs/ZOOM_WEBINAR_INTEGRATION.md) — Zoom auto-create + templates
- [docs/CAMPAIGN_ORCHESTRATOR.md](docs/CAMPAIGN_ORCHESTRATOR.md) — email campaign worker

## Learned User Preferences

- After changes under `supabase/functions/`, remind to deploy edge functions to the self-hosted instance at **https://supabase.hkra.org.hk** (not only commit locally).
- Vendor extra notification addresses are edited by **super-admin** only (`/admin/vendor-notifications`; `manage-users` PATCH for `notification_emails` is super-admin restricted).

## Learned Workspace Facts

- HKRA WordPress event sync uses the **`hkra-em-api`** plugin: `POST /wp-json/hkra-em/v1/events` (namespace `hkra-em/v1`). Legacy `em-custom/v1/create-event` is **retired**.
- HKRA event sync client: `supabase/functions/_shared/hkraCreateEvent.ts` (used by `vendor-requests` and `hkra-create-event`).
- Self-hosted Supabase VPS: **46.202.166.252**; Docker container **`supabase-edge-functions`**; SSH user **`root`** (`SSH_TARGET=root@46.202.166.252` in `.env.deploy`).
- Supabase API / Studio base: **https://supabase.hkra.org.hk**.
- Edge function deploy scripts: key-based `scripts/deploy-functions-vps.ps1`; password-based `scripts/deploy-functions-vps-password.py` (`DEPLOY_SSH_PASSWORD` env var). Scripts deploy **code only** — not secrets.
- Local WordPress creds for dev/testing: **`.env.hkra`** (gitignored) with `HKRA_WP_*`; production secrets belong on the functions container / VPS env.
- Known WordPress issue: `GET hkra-em/v1/discovery` and list routes work, but **`POST /hkra-em/v1/events` returns HTTP 500** with empty HTML — investigate **hkra-em-api** / server-side PHP, not vendor portal payloads.
- Extra vendor notification recipients: `vendors.notification_emails` merged with each request’s `contact_email` via `collectVendorNotificationRecipients()` in `supabase/functions/vendor-requests/email.ts`.
