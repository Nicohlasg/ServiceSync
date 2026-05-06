/**
 * Client Management Router — ServiceSync CRM
 *
 * Full CRM for managing homeowner records, service history,
 * and equipment tracking for retention reminders.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

import { sanitizeHtml, sanitizeSearchTerm } from '../utils/sanitize';
import { emitAuditEvent } from '../services/audit';
import { markChecklistItemServerSide } from '../services/checklist';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const listClientsInput = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * Task 1.7: Normalise Singapore phone numbers to E.164 (+65XXXXXXXX).
 * Accepts: "91234567", "+6591234567", "6591234567", "9123 4567"
 */
function normaliseE164(raw: string): string {
  const digits = raw.replace(/[\s\-()]/g, '');
  // Already has +65 prefix
  if (/^\+65[89]\d{7}$/.test(digits)) return digits;
  // Has 65 prefix without +
  if (/^65[89]\d{7}$/.test(digits)) return `+${digits}`;
  // Bare 8-digit SG number
  if (/^[89]\d{7}$/.test(digits)) return `+65${digits}`;
  // Return as-is for non-SG numbers (validation below will catch invalid ones)
  return digits;
}

const createClientInput = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(8).transform(normaliseE164),
  email: z.string().email().optional(),
  address: z.string().min(1),
  unitNumber: z.string().max(20).optional(),
  postalCode: z.string().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  brand: z.string().optional(),
  notes: z.string().optional(),
});

const updateClientInput = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  phone: z.string().min(8).transform(normaliseE164).optional(),
  email: z.string().email().nullable().optional(),
  address: z.string().min(1).optional(),
  unitNumber: z.string().max(20).nullable().optional(),
  postalCode: z.string().nullable().optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  brand: z.string().optional(),
  notes: z.string().optional(),
});

