# HKRA Events Manager API — Vendor portal integration

The HKRA website uses the **`hkra-em-api`** WordPress plugin (namespace **`hkra-em/v1`**). The vendor portal creates events via:

| Property | Value |
| -------- | ----- |
| **Base URL** | `https://hkra.org.hk` (or `HKRA_WP_BASE_URL`) |
| **Create event** | `POST /wp-json/hkra-em/v1/events` |
| **Discovery** | `GET /wp-json/hkra-em/v1/discovery` |
| **Plugin** | `hkra-em-api` v1.0.0 |

The legacy Code Snippet route `em-custom/v1/create-event` is **retired**. Full plugin spec: `SPEC.md` / `API.md` on the WordPress site.

---

## Prerequisites

- **WordPress** REST API enabled (default).
- **Events Manager** plugin active (`EM_Event` class available).
- A **WordPress user account** that has the **`publish_events`** capability (typically Editor or Administrator, or a custom role granted this capability).
- **HTTPS** is strongly recommended for all requests that send credentials.

---

## Authentication

The endpoint uses WordPress’s permission check:

```php
current_user_can( 'publish_events' )
```

External clients must authenticate as a user with **`edit_events`** / **`publish_events`** (see plugin discovery `capabilities.events`). Common approaches:

### 1. Application Passwords (recommended for server-to-server)

1. In WordPress: **Users → Profile** (or the integration user’s profile).
2. Enable **Application Passwords** (requires HTTPS in many setups).
3. Create an application password for the integration.
4. Use **HTTP Basic Authentication** on each request:

   - **Username:** the WordPress username (or applicable auth identifier your site uses).
   - **Password:** the generated application password (not the account’s normal password).

Example header:

```http
Authorization: Basic BASE64(username:application_password)
```

### 2. Cookie / session authentication

Suitable for browser-based or same-origin tools only; not typical for third-party backends.

### 3. Custom plugins

If your site adds JWT, OAuth, or other REST authentication, use whatever your administrators have configured—as long as the resolved user can `publish_events`.

---

## Request

| Property         | Value                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Method**       | `POST`                                                                                                                |
| **Content-Type** | `application/json` (recommended) or `application/x-www-form-urlencoded` / form data as supported by `WP_REST_Request` |

JSON body parameters are read via `$request->get_param()`, so top-level JSON keys map to the parameter names below.

---

## Request parameters

### Required

| Parameter | Type   | Description                                                     |
| --------- | ------ | --------------------------------------------------------------- |
| `title`   | string | Event title. Required; empty values return `400 missing_title`. |

### Event content and status

| Parameter | Type   | Default   | Description                                  |
| --------- | ------ | --------- | -------------------------------------------- |
| `content` | string | —         | HTML allowed; passed through `wp_kses_post`. |
| `status`  | string | `publish` | Post status (e.g. `draft`, `publish`, `pending`, `private`). Vendor portal integration defaults to `publish` so approved events go live; set `HKRA_DEFAULT_EVENT_STATUS=draft` on the functions container to create drafts instead. |

### Schedule and timezone

| Parameter          | Type             | Default          | Description                                                                 |
| ------------------ | ---------------- | ---------------- | --------------------------------------------------------------------------- |
| `event_timezone`   | string           | `Asia/Hong_Kong` | PHP timezone identifier (e.g. `Asia/Hong_Kong`, `UTC`).                     |
| `event_start_date` | string           | —                | Typically `YYYY-MM-DD` (Events Manager format).                             |
| `event_end_date`   | string           | —                | Typically `YYYY-MM-DD`.                                                     |
| `event_start_time` | string           | —                | Time string as expected by Events Manager (commonly `HH:MM` or `HH:MM:SS`). |
| `event_end_time`   | string           | —                | Same as above.                                                              |
| `event_all_day`    | boolean / truthy | `false`          | If truthy, treated as all-day event (`1`).                                  |

Confirm date/time formats with your site administrator if validation errors occur.

### Location

| Parameter     | Type    | Description                                                                          |
| ------------- | ------- | ------------------------------------------------------------------------------------ |
| `location_id` | integer | Existing Events Manager **location** ID. If empty or `≤ 0`, location is unset (`0`). |

### Bookings (RSVP) and ticket

When **`event_rsvp`** is **truthy** (see below), the API enables bookings and creates **one** ticket with the following behaviour:

- Ticket is **members-only** (`ticket_members = 1`, `ticket_guests = 0`).
- Per booking: **min 1, max 1** spaces for that ticket.

