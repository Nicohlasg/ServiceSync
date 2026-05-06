import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { sanitizeHtml } from '../utils/sanitize';

export const expensesRouter = router({
  add: protectedProcedure
    .input(z.object({
      bookingId: z.string().uuid(),
      label: z.string().min(1).max(200),
      amountCents: z.number().int().min(0),
      category: z.enum(['parts', 'fuel', 'labour', 'other']).default('other'),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify booking belongs to provider
      const { data: booking } = await ctx.supabase
        .from('bookings')
        .select('id, amount')
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (!booking) throw new TRPCError({ code: 'FORBIDDEN', message: 'Job not found' });

      const { data, error } = await ctx.supabase
        .from('expenses')
        .insert({
          provider_id: ctx.user.id,
          booking_id: input.bookingId,
          label: sanitizeHtml(input.label),
          amount_cents: input.amountCents,
          category: input.category,
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  listForBooking: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('expenses')
        .select('id, label, amount_cents, category, created_at')
        .eq('booking_id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .order('created_at', { ascending: true });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  delete: protectedProcedure
    .input(z.object({ expenseId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('expenses')
        .delete()
        .eq('id', input.expenseId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