const addAssetInput = z.object({
  clientId: z.string().uuid(),
  assetType: z.string().min(1),
  brand: z.string().optional(),
  model: z.string().optional(),
  locationInHome: z.string().optional(),
  installDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  serviceIntervalDays: z.number().int().min(1).default(90),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const clientsRouter = router({
  /**
   * Lists all clients with optional search.
   */
  list: protectedProcedure
    .input(listClientsInput)
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('clients')
        .select('*', { count: 'exact' })
        .eq('provider_id', ctx.user.id)
        .eq('is_deleted', false)
        .order('updated_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (input.search) {
        // Allowlist search terms: letters, digits, space, hyphen only.
        // Blocks PostgREST `or()` injection via `,` and SQL wildcards `%` / `_`.
        const sanitized = sanitizeSearchTerm(input.search);
        if (sanitized.length > 0) {
          query = query.or(
            `name.ilike.%${sanitized}%,phone.ilike.%${sanitized}%,address.ilike.%${sanitized}%`
          );
        }
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('[Clients] list error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch clients' });
      }

      return {
        clients: data ?? [],
        total: count ?? 0,
        hasMore: (count ?? 0) > input.offset + input.limit,
      };
    }),

  /**
   * Gets a single client with service history summary.
   */
  getById: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: client, error } = await ctx.supabase
        .from('clients')
        .select('*')
        .eq('id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .eq('is_deleted', false)
        .single();

      if (error || !client) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }

      // Fetch recent bookings
      const { data: bookings } = await ctx.supabase
        .from('bookings')
        .select('id, service_type, status, scheduled_date, amount, completed_at')
        .eq('client_id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .order('scheduled_date', { ascending: false })
        .limit(20);

      // Fetch invoices linked to this client
      const { data: invoices } = await ctx.supabase
        .from('invoices')
        .select('id, invoice_number, status, total_cents, amount, paid_at, payment_method, created_at')
        .eq('client_id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      // Fetch assets
      const { data: assets } = await ctx.supabase
        .from('client_assets')
        .select('*')
        .eq('client_id', input.clientId)
        .eq('provider_id', ctx.user.id);

      // Calculate totals from both bookings and invoices
      const allBookings = (bookings ?? []);
      const nonCancelledBookings = allBookings.filter(b => b.status !== 'cancelled');
      const completedBookings = allBookings.filter(b => b.status === 'completed');
      const paidInvoices = (invoices ?? []).filter(i => ['paid_cash', 'paid_qr'].includes(i.status));
      // Prefer invoice revenue (more accurate), fall back to booking amounts
      const totalRevenueCents = paidInvoices.length > 0
        ? paidInvoices.reduce((sum, i) => sum + (i.total_cents ?? i.amount ?? 0), 0)
        : completedBookings.reduce((sum, b) => sum + (b.amount ?? 0), 0);

      return {
        ...client,
        bookings: bookings ?? [],
        invoices: invoices ?? [],
        assets: assets ?? [],
        stats: {
          totalJobs: nonCancelledBookings.length,
          totalRevenueCents,
          lastServiceDate: completedBookings[0]?.completed_at ?? null,
        },
      };
    }),

  /**
   * Creates a new client.
   */
  create: protectedProcedure
    .input(createClientInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('clients')
        .insert({
          provider_id: ctx.user.id,
          name: sanitizeHtml(input.name),
          phone: sanitizeHtml(input.phone),
          email: sanitizeHtml(input.email),
          address: sanitizeHtml(input.address),
          unit_number: sanitizeHtml(input.unitNumber) ?? null,
          postal_code: sanitizeHtml(input.postalCode),
          lat: input.lat,
          lng: input.lng,
          brand: sanitizeHtml(input.brand) ?? '',
          notes: sanitizeHtml(input.notes) ?? '',
        })
        .select()
        .single();

      if (error) {
        console.error('[Clients] create error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create client' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'client',
        entityId: data.id,
        action: 'create',
        diff: { after: data },
      });

      // Onboarding checklist auto-mark (masterplan §6 P0 Task 7). Fire-and-forget.
      void markChecklistItemServerSide(ctx.supabase, ctx.user.id, 'client');

      return data;
    }),

  /**
   * Bulk-creates clients from contact import (Contact Picker or .vcf).
   * Deduplicates by phone against existing clients for this provider.
   * Max 100 contacts per call.
   */
  bulkCreate: protectedProcedure
    .input(z.object({
      contacts: z.array(z.object({
        name: z.string().min(1).max(100),
        phone: z.string().min(8).transform(normaliseE164),
        address: z.string().max(300).optional(),
        unitNumber: z.string().max(20).optional(),
        postalCode: z.string().max(10).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        notes: z.string().max(500).optional(),
      })).min(1).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      // Fetch existing phone numbers for deduplication
      const { data: existing } = await ctx.supabase
        .from('clients')
        .select('phone')
        .eq('provider_id', ctx.user.id)
        .eq('is_deleted', false);

      const existingPhones = new Set((existing ?? []).map((c: { phone: string }) => c.phone));

      const toInsert = input.contacts
        .filter(c => !existingPhones.has(c.phone))
        // Deduplicate within the batch itself
        .filter((c, i, arr) => arr.findIndex(x => x.phone === c.phone) === i)
        .map(c => ({
          provider_id: ctx.user.id,
          name: sanitizeHtml(c.name),
          phone: sanitizeHtml(c.phone),
          address: c.address ? sanitizeHtml(c.address) : '',
          unit_number: c.unitNumber ? sanitizeHtml(c.unitNumber) : null,
          postal_code: c.postalCode ? sanitizeHtml(c.postalCode) : null,
          lat: c.lat ?? null,
          lng: c.lng ?? null,
          brand: '',
          notes: c.notes ? sanitizeHtml(c.notes) : '',
        }));

      let created = 0;
      if (toInsert.length > 0) {
        const { data, error } = await ctx.supabase
          .from('clients')
          .insert(toInsert)
          .select('id');

        if (error) {
          console.error('[Clients] bulkCreate error:', error.message);
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to import contacts' });
        }

        created = data?.length ?? 0;
      }

      const skipped = input.contacts.length - created;

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'client',
        entityId: ctx.user.id,
        action: 'create',
        diff: { created, skipped, total: input.contacts.length },
      });

      // Fire-and-forget checklist mark
      if (created > 0) {
        void markChecklistItemServerSide(ctx.supabase, ctx.user.id, 'client');
      }

      return { created, skipped };
    }),

  /**
   * Updates a client's information.
   */
  update: protectedProcedure
    .input(updateClientInput)
    .mutation(async ({ ctx, input }) => {
      const { clientId, ...fields } = input;
      const updateData: Record<string, unknown> = {};

      if (fields.name !== undefined) updateData.name = sanitizeHtml(fields.name);
      if (fields.phone !== undefined) updateData.phone = sanitizeHtml(fields.phone);
      if (fields.email !== undefined) updateData.email = sanitizeHtml(fields.email);
      if (fields.address !== undefined) updateData.address = sanitizeHtml(fields.address);
      if (fields.unitNumber !== undefined) updateData.unit_number = sanitizeHtml(fields.unitNumber);
      if (fields.postalCode !== undefined) updateData.postal_code = sanitizeHtml(fields.postalCode);
      if (fields.lat !== undefined) updateData.lat = fields.lat;
      if (fields.lng !== undefined) updateData.lng = fields.lng;
      if (fields.brand !== undefined) updateData.brand = sanitizeHtml(fields.brand);
      if (fields.notes !== undefined) updateData.notes = sanitizeHtml(fields.notes);

      const { data, error } = await ctx.supabase
        .from('clients')
        .update(updateData)
        .eq('id', clientId)
        .eq('provider_id', ctx.user.id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'client',
        entityId: clientId,
        action: 'update',
        diff: { changes: updateData },
      });

      return data;
    }),

  /**
   * Soft-deletes a client.
   */
  delete: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('clients')
        .update({ is_deleted: true })
        .eq('id', input.clientId)
        .eq('provider_id', ctx.user.id);

      if (error) {
        console.error('[Clients] delete error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete client' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'client',
        entityId: input.clientId,
        action: 'delete',
      });

      return { success: true };
    }),

  /**
   * Soft-deletes multiple clients in one call.
   */
  bulkDelete: protectedProcedure
    .input(z.object({ clientIds: z.array(z.string().uuid()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('clients')
        .update({ is_deleted: true })
        .in('id', input.clientIds)
        .eq('provider_id', ctx.user.id);

      if (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      }

      return { deleted: input.clientIds.length };
    }),

  /**
   * Smart client matching: finds an existing client by phone (primary)
   * or address + unit_number (fallback). Used during job creation to
   * auto-link bookings from public forms or contact imports.
   */
  findMatch: protectedProcedure
    .input(z.object({
      phone: z.string().min(8).transform(normaliseE164).optional(),
      address: z.string().optional(),
      unitNumber: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      // Primary: match by normalised phone number
      if (input.phone) {
        const { data } = await ctx.supabase
          .from('clients')
          .select('id, name, phone, address, unit_number')
          .eq('provider_id', ctx.user.id)
          .eq('is_deleted', false)
          .eq('phone', input.phone)
          .limit(1)
          .maybeSingle();

        if (data) return { match: data, matchedBy: 'phone' as const };
      }

      // Fallback: match by address + unit_number (both must be present)
      if (input.address && input.unitNumber) {
        const { data } = await ctx.supabase
          .from('clients')
          .select('id, name, phone, address, unit_number')
          .eq('provider_id', ctx.user.id)
          .eq('is_deleted', false)
          .ilike('address', `%${input.address.replace(/%/g, '')}%`)
          .eq('unit_number', input.unitNumber)
          .limit(1)
          .maybeSingle();

        if (data) return { match: data, matchedBy: 'address_unit' as const };
      }

      return { match: null, matchedBy: null };
    }),

  /**
   * Gets full service history for a client.
   */
  getServiceHistory: protectedProcedure
    .input(z.object({
      clientId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { data, error, count } = await ctx.supabase
        .from('bookings')
        .select('*', { count: 'exact' })
        .eq('client_id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .order('scheduled_date', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        console.error('[Clients] getServiceHistory error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch service history' });
      }

      return {
        history: data ?? [],
        total: count ?? 0,
      };
    }),

  /**
   * Gets equipment/assets tracked for a client.
   */
  getAssets: protectedProcedure
    .input(z.object({ clientId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('client_assets')
        .select('*')
        .eq('client_id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .order('created_at');

      if (error) {
        console.error('[Clients] getAssets error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch assets' });
      }

      return data ?? [];
    }),

  /**
   * Adds an asset/equipment entry for a client.
   */
  addAsset: protectedProcedure
    .input(addAssetInput)
    .mutation(async ({ ctx, input }) => {
      // Verify client belongs to this provider
      const { data: client } = await ctx.supabase
        .from('clients')
        .select('id')
        .eq('id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (!client) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Client not found' });
      }

      const { data, error } = await ctx.supabase
        .from('client_assets')
        .insert({
          client_id: input.clientId,
          provider_id: ctx.user.id,
          asset_type: sanitizeHtml(input.assetType),
          brand: sanitizeHtml(input.brand),
          model: sanitizeHtml(input.model),
          location_in_home: sanitizeHtml(input.locationInHome),
          install_date: input.installDate,
          service_interval_days: input.serviceIntervalDays,
          notes: sanitizeHtml(input.notes) ?? '',
        })
        .select()
        .single();

      if (error) {
        console.error('[Clients] addAsset error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add asset' });
      }

      return data;
    }),

  /**
   * Returns clients with overdue or upcoming service dates for retention follow-ups.
   * Queries client_assets where next_service_date <= now + lookaheadDays.
   */
  getRetentionQueue: protectedProcedure
    .input(z.object({
      lookaheadDays: z.number().int().min(0).max(90).default(14),
      limit: z.number().int().min(1).max(100).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + input.lookaheadDays);

      const { data, error } = await ctx.supabase
        .from('client_assets')
        .select(`
          id, asset_type, brand, model, location_in_home,
          last_service_date, next_service_date, service_interval_days,
          clients(id, name, phone, address)
        `)
        .eq('provider_id', ctx.user.id)
        .not('next_service_date', 'is', null)
        .lte('next_service_date', cutoff.toISOString())
        .order('next_service_date', { ascending: true })
        .limit(input.limit);

      if (error) {
        console.error('[Clients] getRetentionQueue error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch retention queue' });
      }

      return (data ?? []).map((row: any) => {
        const client = row.clients ?? {};
        const lastDate = row.last_service_date ? new Date(row.last_service_date) : null;
        const monthsPassed = lastDate
          ? Math.round((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
          : 0;

        return {
          assetId: row.id,
          clientId: client.id,
          clientName: client.name ?? 'Unknown',
          clientPhone: client.phone ?? '',
          address: client.address ?? '',
          assetType: row.asset_type,
          brand: row.brand,
          model: row.model,
          locationInHome: row.location_in_home,
          lastServiceDate: row.last_service_date,
          nextServiceDate: row.next_service_date,
          serviceIntervalDays: row.service_interval_days,
          monthsPassed,
          isOverdue: row.next_service_date ? new Date(row.next_service_date) <= new Date() : false,
        };
      });
    }),
});
