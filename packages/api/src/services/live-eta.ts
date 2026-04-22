/**
 * Live ETA Service — ServiceSync
 *
 * Uses Supabase Realtime to broadcast technician location updates.
 * Homeowner subscribes to a channel for their booking and gets live ETA.
 */

import { getAdminClient } from './supabase-admin';
import { haversineDistance } from './availability';

const supabase = getAdminClient();

const AVERAGE_SPEED_KMH = 30; // Lower speed for real-time ETA (traffic during service hours)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationUpdate {
  bookingId: string;
  technicianLat: number;
  technicianLng: number;
  timestamp: string;
}

export interface ETAUpdate {
  bookingId: string;
  etaMinutes: number;
  distanceKm: number;
  technicianLat: number;
  technicianLng: number;
  estimatedArrival: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Broadcasts a technician's location update via Supabase Realtime.
 * Called every 30 seconds from the technician's phone when job is in_progress.
 */
export async function broadcastLocationUpdate(
  update: LocationUpdate
): Promise<ETAUpdate | null> {
  const { bookingId, technicianLat, technicianLng, timestamp } = update;

  // Fetch booking destination
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, lat, lng, status, estimated_duration_minutes')
    .eq('id', bookingId)
    .single();

  if (!booking || booking.status !== 'in_progress') return null;
  if (!booking.lat || !booking.lng) return null;

  // Calculate ETA
  const distanceKm = haversineDistance(
    technicianLat, technicianLng,
    booking.lat, booking.lng
  );
  const etaMinutes = Math.max(1, Math.ceil((distanceKm / AVERAGE_SPEED_KMH) * 60));
  const estimatedArrival = new Date(
    new Date(timestamp).getTime() + etaMinutes * 60_000
  ).toISOString();

  const etaUpdate: ETAUpdate = {
    bookingId,
    etaMinutes,
    distanceKm: Math.round(distanceKm * 10) / 10,
    technicianLat,
    technicianLng,
    estimatedArrival,
    updatedAt: timestamp,
  };

  // Broadcast via Supabase Realtime channel
  const channel = supabase.channel(`booking-eta:${bookingId}`);

  // Must subscribe before sending — otherwise messages are silently dropped
  await new Promise<void>((resolve) => {
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') resolve();
    });
  });

  await channel.send({
    type: 'broadcast',
    event: 'eta_update',
    payload: etaUpdate,
  });

  // Cleanup to avoid leaking connections
  await supabase.removeChannel(channel);

  return etaUpdate;
}

/**
 * Gets the Realtime channel name for a booking's ETA updates.
 * Used by the homeowner's client to subscribe.
 */
export function getETAChannelName(bookingId: string): string {
  return `booking-eta:${bookingId}`;
}

/**
 * Calculates a static ETA estimate (without live tracking).
 * Used when technician hasn't started the trip yet.
 */
export function calculateStaticETA(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): { etaMinutes: number; distanceKm: number } {
  const distanceKm = haversineDistance(fromLat, fromLng, toLat, toLng);
  const etaMinutes = Math.max(1, Math.ceil((distanceKm / AVERAGE_SPEED_KMH) * 60));
  return { etaMinutes, distanceKm: Math.round(distanceKm * 10) / 10 };
}
