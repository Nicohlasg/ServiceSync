/**
 * Booking Router — ServiceSync
 *
 * Handles: availability checks, booking creation with database-level locking,
 * booking lifecycle (accept → start → complete), and live ETA tracking.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '@/server/trpc';
import { getAdminClient } from '@/server/services/supabase-admin';
import { emitAuditEvent } from '@/server/services/audit';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const getAvailableSlotsInput = z.object({
  providerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.string().uuid().optional(),
  serviceDurationMinutes: z.number().int().min(15).max(480).default(60),
  clientLat: z.number().min(-90).max(90).optional(),
  clientLng: z.number().min(-180).max(180).optional(),
});

const createBookingInput = z.object({
  providerId: z.string().uuid(),
  // SEC-C2: serviceId is required — amount is always computed server-side
  serviceId: z.string().uuid(),
  serviceType: z.string().min(1),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrivalWindowStart: z.string().datetime(),
  arrivalWindowEnd: z.string().datetime(),
  estimatedDurationMinutes: z.number().int().min(15).max(480),
  address: z.string().min(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  // SEC-C2: Kept in schema for frontend compat but ignored — server computes from services table
  amount: z.number().int().min(0),
  depositAmount: z.number().int().min(0).default(0),
  clientName: z.string().min(1),
  clientPhone: z.string().min(1),
  clientEmail: z.string().email().optional(),
  notes: z.string().optional(),
});

const bookingIdInput = z.object({
  bookingId: z.string().uuid(),
});

const getBookingConfirmationInput = z.object({
  bookingId: z.string().uuid(),
});

const locationUpdateInput = z.object({
  bookingId: z.string().uuid(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const listBookingsInput = z.object({
  status: z.enum(['pending', 'accepted', 'in_progress', 'completed', 'cancelled']).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const bookingRouter = router({
  /**
   * Returns available time slots for a technician on a given date.
   * Public — homeowners use this to pick a slot on the booking page.
   */
  getAvailableSlots: publicProcedure
    .input(getAvailableSlotsInput)
    .query(async ({ ctx, input }) => {
      // Dynamically import to avoid circular deps at module level
      const { getAvailableSlots } = await import('@/server/services/availability');

      // If serviceId provided, look up duration from services table
      let durationMinutes = input.serviceDurationMinutes;
      if (input.serviceId) {
        const { data: service } = await ctx.supabase
          .from('services')
          .select('duration_minutes')
          .eq('id', input.serviceId)
          .eq('is_active', true)
          .single();

        if (service) {
          durationMinutes = service.duration_minutes;
        }
      }

      return getAvailableSlots({
        providerId: input.providerId,
        date: input.date,
        serviceDurationMinutes: durationMinutes,
        clientLat: input.clientLat,
        clientLng: input.clientLng,
      });
    }),

  /**
   * Creates a new pending booking with database-level locking to prevent
   * race conditions (two homeowners booking the same slot).
   *
   * Uses SELECT FOR UPDATE SKIP LOCKED on booking_slots.
   */
  createBooking: publicProcedure
    .input(createBookingInput)
    .mutation(async ({ ctx, input }) => {
      const {
        providerId,
        serviceId,
        serviceType,
        scheduledDate,
        arrivalWindowStart,
        arrivalWindowEnd,
        estimatedDurationMinutes,
        address,
        lat,
        lng,
        depositAmount,
        clientName,
        clientPhone,
        clientEmail,
        notes,
      } = input;

      // SEC-C2: Always compute amount from the server-side services row.
      // input.amount is ignored — prevents a caller from setting an arbitrary price.
      const { data: service } = await ctx.supabase
        .from('services')
        .select('price_cents')
        .eq('id', serviceId)
        .eq('provider_id', providerId)
        .eq('is_active', true)
        .single();

      if (!service) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or inactive service selected',
        });
      }
      const amount = service.price_cents;

      // Use a raw SQL transaction with SELECT FOR UPDATE for race condition handling
      const { data: result, error: txError } = await ctx.supabase.rpc(
        'create_booking_with_lock',
        {
          p_provider_id: providerId,
          p_service_id: serviceId,
          p_service_type: serviceType,
          p_scheduled_date: scheduledDate,
          p_arrival_window_start: arrivalWindowStart,
          p_arrival_window_end: arrivalWindowEnd,
          p_estimated_duration_minutes: estimatedDurationMinutes,
          p_address: address,
          p_lat: lat,
          p_lng: lng,
          p_amount: amount,
          p_deposit_amount: depositAmount,
          p_client_name: clientName,
          p_client_phone: clientPhone,
          p_client_email: clientEmail ?? null,
          p_notes: notes ?? '',
        }
      );

      // If the RPC doesn't exist yet, fall back to insert with overlap guard
      // Includes check for PostgREST PGRST202 error or message string matching missing function.
      if (txError?.code === '42883' || txError?.code === 'PGRST202' || txError?.message?.includes('Could not find the function')) {
        console.warn('[Booking] create_booking_with_lock RPC not found — using fallback insert with overlap guard');

        // SEC-H2: Check for overlapping bookings before inserting.
        // Not perfectly atomic (small race window remains until the RPC is deployed),
        // but prevents the obvious double-booking in the non-RPC path.
        const { data: overlapping } = await ctx.supabase
          .from('bookings')
          .select('id')
          .eq('provider_id', providerId)
          .eq('scheduled_date', scheduledDate)
          .in('status', ['pending', 'accepted', 'in_progress'])
          .lt('arrival_window_start', arrivalWindowEnd)
          .gt('arrival_window_end', arrivalWindowStart)
          .limit(1);

        if (overlapping && overlapping.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This time slot overlaps with an existing booking. Please choose another slot.',
          });
        }

        const estimated_completion = new Date(
          new Date(arrivalWindowStart).getTime() + estimatedDurationMinutes * 60_000
        ).toISOString();

        const { data: booking, error: insertErr } = await ctx.supabase
          .from('bookings')
          .insert({
            provider_id: providerId,
            service_id: serviceId,
            service_type: serviceType,
            status: 'pending',
            scheduled_date: scheduledDate,
            arrival_window_start: arrivalWindowStart,
            arrival_window_end: arrivalWindowEnd,
            estimated_duration_minutes: estimatedDurationMinutes,
            estimated_completion,
            address,
            lat,
            lng,
            amount,
            deposit_amount: depositAmount,
            client_name: clientName,
            client_phone: clientPhone,
            client_email: clientEmail,
            notes: notes ?? '',
          })
          .select()
          .single();

        if (insertErr || !booking) {
          console.error('[Booking] fallback insert error:', insertErr?.message);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create booking',
          });
        }

        // Fire push notification to technician (non-blocking)
        import('@/server/services/push-notifications').then(({ sendJobNotification }) => {
          sendJobNotification(providerId, {
            clientName,
            serviceType,
            date: scheduledDate,
            amount,
          }).catch(console.error);
        });

        void emitAuditEvent({
          actorId: null,
          actorIp: ctx.clientIp,
          entityType: 'booking',
          entityId: booking.id,
          action: 'create',
          diff: { provider_id: providerId, service_id: serviceId, amount, scheduledDate },
        });

        return {
          bookingId: booking.id,
          status: 'pending',
          arrivalWindowStart,
          arrivalWindowEnd,
          estimatedDuration: estimatedDurationMinutes,
          estimatedCompletion: estimated_completion,
        };
      }

      if (txError) {
        if (txError.message?.includes('slot_taken') || txError.message?.includes('unavailable')) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This time slot has just been taken. Please choose another slot.',
          });
        }
        console.error('[Booking] RPC error:', txError.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create booking',
        });
      }

      // Fire push notification to technician (non-blocking)
      import('@/server/services/push-notifications').then(({ sendJobNotification }) => {
        sendJobNotification(providerId, {
          clientName,
          serviceType,
          date: scheduledDate,
          amount,
        }).catch(console.error);
      });

      const bookingId = extractBookingIdFromRpcResult(result);
      if (!bookingId) {
        console.error('[Booking] Unexpected RPC result shape:', result);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create booking',
        });
      }

      const extra =
        typeof result === 'object' && result !== null && !Array.isArray(result)
          ? (result as Record<string, unknown>)
          : {};

      void emitAuditEvent({
        actorId: null,
        actorIp: ctx.clientIp,
        entityType: 'booking',
        entityId: bookingId,
        action: 'create',
        diff: { provider_id: providerId, service_id: serviceId, amount, scheduledDate },
      });

      return { ...extra, bookingId };
    }),

  /**
   * Public confirmation snapshot for a booking (permalink after create).
   *
   * SEC-H1: Minimised payload — address is masked to area-only, deposit amount
   * replaced with a boolean flag. Full details are only available via the
   * authenticated listBookings / invoice endpoints.
   */
  getBookingConfirmation: publicProcedure
    .input(getBookingConfirmationInput)
    .query(async ({ input }) => {
      let admin;
      try {
        admin = getAdminClient();
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Booking confirmation is temporarily unavailable',
        });
      }

      const { data: booking, error: bookingError } = await admin
        .from('bookings')
        .select(
          'id, provider_id, scheduled_date, arrival_window_start, address, deposit_amount, deposit_paid, status',
        )
        .eq('id', input.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      }

      const { data: profile } = await admin
        .from('profiles')
        .select('name, slug')
        .eq('id', booking.provider_id)
        .single();

      return {
        id: booking.id,
        providerName: profile?.name ?? 'Technician',
        providerSlug: profile?.slug ?? null,
        providerId: booking.provider_id,
        scheduledDate: booking.scheduled_date as string,
        arrivalWindowStart: booking.arrival_window_start as string | null,
        // SEC-H1: Mask full address — show area only (first meaningful segment)
        addressArea: maskAddressToArea(booking.address as string),
        // SEC-H1: Boolean flag instead of exact deposit amount
        depositSecured: !!(booking.deposit_paid || (booking.deposit_amount as number) > 0),
        status: booking.status,
      };
    }),

  /**
   * Lists bookings for the authenticated technician with filters.
   */
  listBookings: protectedProcedure
    .input(listBookingsInput)
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('provider_id', ctx.user.id)
        .order('scheduled_date', { ascending: true })
        .order('arrival_window_start', { ascending: true })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.status) {
        query = query.eq('status', input.status);
      }
      if (input.date) {
        query = query.eq('scheduled_date', input.date);
      }
      if (input.fromDate) {
        query = query.gte('scheduled_date', input.fromDate);
      }
      if (input.toDate) {
        query = query.lte('scheduled_date', input.toDate);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[Booking] listBookings error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch bookings' });
      }

      return {
        bookings: data ?? [],
        total: count ?? 0,
        hasMore: (count ?? 0) > input.offset + input.limit,
      };
    }),

  /**
   * Technician accepts a pending booking.
   * Sends push notification to the homeowner.
   */
  acceptBooking: protectedProcedure
    .input(bookingIdInput)
    .mutation(async ({ ctx, input }) => {
      const { data: booking, error } = await ctx.supabase
        .from('bookings')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error || !booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found or already processed',
        });
      }

      // Send confirmation push to homeowner (non-blocking)
      import('@/server/services/push-notifications').then(({ sendBookingConfirmation }) => {
        const arrivalWindow = `${formatTime(booking.arrival_window_start)} - ${formatTime(booking.arrival_window_end)}`;
        sendBookingConfirmation(booking.id, {
          providerName: ctx.user.user_metadata?.name ?? 'Your technician',
          date: booking.scheduled_date,
          arrivalWindow,
        }).catch(console.error);
      });

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'booking',
        entityId: booking.id,
        action: 'status_change',
        diff: { status: 'accepted' },
      });

      return booking;
    }),

  /**
   * Technician declines a pending booking.
   */
  declineBooking: protectedProcedure
    .input(bookingIdInput.extend({
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: booking, error } = await ctx.supabase
        .from('bookings')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancel_reason: input.reason ?? 'Declined by technician',
        })
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .eq('status', 'pending')
        .select()
        .single();

      if (error || !booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found or already processed',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'booking',
        entityId: booking.id,
        action: 'status_change',
        diff: { status: 'cancelled', reason: input.reason ?? 'Declined by technician' },
      });

      return booking;
    }),

  /**
   * Technician starts a job — marks as in_progress.
   * Enables live ETA tracking for the homeowner.
   */
  startJob: protectedProcedure
    .input(bookingIdInput)
    .mutation(async ({ ctx, input }) => {
      const { data: booking, error } = await ctx.supabase
        .from('bookings')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .eq('status', 'accepted')
        .select()
        .single();

      if (error || !booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found or not in accepted state',
        });
      }

      return booking;
    }),

  /**
   * Technician completes a job.
   */
  completeJob: protectedProcedure
    .input(bookingIdInput.extend({
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const { data: booking, error } = await ctx.supabase
        .from('bookings')
        .update({
          status: 'completed',
          completed_at: now,
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        })
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .eq('status', 'in_progress')
        .select()
        .single();

      if (error || !booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Booking not found or not in progress',
        });
      }

      return booking;
    }),

  /**
   * Updates technician's live location for ETA tracking.
   * Called every 30 seconds from the technician's phone during in_progress jobs.
   */
  updateLocation: protectedProcedure
    .input(locationUpdateInput)
    .mutation(async ({ ctx, input }) => {
      // Verify booking belongs to this technician and is in progress
      const { data: booking } = await ctx.supabase
        .from('bookings')
        .select('id, status')
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .eq('status', 'in_progress')
        .single();

      if (!booking) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Active booking not found',
        });
      }

      const { broadcastLocationUpdate } = await import('@/server/services/live-eta');
      const eta = await broadcastLocationUpdate({
        bookingId: input.bookingId,
        technicianLat: input.lat,
        technicianLng: input.lng,
        timestamp: new Date().toISOString(),
      });

      return eta;
    }),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });
}

