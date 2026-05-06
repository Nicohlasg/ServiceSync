import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';

const quarterInput = z.object({
  year: z.number().int().min(2020).max(2100),
  quarter: z.number().int().min(1).max(4),
});

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 3;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Use SGT offset (+08:00) so quarter boundaries align with Singapore calendar dates
  const start = `${year}-${pad(startMonth)}-01T00:00:00+08:00`;
  const end = endMonth > 12
    ? `${year + 1}-01-01T00:00:00+08:00`
    : `${year}-${pad(endMonth)}-01T00:00:00+08:00`;
  return { start, end };
}

function sgtMonth(isoString: string): number {
  const d = new Date(isoString);
  return new Date(d.getTime() + 8 * 3600 * 1000).getUTCMonth() + 1;
}

export const gstRouter = router({
  getQuarterlySummary: protectedProcedure
    .input(quarterInput)
    .query(async ({ ctx, input }) => {
      const { start, end } = quarterRange(input.year, input.quarter);

      const [invoicesRes, expensesRes] = await Promise.all([
        ctx.supabase
          .from('invoices')
          .select('total_cents, tax_cents, created_at')
          .eq('provider_id', ctx.user.id)
          .in('status', ['paid_cash', 'paid_qr'])
          .gte('created_at', start)
          .lt('created_at', end),
        ctx.supabase
          .from('expenses')
          .select('amount_cents, created_at')
          .eq('provider_id', ctx.user.id)
          .gte('created_at', start)
          .lt('created_at', end),
      ]);

      const invoices = invoicesRes.data ?? [];
      const expenses = expensesRes.data ?? [];

      const totalRevenueCents = invoices.reduce((s, i) => s + (i.total_cents ?? 0), 0);
      const outputTaxCents = invoices.reduce((s, i) => s + (i.tax_cents ?? 0), 0);
      const taxableRevenueCents = totalRevenueCents - outputTaxCents;
      const totalExpensesCents = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);

      const startMonth = (input.quarter - 1) * 3 + 1;
      const monthlyMap: Record<number, { revenueCents: number; taxCents: number; invoiceCount: number; expensesCents: number }> = {};
      for (let m = startMonth; m < startMonth + 3; m++) {
        monthlyMap[m] = { revenueCents: 0, taxCents: 0, invoiceCount: 0, expensesCents: 0 };
      }
      for (const inv of invoices) {
        const m = sgtMonth(inv.created_at);
        if (monthlyMap[m]) {
          monthlyMap[m].revenueCents += inv.total_cents ?? 0;
          monthlyMap[m].taxCents += inv.tax_cents ?? 0;
          monthlyMap[m].invoiceCount += 1;
        }
      }
      for (const exp of expenses) {
        const m = sgtMonth(exp.created_at);
        if (monthlyMap[m]) {
          monthlyMap[m].expensesCents += exp.amount_cents ?? 0;
        }
      }

      return {
        totalRevenueCents,
        taxableRevenueCents,
        outputTaxCents,
        totalExpensesCents,
        invoiceCount: invoices.length,
        expenseCount: expenses.length,
        monthlyBreakdown: Object.entries(monthlyMap)
          .map(([month, stats]) => ({ month: Number(month), ...stats }))
          .sort((a, b) => a.month - b.month),
      };
    }),

  getTransactions: protectedProcedure
    .input(quarterInput)
    .query(async ({ ctx, input }) => {
      const { start, end } = quarterRange(input.year, input.quarter);

      const { data } = await ctx.supabase
        .from('invoices')
        .select('id, invoice_number, total_cents, tax_cents, subtotal_cents, status, created_at')
        .eq('provider_id', ctx.user.id)
        .in('status', ['paid_cash', 'paid_qr'])
        .gte('created_at', start)
        .lt('created_at', end)
        .order('created_at', { ascending: false })
        .limit(200);

      return data ?? [];
    }),
});
