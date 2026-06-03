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
