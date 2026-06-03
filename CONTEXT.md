# HKRA Vendor CPD — domain glossary

## Zoom-eligible vendor

A vendor with `vendors.zoom_webinar_auto_create = true`. On admin approval, the system may create a Zoom webinar via API and sync the ID to the HKRA website.

## Zoom webinar record

A Zoom webinar created by the HKRA integration for an approved `vendor_request`, identified by `vendor_requests.zoom_webinar_id`. Distinct from a vendor-pasted ID before approval (same column, different source).

## Zoom sync error

Non-blocking failure from Zoom API create, stored in `vendor_requests.zoom_sync_error`. Approval still succeeds; admins can retry.

## Zoom webinar template

Optional vendor choice (`zoom_template_webinar_id` + `zoom_template_kind`) from HKRA Zoom account history: official webinar templates, scheduled webinars, or past reports. Applied when the webinar is auto-created on approval.

## Registration bridge

When a member completes Events Manager booking on hkra.org.hk, WordPress reads `zoom_webinar_id` from the ticket/product meta (set via the create-event API) and adds the member as a Zoom webinar registrant.

## HKRA website event

WordPress Events Manager event linked by `vendor_requests.hkra_wp_event_id`. Created as draft on approval when WordPress credentials are configured.
