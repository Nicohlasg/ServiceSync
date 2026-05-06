import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';
import { sanitizeHtml } from '../utils/sanitize';

export const jobsRouter = router({
  getDetail: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: booking, error: bookingErr } = await ctx.supabase
        .from('bookings')
        .select('id, status, service_type, scheduled_date, arrival_window_start, address, amount, client_id, clients(name, phone)')
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (bookingErr || !booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });

      const { data: photos } = await ctx.supabase
        .from('job_photos')
        .select('id, storage_path, photo_type, created_at')
        .eq('booking_id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .order('created_at', { ascending: true });

      const { data: checklist } = await ctx.supabase
        .from('job_checklist_items')
        .select('id, label, is_checked, sort_order')
        .eq('booking_id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .order('sort_order', { ascending: true });

      return {
        booking: booking as typeof booking,
        photos: (photos ?? []) as Array<{ id: string; storage_path: string; photo_type: string; created_at: string }>,
        checklist: (checklist ?? []) as Array<{ id: string; label: string; is_checked: boolean; sort_order: number }>,
      };
    }),

  completeJob: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  addPhoto: protectedProcedure
    .input(z.object({
      bookingId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
      photoType: z.enum(['before', 'after', 'other']),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: booking } = await ctx.supabase
        .from('bookings')
        .select('id')
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (!booking) throw new TRPCError({ code: 'FORBIDDEN', message: 'Job not found' });

      const { data, error } = await ctx.supabase
        .from('job_photos')
        .insert({
          booking_id: input.bookingId,
          provider_id: ctx.user.id,
          storage_path: input.storagePath,
          photo_type: input.photoType,
        })
        .select('id, storage_path, photo_type, created_at')
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  deletePhoto: protectedProcedure
    .input(z.object({ photoId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: photo } = await ctx.supabase
        .from('job_photos')
        .select('storage_path')
        .eq('id', input.photoId)
        .eq('provider_id', ctx.user.id)
        .single();
      if (!photo) throw new TRPCError({ code: 'NOT_FOUND', message: 'Photo not found' });

      await ctx.supabase.storage
        .from('job-photos')
        .remove([(photo as { storage_path: string }).storage_path]);

      const { error } = await ctx.supabase
        .from('job_photos')
        .delete()
        .eq('id', input.photoId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  addChecklistItem: protectedProcedure
    .input(z.object({
      bookingId: z.string().uuid(),
      label: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.supabase
        .from('job_checklist_items')
        .select('sort_order')
        .eq('booking_id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = ((existing as Array<{ sort_order: number }> | null)?.[0]?.sort_order ?? -1) + 1;

      const { data, error } = await ctx.supabase
        .from('job_checklist_items')
        .insert({
          booking_id: input.bookingId,
          provider_id: ctx.user.id,
          label: sanitizeHtml(input.label),
          is_checked: false,
          sort_order: nextOrder,
        })
        .select('id, label, is_checked, sort_order')
        .single();
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data;
    }),

  toggleChecklistItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid(), isChecked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('job_checklist_items')
        .update({ is_checked: input.isChecked })
        .eq('id', input.itemId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  deleteChecklistItem: protectedProcedure
    .input(z.object({ itemId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('job_checklist_items')
        .delete()
        .eq('id', input.itemId)
        .eq('provider_id', ctx.user.id);
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});
