/**
 * Web Push Notification Service — ServiceSync
 *
 * Uses the Web Push API (free, built into browsers).
 * No vendor lock-in, no per-message fees.
 *
 * Required env vars:
 *   VAPID_PUBLIC_KEY    — VAPID public key
 *   VAPID_PRIVATE_KEY   — VAPID private key
 *   VAPID_SUBJECT       — mailto: or https:// URL
 */

import { getAdminClient } from './supabase-admin';

const supabase = getAdminClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string }>;
}

export interface PushResult {
  success: boolean;
  sent: number;
  failed: number;
  errors?: string[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stores a push subscription for a user.
 */
export async function subscribeToPush(
  userId: string,
  subscription: PushSubscription,
  userAgent?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent,
      is_active: true,
    }, {
      onConflict: 'endpoint',
    });

  return !error;
}

/**
 * Stores a push subscription for a booking (anonymous homeowner).
 */
export async function subscribeBookingToPush(
  bookingId: string,
  subscription: PushSubscription
): Promise<boolean> {
  const { error } = await supabase
    .from('booking_push_subscriptions')
    .insert({
      booking_id: bookingId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });

  return !error;
}

/**
 * Sends a push notification to a technician (all their subscribed devices).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!subs?.length) {
    return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions'] };
  }

  const subscriptions: PushSubscription[] = subs.map((s: any) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }));

  return sendPushNotifications(subscriptions, payload);
}

/**
 * Sends a push notification to all subscribers of a booking (homeowner devices).
 */
export async function sendPushToBooking(
  bookingId: string,
  payload: PushPayload
): Promise<PushResult> {
  const { data: subs } = await supabase
    .from('booking_push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('booking_id', bookingId);

  if (!subs?.length) {
    return { success: false, sent: 0, failed: 0, errors: ['No active subscriptions'] };
  }

  const subscriptions: PushSubscription[] = subs.map((s: any) => ({
    endpoint: s.endpoint,
    keys: { p256dh: s.p256dh, auth: s.auth },
  }));

  return sendPushNotifications(subscriptions, payload);
}

/**
 * Sends job notification to technician.
 */
export async function sendJobNotification(
  technicianId: string,
  booking: { clientName: string; serviceType: string; date: string; amount: number }
): Promise<PushResult> {
  const { formatCents } = await import('../payment');
  return sendPushToUser(technicianId, {
    title: 'New Job Request!',
    body: `${booking.clientName} wants ${booking.serviceType} - ${formatCents(booking.amount)}`,
    icon: '/icon-192x192.png',
    data: { type: 'new_booking', date: booking.date },
    actions: [
      { action: 'accept', title: 'Accept' },
      { action: 'view', title: 'View Details' },
    ],
  });
}

/**
 * Sends booking confirmation to homeowner.
 */
export async function sendBookingConfirmation(
  bookingId: string,
  details: { providerName: string; date: string; arrivalWindow: string }
): Promise<PushResult> {
  return sendPushToBooking(bookingId, {
    title: 'Booking Confirmed!',
    body: `${details.providerName} will arrive ${details.arrivalWindow} on ${details.date}`,
    icon: '/icon-192x192.png',
    data: { type: 'booking_confirmed', bookingId },
  });
}

/**
 * Sends ETA update to homeowner.
 */
export async function sendETAUpdate(
  bookingId: string,
  etaMinutes: number
): Promise<PushResult> {
  return sendPushToBooking(bookingId, {
    title: 'Technician On The Way!',
    body: `Arriving in approximately ${etaMinutes} minutes`,
    icon: '/icon-192x192.png',
    data: { type: 'eta_update', bookingId, etaMinutes },
  });
}

/**
 * Removes inactive subscriptions.
 */
export async function unsubscribe(endpoint: string): Promise<void> {
  await supabase
    .from('push_subscriptions')
    .update({ is_active: false })
    .eq('endpoint', endpoint);
}

// ---------------------------------------------------------------------------
// Web Push Implementation
// ---------------------------------------------------------------------------

async function sendPushNotifications(
  subscriptions: PushSubscription[],
  payload: PushPayload
): Promise<PushResult> {
  // Lazy import web-push to avoid bundling issues
  let webpush: any;
  try {
    webpush = await import('web-push');
  } catch {
    // web-push not installed — return gracefully
    console.warn('[Push] web-push package not available');
    return { success: false, sent: 0, failed: 0, errors: ['web-push not installed'] };
  }

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not configured');
    return { success: false, sent: 0, failed: 0, errors: ['VAPID keys not configured'] };
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'https://servicesync.sg',
    vapidPublicKey,
    vapidPrivateKey
  );

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  const jsonPayload = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        jsonPayload
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired — clean up
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('endpoint', sub.endpoint);
      }
      errors.push(err.message ?? 'Push send failed');
    }
  }

  return { success: sent > 0, sent, failed, errors: errors.length ? errors : undefined };
}
