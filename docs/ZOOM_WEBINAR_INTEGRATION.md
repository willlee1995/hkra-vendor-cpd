# Zoom webinar auto-create

## Flow

1. Admin enables **Zoom auto** for a vendor (User Management → Zoom auto column, or checkbox when creating a vendor).
2. Vendor submits a CPD request (no manual Zoom ID when auto is on). They can pick a **Zoom webinar template** from recent HKRA Zoom webinars/templates (`GET /zoom-list-webinars`).
3. On **approval**: Edge Function creates Zoom webinar → updates `vendor_requests` → syncs HKRA WordPress event with `zoom_webinar_id` JSON param → starts email campaign.
4. Admin publishes the draft event on hkra.org.hk.
5. Member registers on the HKRA event page; WordPress adds them as a Zoom registrant using product meta.

## Manual test matrix

| Case | Steps | Expected |
| ---- | ----- | -------- |
| Happy path | Flag vendor → submit → approve | `zoom_webinar_id`, `zoom_join_url` set; WP create-event body includes `zoom_webinar_id` |
| Zoom not configured | Approve without `ZOOM_*` secrets | Approval OK; `zoom_sync_error` or skip; WP sync may still run |
| ON24 vendor | Flag vendor but request has ON24 fields | Zoom create skipped (`reason: on24`) |
| Retry | Admin → Zoom card → Create/Retry | New webinar if empty; WP force re-sync |
| Non-flagged vendor | Approve with manual Zoom ID | No Zoom API call; WP payload includes pasted ID |

## Deploy

Follow **[DEPLOYMENT.md](DEPLOYMENT.md)**. Summary:

1. **SQL Editor** — run (if not already applied):
   - `supabase/migrations/20260603000000_zoom_webinar_auto_create.sql`
   - `supabase/migrations/20260603100000_zoom_template_webinar.sql`
2. **Edge Functions** — `.\scripts\deploy-functions-vps.ps1` or `./scripts/deploy-functions.sh` (includes `zoom-create-webinar`, `zoom-list-webinars`, updated `vendor-requests` + `_shared`).
3. **Secrets** on the functions container: `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` (see `supabase/functions/README.md`), then restart the container.

## WordPress (hkra.org.hk)

Out of this repo: extend `handle_create_full_options_event` to save `zoom_webinar_id` on the EM Pro ticket product and hook approved bookings to Zoom Add Registrant API.