| Parameter       | Type             | Default (when RSVP on) | Description                                                                                                                                                                                   |
| --------------- | ---------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_rsvp`    | boolean-like     | —                      | Enable bookings/ticket when `true` (see [PHP `FILTER_VALIDATE_BOOLEAN`](https://www.php.net/manual/en/filter.filters.validate.php) — accepts `true`, `"1"`, `"true"`, `"on"`, `"yes"`, etc.). |
| `ticket_price`  | number           | `50.00`                | Ticket price.                                                                                                                                                                                 |
| `ticket_spaces` | integer          | `500`                  | Capacity for that ticket / event spaces.                                                                                                                                                      |
| `ticket_name`   | string           | `HKRA - Registration`  | Display name of the ticket.                                                                                                                                                                   |
| `allowed_roles` | array of strings | —                      | WordPress role **slugs** allowed to book, e.g. `["subscriber","hkra_member"]`. Example in implementation: `["administrator","subscriber","hkra_member"]`.                                     |

If `event_rsvp` is **not** truthy, the event is created **without** RSVP/bookings (`event_rsvp = 0`).

### After save: meta, CPD, taxonomies

Applied only after a successful `EM_Event::save()`.

| Parameter          | Type             | Default (RSVP on) | Description                                                                                                                                                       |
| ------------------ | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_form_id`  | integer          | form named **Empty** | Saved as post meta `_custom_booking_form`. If omitted, the API looks up the Events Manager Pro booking form named `Empty`. Override with an explicit ID.        |
| `attendee_form_id` | string / integer | `none`            | Post meta `_custom_attendee_form`. Use `none` to disable. |
| `cpd`              | string           | —                 | If Advanced Custom Fields is active, updates the site’s CPD field on the event post. Integrators only need to send the value; field configuration is server-side. |
| `event_categories` | array   | Alias **`categories`** — taxonomy `event-categories`. |
| `event_tags`       | array   | Alias **`tags`** — taxonomy `event-tags`. |
| `subspecialties`   | array   | Assigned to taxonomy `subspecialties` (non-empty only).                                                                                                           |
| `zoom_webinar_id`  | string  | When `event_rsvp` creates the ticket, saved to **Events Manager Pro ticket/product meta** (`zoom_webinar_id`) so approved HKRA site bookings can auto-register attendees in Zoom. Omit or empty = no Zoom bridge. |

Taxonomy values are passed to `wp_set_object_terms()` as provided (typically **term IDs** or **slugs** per WordPress behaviour—confirm with your administrator).

**Zoom registrant bridge:** The WordPress `create-event` handler must persist `zoom_webinar_id` on the ticket product when RSVP is enabled. A separate booking hook on hkra.org.hk calls the Zoom Add Registrant API when a member completes registration (booking status approved). Vendor portal sends this field via the HKRA integration (`hkra-create-event` / approval automation).

---

## Success response

**HTTP status:** `201` (or `200`)

```json
{
  "event": {
    "event_id": 12345,
    "post_id": 12345,
    "title": "Example CPD Webinar",
    "link": "https://hkra.org.hk/events/your-event-slug/",
    "status": "draft"
  }
}
```

- **`id`:** WordPress post ID of the event.
- **`link`:** Public permalink from `get_permalink( $event_id )`.

**Note:** The event author is set to the **authenticated user** (`post_author` = current user ID).

---

## Error responses

WordPress returns JSON with a `code`, `message`, and optional `data.status`.

| Situation                    | HTTP                | Code (typical)   | Message (typical)                                                   |
| ---------------------------- | ------------------- | ---------------- | ------------------------------------------------------------------- |
| User cannot `publish_events` | `403`               | `rest_forbidden` | (WordPress default)                                                 |
| Missing `title`              | `400`               | `missing_title`  | `Title required.`                                                   |
| Events Manager inactive      | `500`               | `em_missing`     | `Events Manager plugin inactive.`                                   |
| Save failed                  | (see `data.status`) | `save_error`     | `Could not save event` — may include `errors` from the event object |

---

## Example: `curl` with JSON and Application Password

```bash
curl -sS -X POST "https://hkra.org.hk/wp-json/hkra-em/v1/events" \
  -u "INTEGRATION_USERNAME:XXXX XXXX XXXX XXXX XXXX XXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Example CPD Webinar",
    "content": "<p>Event description HTML.</p>",
    "status": "publish",
    "event_timezone": "Asia/Hong_Kong",
    "event_start_date": "2026-06-01",
    "event_end_date": "2026-06-01",
    "event_start_time": "14:00:00",
    "event_end_time": "16:00:00",
    "event_all_day": false,
    "location_id": 0,
    "event_rsvp": true,
    "ticket_price": 100,
    "ticket_spaces": 200,
    "ticket_name": "Standard registration",
    "allowed_roles": ["subscriber", "hkra_member"],
    "attendee_form_id": "none",
    "cpd": "2.5",
    "categories": [12, 34],
    "tags": ["webinar"],
    "subspecialties": [7]
  }'
```

Replace `YOUR-DOMAIN`, username, and application password. Use a real location ID and taxonomy IDs/slugs as agreed with HKRA.

---

## Operational notes

1. **Idempotency:** This API does not deduplicate requests. Retrying the same payload creates **another** event unless your client implements idempotency keys server-side.
2. **Rate limiting:** Subject to WordPress, hosting, and security plugins; coordinate high-volume imports with the site host.
3. **Support:** Term IDs, location IDs, booking form IDs, and role slugs are **site-specific**. External teams should obtain a short **reference list** from HKRA administrators.

---

## Implementation reference

- WordPress plugin: **`hkra-em-api`** (`hkra-em/v1`)
- Vendor portal client: `supabase/functions/_shared/hkraCreateEvent.ts` → `POST …/hkra-em/v1/events`
- Optional env override: `HKRA_WP_API_NAMESPACE` (default `hkra-em/v1`)

Discovery before integration:

```bash
curl -sS -u "USER:APP_PASSWORD" "https://hkra.org.hk/wp-json/hkra-em/v1/discovery"
```
