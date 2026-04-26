/**
 * Invoice Management Router — ServiceSync CRM
 *
 * Full invoice lifecycle: create, PDF generation, bulk download,
 * and tax breakdown for IRAS compliance.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import { decryptField } from '@/server/services/crypto';
import { generateInvoiceMessage, generateWALink } from '@/server/services/whatsapp-simple';
import { sgMonthStart, sgNextMonthStart, sgYearStart } from '@/server/utils/time';
import { sanitizeSearchTerm } from '@/server/utils/sanitize';
import { emitAuditEvent } from '@/server/services/audit';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const listInvoicesInput = z.object({
  status: z.enum(['draft', 'pending', 'awaiting_qr_confirmation', 'paid_cash', 'paid_qr', 'disputed', 'void']).optional(),
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// SGD 100,000 hard cap per line / tax / deposit — guards against typos and overflow.
const MAX_INVOICE_CENTS = 10_000_000;

const createInvoiceInput = z.object({
  bookingId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1).max(500),
    amountCents: z.number().int().min(0).max(MAX_INVOICE_CENTS),
  })).min(1).max(50),
  taxCents: z.number().int().min(0).max(MAX_INVOICE_CENTS).default(0),
  depositAmountCents: z.number().int().min(0).max(MAX_INVOICE_CENTS).default(0),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(1000).optional(),
});

const generatePdfInput = z.object({
  invoiceId: z.string().uuid(),
});

const updateStatusInput = z.object({
  invoiceId: z.string().uuid(),
  status: z.enum(['draft', 'pending', 'awaiting_qr_confirmation', 'paid_cash', 'paid_qr', 'disputed', 'void']),
});

const downloadBulkInput = z.object({
  month: z.number().int().min(1).max(12).optional(),
  year: z.number().int().min(2020).max(2100),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const invoicesRouter = router({
  /**
   * Lists invoices with filters.
   */
  list: protectedProcedure
    .input(listInvoicesInput)
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('invoices')
        .select(`
          id, invoice_number, status, total_cents, amount, paid_at, created_at, due_date,
          booking_id, client_id,
          clients(id, name, phone)
        `, { count: 'exact' })
        .eq('provider_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.status) {
        query = query.eq('status', input.status);
      }

      if (input.year && input.month) {
        query = query
          .gte('created_at', sgMonthStart(input.year, input.month))
          .lt('created_at', sgNextMonthStart(input.year, input.month));
      } else if (input.year) {
        query = query
          .gte('created_at', sgYearStart(input.year))
          .lt('created_at', sgYearStart(input.year + 1));
      }

      if (input.search) {
        const sanitized = sanitizeSearchTerm(input.search);
        if (sanitized.length > 0) {
          query = query.or(`invoice_number.ilike.%${sanitized}%`);
        }
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[Invoices] DB error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred' });
      }

      return {
        invoices: data ?? [],
        total: count ?? 0,
        hasMore: (count ?? 0) > input.offset + input.limit,
      };
    }),

  /**
   * Gets a single invoice with full details.
   */
  getById: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: invoice, error } = await ctx.supabase
        .from('invoices')
        .select('*')
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (error || !invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Fetch related client and booking separately to avoid PostgREST join issues
      let client = null;
      let booking = null;

      if (invoice.client_id) {
        const { data } = await ctx.supabase
          .from('clients')
          .select('id, name, phone, email')
          .eq('id', invoice.client_id)
          .single();
        client = data;
      }

      if (invoice.booking_id) {
        const { data } = await ctx.supabase
          .from('bookings')
          .select('id, scheduled_date, status, amount, deposit_amount, deposit_paid, service_type, address, client_name')
          .eq('id', invoice.booking_id)
          .single();
        booking = data;
      }

      return { ...invoice, clients: client, bookings: booking };
    }),

  /**
   * Updates invoice status.
   */
  updateStatus: protectedProcedure
    .input(updateStatusInput)
    .mutation(async ({ ctx, input }) => {
      const now = new Date().toISOString();
      const isPaidStatus = input.status === 'paid_cash' || input.status === 'paid_qr';
      
      let paymentMethod = undefined;
      if (input.status === 'paid_cash') paymentMethod = 'cash';
      if (input.status === 'paid_qr') paymentMethod = 'paynow_qr';

      const { data, error } = await ctx.supabase
        .from('invoices')
        .update({
          status: input.status,
          paid_at: isPaidStatus ? now : null,
          ...(paymentMethod ? { payment_method: paymentMethod } : {}),
        })
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .select('id, status, paid_at')
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'invoice',
        entityId: input.invoiceId,
        action: 'status_change',
        diff: { status: input.status, paid_at: data.paid_at },
      });

      return data;
    }),

  /**
   * Deletes an invoice (only draft, pending, or void).
   */
  delete: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // First verify ownership and check status
      const { data: invoice, error: fetchError } = await ctx.supabase
        .from('invoices')
        .select('id, status')
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (fetchError || !invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      const deletableStatuses = ['draft', 'pending', 'void'];
      if (!deletableStatuses.includes(invoice.status)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot delete an invoice with status "${invoice.status}". Only draft, pending, or void invoices can be deleted.`,
        });
      }

      const { error: deleteError } = await ctx.supabase
        .from('invoices')
        .delete()
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id);

      if (deleteError) {
        console.error('[Invoices] Delete error:', deleteError.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete invoice' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'invoice',
        entityId: input.invoiceId,
        action: 'delete',
        diff: { previous_status: invoice.status },
      });

      return { success: true };
    }),

  /**
   * Updates the due date on an invoice.
   */
  updateDueDate: protectedProcedure
    .input(z.object({
      invoiceId: z.string().uuid(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD format'),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('invoices')
        .update({ due_date: input.dueDate })
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .select('id, due_date')
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      return data;
    }),

  /**
   * Builds a WhatsApp resend link for invoice delivery.
   */
  resend: protectedProcedure
    .input(z.object({ invoiceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Fetch invoice
      const { data: invoice, error } = await ctx.supabase
        .from('invoices')
        .select('id, invoice_number, total_cents, pdf_url, draft_pdf_url, client_id')
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (error || !invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Fetch client separately to avoid PostgREST join issues
      let client: { name: string; phone: string } | null = null;
      if (invoice.client_id) {
        const { data } = await ctx.supabase
          .from('clients')
          .select('name, phone')
          .eq('id', invoice.client_id)
          .single();
        client = data;
      }

      // Fetch provider name separately (same pattern as generatePdf)
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('name, slug')
        .eq('id', ctx.user.id)
        .single();

      const rawPhone = String(client?.phone ?? '').trim();

      if (!rawPhone) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Client phone is missing' });
      }

      const digits = rawPhone.replace(/\D/g, '');
      if (!digits) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Client phone is invalid' });
      }

      const normalizedPhone = rawPhone.startsWith('+')
        ? `+${digits}`
        : `+65${digits}`;

      // Use PDF URL if available, otherwise build a public-facing URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
      const providerSlug = profile?.slug ?? ctx.user.id;
      const invoiceUrl = invoice.pdf_url
        ?? invoice.draft_pdf_url
        ?? `${appUrl}/p/${providerSlug}`;

      const providerName = profile?.name ?? 'Your technician';

      const message = generateInvoiceMessage({
        clientName: client?.name ?? 'Client',
        invoiceUrl,
        amount: invoice.total_cents ?? 0,
        serviceType: 'Service',
        technicianName: providerName,
      });

      const waLink = generateWALink({
        phone: normalizedPhone,
        message,
      });

      return {
        waLink,
        invoiceNumber: invoice.invoice_number,
      };
    }),

  /**
   * Creates an invoice (optionally from a completed booking).
   */
  create: protectedProcedure
    .input(createInvoiceInput)
    .mutation(async ({ ctx, input }) => {
      const subtotalCents = input.lineItems.reduce((sum, item) => sum + item.amountCents, 0);
      const totalCents = subtotalCents + input.taxCents;

      // If booking provided, link and pull client info
      let clientId = input.clientId;
      if (input.bookingId && !clientId) {
        const { data: booking } = await ctx.supabase
          .from('bookings')
          .select('client_id')
          .eq('id', input.bookingId)
          .eq('provider_id', ctx.user.id)
          .single();

        if (booking?.client_id) {
          clientId = booking.client_id;
        }
      }

      const { data, error } = await ctx.supabase
        .from('invoices')
        .insert({
          provider_id: ctx.user.id,
          client_id: clientId,
          booking_id: input.bookingId,
          invoice_number: '', // Trigger will generate
          status: 'pending',
          line_items: input.lineItems,
          subtotal_cents: subtotalCents,
          tax_cents: input.taxCents,
          total_cents: totalCents,
          amount: totalCents,
          tax: input.taxCents,
          due_date: input.dueDate,
          notes: input.notes ?? '',
        })
        .select()
        .single();

      if (error) {
        console.error('[Invoices] DB error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'invoice',
        entityId: data.id,
        action: 'create',
        diff: { total_cents: totalCents, client_id: clientId, booking_id: input.bookingId ?? null },
      });

      return data;
    }),

  /**
   * Generates a PDF for an invoice and stores it in Supabase Storage.
   */
  generatePdf: protectedProcedure
    .input(generatePdfInput)
    .mutation(async ({ ctx, input }) => {
      // Fetch invoice + profile (separate queries to avoid PostgREST join issues)
      const { data: invoice, error } = await ctx.supabase
        .from('invoices')
        .select('*')
        .eq('id', input.invoiceId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (error || !invoice) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Invoice not found' });
      }

      // Fetch related records separately
      const { data: profile } = await ctx.supabase
        .from('profiles')
        .select('name, phone, acra_uen, acra_verified, gst_registered, paynow_key, paynow_key_type, base_address')
        .eq('id', ctx.user.id)
        .single();

      let client: any = null;
      if (invoice.client_id) {
        const { data } = await ctx.supabase.from('clients').select('name, phone').eq('id', invoice.client_id).single();
        client = data;
      }

      let booking: any = null;
      if (invoice.booking_id) {
        const { data } = await ctx.supabase.from('bookings').select('service_type, scheduled_date, deposit_amount, deposit_paid, address, client_name').eq('id', invoice.booking_id).single();
        booking = data;
      }

      const depositCents = booking?.deposit_paid ? (booking.deposit_amount ?? 0) : 0;
      const balanceDueCents = Math.max(0, invoice.total_cents - depositCents);
      const clientAddress = booking?.address ?? '';
      const normalizedLineItems = Array.isArray(invoice.line_items)
        ? (invoice.line_items as Array<{
            description?: unknown;
            amountCents?: unknown;
            amount_cents?: unknown;
          }>)
          .map((item) => ({
            description: typeof item?.description === 'string' && item.description.trim().length > 0
              ? item.description
              : 'Service',
            amountCents: Number(item?.amountCents ?? item?.amount_cents ?? 0),
          }))
          .filter((item) => Number.isFinite(item.amountCents) && item.amountCents >= 0)
        : [];

      if (normalizedLineItems.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invoice has no valid line items to render',
        });
      }

      // Generate PayNow QR if provider has a key
      let paynowQrDataUrl: string | undefined;
      if (profile?.paynow_key) {
        try {
          // HIGH-07: Decrypt paynow_key before use (encrypted at rest)
          const decryptedKey = decryptField(profile.paynow_key);
          const { generatePayNowQR } = await import('@/server/services/paynow-qr');
          const qrResult = await generatePayNowQR({
            paynowKey: decryptedKey,
            paynowKeyType: profile.paynow_key_type ?? 'mobile',
            amountCents: balanceDueCents,
            reference: invoice.invoice_number,
          });
          paynowQrDataUrl = qrResult.qrDataUrl;

          // Store QR payload on invoice
          await ctx.supabase
            .from('invoices')
            .update({
              paynow_ref: qrResult.payload,
              paynow_qr_url: qrResult.qrDataUrl,
            })
            .eq('id', input.invoiceId);
        } catch (err) {
          console.error('[Invoice] QR generation error:', err);
        }
      }

      // Generate PDF
      const { generateInvoicePdf } = await import('@/server/services/pdf');
      const pdfResult = await generateInvoicePdf({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        createdAt: invoice.created_at,
        providerId: ctx.user.id,
        providerName: profile?.name?.trim() || 'Provider',
        providerPhone: profile?.phone ?? '',
        providerAddress: profile?.base_address ?? '',
        providerAcraUen: profile?.acra_uen ?? undefined,
        providerAcraVerified: !!profile?.acra_verified,
        providerGstRegistered: !!profile?.gst_registered,
        clientName: client?.name?.trim() || booking?.client_name?.trim() || 'Client',
        clientPhone: client?.phone ?? '',
        clientAddress: clientAddress,
        serviceType: booking?.service_type ?? 'Service',
        serviceDate: booking?.scheduled_date ?? invoice.created_at,
        lineItems: normalizedLineItems,
        subtotalCents: invoice.subtotal_cents,
        taxCents: invoice.tax_cents,
        totalCents: invoice.total_cents,
        depositAmountCents: depositCents,
        balanceDueCents,
        paynowQrDataUrl,
        dueDate: invoice.due_date ?? undefined,
        notes: invoice.notes ?? undefined,
        status: invoice.status,
        paidAt: invoice.paid_at,
        paymentMethod: invoice.payment_method,
        renderBaseUrl: ctx.requestOrigin,
        isPro: !!profile?.acra_verified,
      });

      if (!pdfResult.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: pdfResult.error ?? 'PDF generation failed',
        });
      }

      // Update invoice with PDF URL
      await ctx.supabase
        .from('invoices')
        .update({ pdf_url: pdfResult.pdfUrl, draft_pdf_url: pdfResult.pdfUrl })
        .eq('id', input.invoiceId);

      return { pdfUrl: pdfResult.pdfUrl };
    }),

  /**
   * Downloads all invoices for a month as a ZIP file.
   */
  downloadMonthly: protectedProcedure
    .input(downloadBulkInput.extend({ month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const { downloadMonthlyInvoices } = await import('@/server/services/invoice-storage');
      const result = await downloadMonthlyInvoices(ctx.user.id, input.year, input.month);

      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error ?? 'No invoices found',
        });
      }

      // Return base64-encoded ZIP for client-side download
      return {
        zipBase64: result.zipBuffer!.toString('base64'),
        fileName: result.fileName!,
        fileCount: result.fileCount!,
      };
    }),

  /**
   * Downloads all invoices for a year as a ZIP file.
   */
  downloadYearly: protectedProcedure
    .input(downloadBulkInput)
    .mutation(async ({ ctx, input }) => {
      const { downloadYearlyInvoices } = await import('@/server/services/invoice-storage');
      const result = await downloadYearlyInvoices(ctx.user.id, input.year);

      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error ?? 'No invoices found',
        });
      }

      return {
        zipBase64: result.zipBuffer!.toString('base64'),
        fileName: result.fileName!,
        fileCount: result.fileCount!,
      };
    }),

  /**
   * Downloads all invoices as a ZIP file.
   */
  downloadAll: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { downloadAllInvoices } = await import('@/server/services/invoice-storage');
      const result = await downloadAllInvoices(ctx.user.id);

      if (!result.success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: result.error ?? 'No invoices found',
        });
      }

      return {
        zipBase64: result.zipBuffer!.toString('base64'),
        fileName: result.fileName!,
        fileCount: result.fileCount!,
      };
    }),

  /**
   * Gets monthly breakdown for tax filing.
   */
  getMonthlyBreakdown: protectedProcedure
    .input(z.object({ year: z.number().int().min(2020).max(2100) }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('invoices')
        .select('total_cents, tax_cents, status, paid_at, created_at')
        .eq('provider_id', ctx.user.id)
        .gte('created_at', `${input.year}-01-01`)
        .lt('created_at', `${input.year + 1}-01-01`)
        .in('status', ['paid_cash', 'paid_qr']);

      if (error) {
        console.error('[Invoices] DB error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred' });
      }

      // Group by month
      const months: Record<number, { revenue: number; tax: number; count: number }> = {};
      for (let m = 1; m <= 12; m++) {
        months[m] = { revenue: 0, tax: 0, count: 0 };
      }

      for (const inv of data ?? []) {
        // Use SGT timezone for correct month grouping
        const dateStr = new Date(inv.paid_at ?? inv.created_at).toLocaleDateString('en-US', { month: 'numeric', timeZone: 'Asia/Singapore' });
        const month = parseInt(dateStr, 10);
        months[month].revenue += inv.total_cents;
        months[month].tax += inv.tax_cents;
        months[month].count += 1;
      }

      const breakdown = Object.entries(months).map(([month, data]) => ({
        month: parseInt(month),
        revenueCents: data.revenue,
        taxCents: data.tax,
        invoiceCount: data.count,
      }));

      const totalRevenue = breakdown.reduce((s, m) => s + m.revenueCents, 0);
      const totalTax = breakdown.reduce((s, m) => s + m.taxCents, 0);
      const totalInvoices = breakdown.reduce((s, m) => s + m.invoiceCount, 0);

      return {
        year: input.year,
        months: breakdown,
        totals: {
          revenueCents: totalRevenue,
          taxCents: totalTax,
          invoiceCount: totalInvoices,
        },
      };
    }),

  /**
   * Gets yearly breakdown across multiple years.
   */
  getYearlyBreakdown: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('invoices')
        .select('total_cents, tax_cents, status, paid_at, created_at')
        .eq('provider_id', ctx.user.id)
        .in('status', ['paid_cash', 'paid_qr']);

      if (error) {
        console.error('[Invoices] DB error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'An internal error occurred' });
      }

      const years: Record<number, { revenue: number; tax: number; count: number }> = {};

      for (const inv of data ?? []) {
        const year = new Date(inv.paid_at ?? inv.created_at).getFullYear();
        if (!years[year]) {
          years[year] = { revenue: 0, tax: 0, count: 0 };
        }
        years[year].revenue += inv.total_cents;
        years[year].tax += inv.tax_cents;
        years[year].count += 1;
      }

      return Object.entries(years)
        .map(([year, data]) => ({
          year: parseInt(year),
          revenueCents: data.revenue,
          taxCents: data.tax,
          invoiceCount: data.count,
        }))
        .sort((a, b) => b.year - a.year);
    }),
});