/**
 * SEC-H1: Mask a Singapore address to area-only.
 * "Blk 123 Hougang Ave 1 #05-678" → "Hougang area"
 * Strips block/unit numbers and returns only the neighbourhood or postal district.
 */
function maskAddressToArea(address: string | null | undefined): string {
  if (!address?.trim()) return 'Address on file';

  // Common SG neighbourhood names (case-insensitive match)
  const areas = [
    'Ang Mo Kio', 'Bedok', 'Bishan', 'Bukit Batok', 'Bukit Merah', 'Bukit Panjang',
    'Bukit Timah', 'Changi', 'Choa Chu Kang', 'Clementi', 'Dover', 'Geylang',
    'Hougang', 'Jurong East', 'Jurong West', 'Kallang', 'Marine Parade', 'Novena',
    'Pasir Ris', 'Punggol', 'Queenstown', 'Sembawang', 'Sengkang', 'Serangoon',
    'Tampines', 'Toa Payoh', 'Woodlands', 'Yishun', 'Tengah', 'Jurong',
    'Holland', 'Orchard', 'Tanglin', 'Tiong Bahru', 'Redhill', 'Alexandra',
    'Tanjong Pagar', 'Marina', 'Raffles Place', 'City Hall', 'Outram',
    'Rochor', 'Little India', 'Bugis', 'Lavender', 'Paya Lebar',
  ];

  const lower = address.toLowerCase();
  for (const area of areas) {
    if (lower.includes(area.toLowerCase())) {
      return `${area} area`;
    }
  }

  // Fallback: strip block/unit patterns and take first meaningful segment
  const cleaned = address
    .replace(/^(Blk|Block)\s*\d+[A-Z]?\s*/i, '')
    .replace(/#\d+-\d+\s*/g, '')
    .replace(/\bS\(\d{6}\)\b/g, '')
    .replace(/Singapore\s*\d{6}/gi, '')
    .trim();

  const firstSegment = cleaned.split(/[,\n]/)[0]?.trim();
  return firstSegment ? `${firstSegment} area` : 'Address on file';
}

function extractBookingIdFromRpcResult(result: unknown): string | undefined {
  if (result == null) return undefined;
  if (typeof result === 'string') return result;
  if (Array.isArray(result) && result[0] != null && typeof result[0] === 'object') {
    return extractBookingIdFromRpcResult(result[0]);
  }
  if (typeof result === 'object') {
    const r = result as Record<string, unknown>;
    const id = r.bookingId ?? r.booking_id ?? r.id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}
