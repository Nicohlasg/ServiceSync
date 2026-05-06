import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { sanitizeHtml } from '../utils/sanitize';

const MAX_QUOTE_CENTS = 10_000_000;

const lineItemSchema = z.object({
  description: z.string().min(1).max(500),
  amountCents: z.number().int().min(0).max(MAX_QUOTE_CENTS),
});

export const quotesRouter = router({
  create: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid().optional(),
      bookingId: z.string().uuid().optional(),
      lineItems: z.array(lineItemSchema).min(1).max(50),
      taxCents: z.number().int().min(0).max(MAX_QUOTE_CENTS).default(0),
      notes: z.string().max(1000).default(''),
      validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Generate quote number
      const { count } = await ctx.supabase
        .from('quotes')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', ctx.user.id);
      const quoteNumber = `Q-${String((count ?? 0) + 1).padStart(4, '0')}`;

      const subtotal = input.lineItems.reduce((s, i) => s + i.amountCents, 0);
      const total = subtotal + input.taxCents;

      const { data, error } = await ctx.supabase
        .from('quotes')
        .insert({
          provider_id: ctx.user.id,
          client_id: input.clientId ?? null,
          booking_id: input.bookingId ?? null,
          quote_number: quoteNumber,
          line_items: input.lineItems,
          subtotal_cents: subtotal,
          tax_cents: input.taxCents,
          total_cents: total,
          notes: sanitizeHtml(input.notes),
          valid_until: input.validUntil ?? null,
          status: 'draft',
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  list: protectedProcedure
    .input(z.object({
      status: z.enum(['draft', 'sent', 'accepted', 'declined']).optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('quotes')
        .select('id, quote_number, status, total_cents, valid_until, created_at, clients(id, name, phone)')
        .eq('provider_id', ctx.user.id)
        .order('created_at', { ascending: false });
      if (input.status) query = query.eq('status', input.status);
      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  getById: protectedProcedure
    .input(z.object({ quoteId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('quotes')
        .select('*, clients(id, name, phone)')
        .eq('id', input.quoteId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (error || !data) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
      return data;
    }),

  updateStatus: protectedProcedure
    .input(z.object({
      quoteId: z.string().uuid(),
      status: z.enum(['draft', 'sent', 'accepted', 'declined']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('quotes')
        .update({ status: input.status })
        .eq('id', input.quoteId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  convertToInvoice: protectedProcedure
    .input(z.object({ quoteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: quote, error: fetchErr } = await ctx.supabase
        .from('quotes')
        .select('*')
        .eq('id', input.quoteId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (fetchErr || !quote) throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });

      const q = quote as {
        client_id: string | null;
        booking_id: string | null;
        line_items: Array<{ description: string; amountCents: number }>;
        subtotal_cents: number;
        tax_cents: number;
        total_cents: number;
        notes: string;
      };

      const { data: invoice, error: invErr } = await ctx.supabase
        .from('invoices')
        .insert({
          provider_id: ctx.user.id,
          client_id: q.client_id,
          booking_id: q.booking_id,
          invoice_number: '',
          status: 'pending',
          line_items: q.line_items,
          subtotal_cents: q.subtotal_cents,
          tax_cents: q.tax_cents,
          total_cents: q.total_cents,
          amount: q.total_cents,
          tax: q.tax_cents,
          notes: q.notes,
        })
        .select('id')
        .single();
      if (invErr || !invoice) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: invErr?.message ?? 'Failed to create invoice' });

      await ctx.supabase
        .from('quotes')
        .update({ status: 'accepted' })
        .eq('id', input.quoteId)
        .eq('provider_id', ctx.user.id);

      return { invoiceId: (invoice as { id: string }).id };
    }),

  delete: protectedProcedure
    .input(z.object({ quoteId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('quotes')
        .delete()
        .eq('id', input.quoteId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
