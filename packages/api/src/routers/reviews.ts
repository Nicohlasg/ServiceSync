import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure } from '../trpc';
import { getAdminClient } from '../services/supabase-admin';
import { sanitizeHtml } from '../utils/sanitize';

export const reviewsRouter = router({
  submit: publicProcedure
    .input(
      z.object({
        bookingId: z.string().uuid(),
        clientName: z.string().min(1).max(100),
        rating: z.number().int().min(1).max(5),
        comment: z.string().max(1000).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      let admin;
      try {
        admin = getAdminClient();
      } catch {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Review submission is temporarily unavailable',
        });
      }

      const { data: booking, error: bookingError } = await admin
        .from('bookings')
        .select('id, provider_id, status')
        .eq('id', input.bookingId)
        .single();

      if (bookingError || !booking) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking not found' });
      }

      if (booking.status !== 'completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reviews can only be left for completed jobs',
        });
      }

      const { data: existing } = await admin
        .from('reviews')
        .select('id')
        .eq('booking_id', input.bookingId)
        .maybeSingle();

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A review has already been submitted for this booking',
        });
      }

      const { error: insertError } = await admin.from('reviews').insert({
        provider_id: booking.provider_id,
        booking_id: input.bookingId,
        client_name: sanitizeHtml(input.clientName) ?? input.clientName,
        rating: input.rating,
        comment: sanitizeHtml(input.comment ?? '') ?? '',
        is_public: true,
      });

      if (insertError) {
        console.error('[Reviews] insert error:', insertError.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save review',
        });
      }

      const { data: stats } = await admin
        .from('reviews')
        .select('rating')
        .eq('provider_id', booking.provider_id)
        .eq('is_public', true);

      if (stats && stats.length > 0) {
        const count = stats.length;
        const avg = stats.reduce((sum, r) => sum + (r.rating as number), 0) / count;
        await admin
          .from('profiles')
          .update({
            review_count: count,
            avg_rating: Math.round(avg * 100) / 100,
          })
          .eq('id', booking.provider_id);
      }

      return { success: true };
    }),

  listForProvider: publicProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('reviews')
        .select('id, client_name, rating, comment, created_at')
        .eq('provider_id', input.providerId)
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[Reviews] listForProvider error:', error.message);
        return [];
      }

      return data ?? [];
    }),
});
