import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { sanitizeHtml } from '../utils/sanitize';

const categoryEnum = z.enum(['refrigerant', 'chemical', 'filter', 'part', 'tool', 'consumable', 'other']);

export const inventoryRouter = router({
  /** Create a new inventory item */
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      category: categoryEnum,
      unit: z.string().min(1).max(20),
      quantityOnHand: z.number().min(0),
      minQuantity: z.number().min(0),
      maxQuantity: z.number().min(0).optional(),
      unitCostCents: z.number().int().min(0),
      supplierName: z.string().max(100).optional(),
      supplierContact: z.string().max(50).optional(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('inventory_items')
        .insert({
          provider_id: ctx.user.id,
          name: sanitizeHtml(input.name),
          category: input.category,
          unit: input.unit,
          quantity_on_hand: input.quantityOnHand,
          min_quantity: input.minQuantity,
          max_quantity: input.maxQuantity ?? null,
          unit_cost_cents: input.unitCostCents,
          supplier_name: input.supplierName ?? null,
          supplier_contact: input.supplierContact ?? null,
          notes: input.notes ?? null,
        })
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  /** List active inventory items, optionally filtered by category or low-stock only */
  list: protectedProcedure
    .input(z.object({
      includeArchived: z.boolean().optional(),
      category: categoryEnum.optional(),
      lowStockOnly: z.boolean().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('inventory_items')
        .select('*')
        .eq('provider_id', ctx.user.id)
        .order('name');

      if (!input?.includeArchived) query = query.eq('status', 'active');
      if (input?.category) query = query.eq('category', input.category);

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      const items = data ?? [];
      if (input?.lowStockOnly) {
        return items.filter(i => Number(i.min_quantity) > 0 && Number(i.quantity_on_hand) <= Number(i.min_quantity));
      }
      return items;
    }),

  /** Get a single item with its last 50 transactions */
  getById: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [itemRes, txRes] = await Promise.all([
        ctx.supabase
          .from('inventory_items')
          .select('*')
          .eq('id', input.itemId)
          .eq('provider_id', ctx.user.id)
          .single(),
        ctx.supabase
          .from('inventory_transactions')
          .select('*')
          .eq('item_id', input.itemId)
          .eq('provider_id', ctx.user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (itemRes.error) throw new TRPCError({ code: 'NOT_FOUND', message: itemRes.error.message });
      return { item: itemRes.data, transactions: txRes.data ?? [] };
    }),

  /** Update item metadata (not quantity — use stockIn/stockOut/adjust for that) */
  update: protectedProcedure
    .input(z.object({
      itemId: z.string().uuid(),
      name: z.string().min(1).max(100).optional(),
      category: categoryEnum.optional(),
      unit: z.string().min(1).max(20).optional(),
      minQuantity: z.number().min(0).optional(),
      maxQuantity: z.number().min(0).nullable().optional(),
      unitCostCents: z.number().int().min(0).optional(),
      supplierName: z.string().max(100).optional(),
      supplierContact: z.string().max(50).optional(),
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { itemId, ...rest } = input;
      const patch: Record<string, unknown> = {};
      if (rest.name !== undefined) patch.name = sanitizeHtml(rest.name);
      if (rest.category !== undefined) patch.category = rest.category;
      if (rest.unit !== undefined) patch.unit = rest.unit;
      if (rest.minQuantity !== undefined) patch.min_quantity = rest.minQuantity;
      if (rest.maxQuantity !== undefined) patch.max_quantity = rest.maxQuantity;
      if (rest.unitCostCents !== undefined) patch.unit_cost_cents = rest.unitCostCents;
      if (rest.supplierName !== undefined) patch.supplier_name = rest.supplierName;
      if (rest.supplierContact !== undefined) patch.supplier_contact = rest.supplierContact;
      if (rest.notes !== undefined) patch.notes = rest.notes;

      const { data, error } = await ctx.supabase
        .from('inventory_items')
        .update(patch)
        .eq('id', itemId)
        .eq('provider_id', ctx.user.id)
        .select()
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  /** Soft-delete (archive) or restore an item */
  archive: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), archived: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('inventory_items')
        .update({ status: input.archived ? 'archived' : 'active' })
        .eq('id', input.itemId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    }),

  /** Record receiving stock (purchase / restock) */
  stockIn: protectedProcedure
    .input(z.object({
      itemId: z.string().uuid(),
      quantity: z.number().positive(),
      unitCostCents: z.number().int().min(0).optional(),
      notes: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: item, error: fetchErr } = await ctx.supabase
        .from('inventory_items')
        .select('quantity_on_hand, unit_cost_cents')
        .eq('id', input.itemId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (fetchErr || !item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found' });

      const newQty = Number(item.quantity_on_hand) + input.quantity;
      const costToRecord = input.unitCostCents ?? (item.unit_cost_cents as number);

      const [txErr, updateErr] = await Promise.all([
        ctx.supabase.from('inventory_transactions').insert({
          provider_id: ctx.user.id,
          item_id: input.itemId,
          type: 'stock_in',
          quantity: input.quantity,
          unit_cost_cents: costToRecord,
          notes: input.notes ?? null,
        }).then(r => r.error),
        ctx.supabase.from('inventory_items').update({
          quantity_on_hand: newQty,
          ...(input.unitCostCents !== undefined ? { unit_cost_cents: input.unitCostCents } : {}),
        }).eq('id', input.itemId).eq('provider_id', ctx.user.id).then(r => r.error),
      ]);
      if (txErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: txErr.message });
      if (updateErr) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: updateErr.message });
      return { newQuantity: newQty };
    }),

  /**
   * Record stock consumed (on a job or general use).
   * If createExpense=true and bookingId is set, auto-inserts an expense record.
   */
  stockOut: protectedProcedure
    .input(z.object({
      itemId: z.string().uuid(),
      quantity: z.number().positive(),
      bookingId: z.string().uuid().optional(),
      createExpense: z.boolean().optional(),
      notes: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: item, error: fetchErr } = await ctx.supabase
        .from('inventory_items')
        .select('quantity_on_hand, unit_cost_cents, name, unit')
        .eq('id', input.itemId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (fetchErr || !item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found' });

      const currentQty = Number(item.quantity_on_hand);
      if (currentQty < input.quantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Not enough stock — have ${currentQty} ${item.unit}, need ${input.quantity}`,
        });
      }

      const newQty = Math.round((currentQty - input.quantity) * 100) / 100;
      const totalCostCents = Math.round(input.quantity * (item.unit_cost_cents as number));

      await Promise.all([
        ctx.supabase.from('inventory_transactions').insert({
          provider_id: ctx.user.id,
          item_id: input.itemId,
          type: 'stock_out',
          quantity: -input.quantity,
          booking_id: input.bookingId ?? null,
          unit_cost_cents: item.unit_cost_cents,
          notes: input.notes ?? null,
        }).then(r => r),
        ctx.supabase.from('inventory_items')
          .update({ quantity_on_hand: newQty })
          .eq('id', input.itemId)
          .eq('provider_id', ctx.user.id)
          .then(r => r),
        ...(input.createExpense && input.bookingId && totalCostCents > 0
          ? [ctx.supabase.from('expenses').insert({
              provider_id: ctx.user.id,
              booking_id: input.bookingId,
              label: `${item.name} × ${input.quantity} ${item.unit}`,
              amount_cents: totalCostCents,
              category: 'parts',
            }).then(r => r)]
          : []),
      ]);
      return { newQuantity: newQty, costCents: totalCostCents };
    }),

  /** Manual stock count reconciliation — corrects quantity_on_hand to actual count */
  adjust: protectedProcedure
    .input(z.object({
      itemId: z.string().uuid(),
      newQuantity: z.number().min(0),
      notes: z.string().max(300).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: item, error: fetchErr } = await ctx.supabase
        .from('inventory_items')
        .select('quantity_on_hand, unit_cost_cents')
        .eq('id', input.itemId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (fetchErr || !item) throw new TRPCError({ code: 'NOT_FOUND', message: 'Item not found' });

      const diff = input.newQuantity - Number(item.quantity_on_hand);

      await Promise.all([
        ctx.supabase.from('inventory_transactions').insert({
          provider_id: ctx.user.id,
          item_id: input.itemId,
          type: 'adjustment',
          quantity: diff,
          unit_cost_cents: item.unit_cost_cents,
          notes: input.notes ?? 'Manual stock count',
        }).then(r => r),
        ctx.supabase.from('inventory_items')
          .update({ quantity_on_hand: input.newQuantity })
          .eq('id', input.itemId)
          .eq('provider_id', ctx.user.id)
          .then(r => r),
      ]);
      return { newQuantity: input.newQuantity };
    }),

  /** Items that have fallen at or below their min_quantity (reorder alert list) */
  getLowStock: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('inventory_items')
        .select('*')
        .eq('provider_id', ctx.user.id)
        .eq('status', 'active');
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return (data ?? []).filter(
        i => Number(i.min_quantity) > 0 && Number(i.quantity_on_hand) <= Number(i.min_quantity)
      );
    }),

  /**
   * Usage stats: top 10 most-consumed items in the last N days.
   * Groups stock_out transactions by item, returning qty used, cost, and occurrence count.
   */
  getUsageStats: protectedProcedure
    .input(z.object({ days: z.number().int().min(7).max(365).default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date();
      since.setDate(since.getDate() - input.days);

      const { data: txns, error } = await ctx.supabase
        .from('inventory_transactions')
        .select('item_id, quantity, unit_cost_cents, inventory_items(name, category, unit)')
        .eq('provider_id', ctx.user.id)
        .eq('type', 'stock_out')
        .gte('created_at', since.toISOString());
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

      const statsMap = new Map<string, {
        name: string; category: string; unit: string;
        totalQty: number; totalCostCents: number; occurrences: number;
      }>();

      for (const t of txns ?? []) {
        const key = t.item_id as string;
        const inv = t.inventory_items as unknown as { name: string; category: string; unit: string } | null;
        if (!statsMap.has(key)) {
          statsMap.set(key, {
            name: inv?.name ?? '',
            category: inv?.category ?? '',
            unit: inv?.unit ?? '',
            totalQty: 0,
            totalCostCents: 0,
            occurrences: 0,
          });
        }
        const s = statsMap.get(key)!;
        s.totalQty += Math.abs(Number(t.quantity));
        s.totalCostCents += Math.abs(Number(t.quantity)) * ((t.unit_cost_cents as number) ?? 0);
        s.occurrences += 1;
      }

      return Array.from(statsMap.entries())
        .map(([itemId, s]) => ({ itemId, ...s }))
        .sort((a, b) => b.totalQty - a.totalQty)
        .slice(0, 10);
    }),

  /** All stock_out transactions linked to a specific booking (for job detail page) */
  transactionsForBooking: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('inventory_transactions')
        .select('*, inventory_items(name, unit, category)')
        .eq('provider_id', ctx.user.id)
        .eq('booking_id', input.bookingId)
        .eq('type', 'stock_out')
        .order('created_at', { ascending: false });
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),
});
