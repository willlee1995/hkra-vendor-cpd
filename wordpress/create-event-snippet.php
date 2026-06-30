<?php
/**
 * HKRA Events Manager — create-event REST API (Code Snippets / mu-plugin).
 *
 * Route: POST /wp-json/em-custom/v1/create-event
 * Spec:  event-api.md in hkra-vendor-cpd repo.
 */

add_action('rest_api_init', static function (): void {
	register_rest_route(
		'em-custom/v1',
		'/create-event',
		array(
			'methods'             => 'POST',
			'callback'            => 'handle_create_full_options_event',
			'permission_callback' => static function (): bool {
				return is_user_logged_in() && current_user_can('publish_events');
			},
		)
	);
});

/**
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response|WP_Error
 */
function handle_create_full_options_event(WP_REST_Request $request) {
	try {
		if (! class_exists('EM_Event')) {
			return new WP_Error('em_missing', 'Events Manager plugin inactive.', array('status' => 500));
		}

		$title = trim((string) $request->get_param('title'));
		if ($title === '') {
			return new WP_Error('missing_title', 'Title required.', array('status' => 400));
		}

		$content = wp_kses_post((string) ($request->get_param('content') ?? ''));
		$status  = sanitize_key((string) ($request->get_param('status') ?? 'publish'));
		if (! in_array($status, array('publish', 'draft', 'pending', 'private'), true)) {
			$status = 'publish';
		}

		$event = new EM_Event();
		$event->event_name       = $title;
		$event->post_content     = $content;
		$event->post_status      = $status;
		$event->post_author      = get_current_user_id();
		$event->event_timezone   = (string) ($request->get_param('event_timezone') ?? 'Asia/Hong_Kong');
		$event->event_start_date = (string) ($request->get_param('event_start_date') ?? '');
		$event->event_end_date   = (string) ($request->get_param('event_end_date') ?? '');
		$event->event_start_time = (string) ($request->get_param('event_start_time') ?? '');
		$event->event_end_time   = (string) ($request->get_param('event_end_time') ?? '');
		$event->event_all_day    = filter_var($request->get_param('event_all_day'), FILTER_VALIDATE_BOOLEAN) ? 1 : 0;

		$location_id = (int) ($request->get_param('location_id') ?? 0);
		$event->location_id = $location_id > 0 ? $location_id : 0;

		$event_rsvp = filter_var($request->get_param('event_rsvp'), FILTER_VALIDATE_BOOLEAN);
		if ($event_rsvp) {
			$event->event_rsvp = 1;
			hkra_create_event_apply_ticket($event, $request);
		} else {
			$event->event_rsvp = 0;
		}

		$saved = $event->save();
		if (! $saved) {
			$errors = method_exists($event, 'get_errors') ? $event->get_errors() : array();
			return new WP_Error(
				'save_error',
				'Could not save event',
				array(
					'status' => 500,
					'errors' => $errors,
				)
			);
		}

		$event_id = (int) $event->post_id;
		hkra_create_event_apply_meta($event_id, $request);

		return rest_ensure_response(
			array(
				'success' => true,
				'id'      => $event_id,
				'message' => 'Event created with Roles, Custom Form, and Ticket Name.',
				'link'    => get_permalink($event_id),
			)
		);
	} catch (Throwable $e) {
		return new WP_Error(
			'create_event_exception',
			$e->getMessage(),
			array(
				'status' => 500,
				'file'   => $e->getFile(),
				'line'   => $e->getLine(),
			)
		);
	}
}

/**
 * @param EM_Event        $event   Event object.
 * @param WP_REST_Request $request Request.
 */
function hkra_create_event_apply_ticket(EM_Event $event, WP_REST_Request $request): void {
	if (! class_exists('EM_Ticket')) {
		return;
	}

	$ticket_price  = (float) ($request->get_param('ticket_price') ?? 50);
	$ticket_spaces = (int) ($request->get_param('ticket_spaces') ?? 500);
	$ticket_name   = (string) ($request->get_param('ticket_name') ?? 'HKRA - Registration');
	$allowed_roles = $request->get_param('allowed_roles');
	if (! is_array($allowed_roles)) {
		$allowed_roles = array();
	}

	$tickets = $event->get_tickets();
	if (! $tickets || ! method_exists($tickets, 'add')) {
		return;
	}

	$ticket = new EM_Ticket();
	$ticket->ticket_name    = $ticket_name;
	$ticket->ticket_price   = $ticket_price;
	$ticket->ticket_spaces  = $ticket_spaces;
	$ticket->ticket_members = 1;
	$ticket->ticket_guests  = 0;
	$ticket->ticket_min     = 1;
	$ticket->ticket_max     = 1;

	if ($allowed_roles !== array()) {
		$ticket->ticket_meta['allowed_roles'] = array_values(array_map('strval', $allowed_roles));
	}

	$zoom_webinar_id = trim((string) ($request->get_param('zoom_webinar_id') ?? ''));
	if ($zoom_webinar_id !== '') {
		$ticket->ticket_meta['zoom_webinar_id'] = $zoom_webinar_id;
	}

	$tickets->add($ticket);
}

/**
 * @param int             $event_id Event post ID.
 * @param WP_REST_Request $request  Request.
 */
function hkra_create_event_apply_meta(int $event_id, WP_REST_Request $request): void {
	$booking_form_id = (int) ($request->get_param('booking_form_id') ?? 0);
	if ($booking_form_id <= 0 && function_exists('em_get_booking_form_by_name')) {
		$form = em_get_booking_form_by_name('Empty');
		if ($form && isset($form->id)) {
			$booking_form_id = (int) $form->id;
		}
	}
	if ($booking_form_id > 0) {
		update_post_meta($event_id, '_custom_booking_form', $booking_form_id);
	}

	$attendee_form = $request->get_param('attendee_form');
	if ($attendee_form !== null && $attendee_form !== '') {
		update_post_meta($event_id, '_custom_attendee_form', $attendee_form);
	}

	$cpd = $request->get_param('cpd');
	if ($cpd !== null && $cpd !== '' && function_exists('update_field')) {
		update_field('cpd', (string) $cpd, $event_id);
	}

	hkra_create_event_set_terms($event_id, 'event-categories', $request->get_param('event_categories'));
	hkra_create_event_set_terms($event_id, 'event-tags', $request->get_param('event_tags'));
	hkra_create_event_set_terms($event_id, 'subspecialties', $request->get_param('subspecialties'));
}

/**
 * @param int    $post_id  Post ID.
 * @param string $taxonomy Taxonomy slug.
 * @param mixed  $terms    Term IDs or slugs.
 */
function hkra_create_event_set_terms(int $post_id, string $taxonomy, $terms): void {
	if (! is_array($terms) || $terms === array()) {
		return;
	}
	wp_set_object_terms($post_id, $terms, $taxonomy, false);
}
