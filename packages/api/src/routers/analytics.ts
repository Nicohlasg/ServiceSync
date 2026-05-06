import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

export const analyticsRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100) }))
    .query(async ({ ctx, input }) => {
      const yearStart = `${input.year}-01-01`;
      const yearEnd = `${input.year + 1}-01-01`;

      // Revenue YTD from paid invoices
      const { data: invoices } = await ctx.supabase
        .from('invoices')
        .select('total_cents')
        .eq('provider_id', ctx.user.id)
        .in('status', ['paid_cash', 'paid_qr'])
        .gte('created_at', yearStart)
        .lt('created_at', yearEnd);

      const revenueCents = (invoices ?? []).reduce((s, i) => s + (i.total_cents ?? 0), 0);
      const paidCount = (invoices ?? []).length;
      const avgTicketCents = paidCount > 0 ? Math.round(revenueCents / paidCount) : 0;

      // Jobs completed this year
      const { count: jobsCompleted } = await ctx.supabase
        .from('bookings')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', ctx.user.id)
        .eq('status', 'completed')
        .gte('scheduled_date', yearStart.slice(0, 10))
        .lt('scheduled_date', yearEnd.slice(0, 10));

      // Total active clients
      const { count: totalClients } = await ctx.supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', ctx.user.id)
        .eq('is_deleted', false);

      // Pending invoices count
      const { count: pendingInvoices } = await ctx.supabase
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', ctx.user.id)
        .eq('status', 'pending');

      return {
        revenueCents,
        paidCount,
        avgTicketCents,
        jobsCompleted: jobsCompleted ?? 0,
        totalClients: totalClients ?? 0,
        pendingInvoices: pendingInvoices ?? 0,
      };
    }),

  getTopServices: protectedProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100) }))
    .query(async ({ ctx, input }) => {
      const yearStart = `${input.year}-01-01`;
      const yearEnd = `${input.year + 1}-01-01`;

      const { data, error } = await ctx.supabase
        .from('bookings')
        .select('service_type, amount')
        .eq('provider_id', ctx.user.id)
        .eq('status', 'completed')
        .gte('scheduled_date', yearStart.slice(0, 10))
        .lt('scheduled_date', yearEnd.slice(0, 10));

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      // Group by service_type
      const map: Record<string, { count: number; revenueCents: number }> = {};
      for (const b of data ?? []) {
        const svc = (b.service_type as string | null) ?? 'Other';
        if (!map[svc]) map[svc] = { count: 0, revenueCents: 0 };
        map[svc].count += 1;
        map[svc].revenueCents += (b.amount as number | null) ?? 0;
      }

      return Object.entries(map)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
    }),
});
