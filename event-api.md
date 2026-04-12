# Events Manager — Create Event API (External Integration Guide)

This document describes the WordPress REST API endpoint used to **create** events in **Events Manager** (with Pro features where applicable, such as tickets and role-restricted booking). It is intended for **trusted external systems** that integrate with the HKRA website.

**Base URL (replace with your environment):** `https://YOUR-DOMAIN/`
**Endpoint path:** `/wp-json/em-custom/v1/create-event`
**Full URL example:** `https://YOUR-DOMAIN/wp-json/em-custom/v1/create-event`

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

External clients must authenticate as a user with that capability. Common approaches:

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
| `status`  | string | `publish` | Post status (e.g. `publish`, `draft`).       |

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

| Parameter          | Type    | Description                                                                                                                                                       |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_form_id`  | integer | If set, saved as post meta `_custom_booking_form` (custom booking form ID in Events Manager Pro).                                                                 |
| `cpd`              | string  | If Advanced Custom Fields is active, updates the site’s CPD field on the event post. Integrators only need to send the value; field configuration is server-side. |
| `event_categories` | array   | Assigned to taxonomy `event-categories` (non-empty only).                                                                                                         |
| `event_tags`       | array   | Assigned to taxonomy `event-tags` (non-empty only).                                                                                                               |
| `subspecialties`   | array   | Assigned to taxonomy `subspecialties` (non-empty only).                                                                                                           |

Taxonomy values are passed to `wp_set_object_terms()` as provided (typically **term IDs** or **slugs** per WordPress behaviour—confirm with your administrator).

---

## Success response

**HTTP status:** `200`

```json
{
  "success": true,
  "id": 12345,
  "message": "Event created with Roles, Custom Form, and Ticket Name.",
  "link": "https://YOUR-DOMAIN/events/your-event-slug/"
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
curl -sS -X POST "https://YOUR-DOMAIN/wp-json/em-custom/v1/create-event" \
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
    "booking_form_id": 5,
    "cpd": "2.5",
    "event_categories": [12, 34],
    "event_tags": ["webinar"],
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

The behaviour above is defined in the site’s Code Snippets (or equivalent) by:

- Route namespace: `em-custom/v1`
- Route: `/create-event`
- Callback: `handle_create_full_options_event`

If behaviour changes in code, this document should be updated together with those changes.
