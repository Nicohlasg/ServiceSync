import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { sanitizeHtml } from '../utils/sanitize';

const INTERVAL_MONTHS = z.union([
  z.literal(1), z.literal(2), z.literal(3), z.literal(6), z.literal(12),
]);

export const plansRouter = router({
  create: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      serviceType: z.string().min(1).max(100),
      intervalMonths: INTERVAL_MONTHS,
      priceCents: z.number().int().min(0).default(0),
      nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      notes: z.string().max(500).default(''),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('service_plans')
        .insert({
          provider_id: ctx.user.id,
          client_id: input.clientId,
          service_type: sanitizeHtml(input.serviceType) ?? input.serviceType,
          interval_months: input.intervalMonths,
          price_cents: input.priceCents,
          next_due_date: input.nextDueDate,
          notes: sanitizeHtml(input.notes) ?? '',
          status: 'active',
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  list: protectedProcedure
    .input(z.object({ clientId: z.string().uuid().optional() }))
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('service_plans')
        .select('*, clients(name, phone)')
        .eq('provider_id', ctx.user.id)
        .neq('status', 'cancelled')
        .order('next_due_date', { ascending: true });
      if (input.clientId) {
        query = query.eq('client_id', input.clientId);
      }
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  listDueSoon: protectedProcedure
    .query(async ({ ctx }) => {
      const twoWeeksOut = new Date();
      twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);
      const { data, error } = await ctx.supabase
        .from('service_plans')
        .select('*, clients(name, phone)')
        .eq('provider_id', ctx.user.id)
        .eq('status', 'active')
        .lte('next_due_date', twoWeeksOut.toISOString().slice(0, 10))
        .order('next_due_date', { ascending: true });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  update: protectedProcedure
    .input(z.object({
      planId: z.string().uuid(),
      intervalMonths: INTERVAL_MONTHS.optional(),
      priceCents: z.number().int().min(0).optional(),
      nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      status: z.enum(['active', 'paused', 'cancelled']).optional(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { planId, ...rest } = input;
      const updates: Record<string, unknown> = {};
      if (rest.intervalMonths !== undefined) updates.interval_months = rest.intervalMonths;
      if (rest.priceCents !== undefined) updates.price_cents = rest.priceCents;
      if (rest.nextDueDate !== undefined) updates.next_due_date = rest.nextDueDate;
      if (rest.status !== undefined) updates.status = rest.status;
      if (rest.notes !== undefined) updates.notes = sanitizeHtml(rest.notes) ?? rest.notes;

      const { error } = await ctx.supabase
        .from('service_plans')
        .update(updates)
        .eq('id', planId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  markServiced: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: plan, error: fetchErr } = await ctx.supabase
        .from('service_plans')
        .select('interval_months')
        .eq('id', input.planId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (fetchErr || !plan) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found' });

      const now = new Date();
      const nextDue = new Date(now);
      nextDue.setMonth(nextDue.getMonth() + (plan as { interval_months: number }).interval_months);

      const { error } = await ctx.supabase
        .from('service_plans')
        .update({
          last_serviced_at: now.toISOString(),
          next_due_date: nextDue.toISOString().slice(0, 10),
        })
        .eq('id', input.planId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  remove: protectedProcedure
    .input(z.object({ planId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('service_plans')
        .update({ status: 'cancelled' })
        .eq('id', input.planId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
