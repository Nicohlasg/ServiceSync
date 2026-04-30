/**
 * Schedule Management Router — ServiceSync
 *
 * Manages technician working hours, blocked days/times,
 * and the auto-scheduled lunch break.
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const workingHoursSchema = z.object({
  mon: z.object({ start: z.string(), end: z.string() }).nullable(),
  tue: z.object({ start: z.string(), end: z.string() }).nullable(),
  wed: z.object({ start: z.string(), end: z.string() }).nullable(),
  thu: z.object({ start: z.string(), end: z.string() }).nullable(),
  fri: z.object({ start: z.string(), end: z.string() }).nullable(),
  sat: z.object({ start: z.string(), end: z.string() }).nullable(),
  sun: z.object({ start: z.string(), end: z.string() }).nullable(),
});

const addBlockInput = z.object({
  blockType: z.enum(['recurring', 'one_off', 'lunch']),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  blockDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  label: z.string().optional(),
});

const moveLunchInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

// SEC-H6: Provider-side job management inputs
const createJobInput = z.object({
  clientId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrivalWindowStart: z.string().datetime(),
  serviceType: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  lat: z.number().optional(),
  lng: z.number().optional(),
  // Duration is required so availability checks and invoicing work correctly
  estimatedDurationMinutes: z.number().int().min(15).max(480).default(60),
});

const updateJobInput = z.object({
  bookingId: z.string().uuid(),
  clientId: z.string().uuid(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrivalWindowStart: z.string().datetime(),
  serviceType: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  lat: z.number().optional(),
  lng: z.number().optional(),
  estimatedDurationMinutes: z.number().int().min(15).max(480).optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const scheduleRouter = router({
  /**
   * Gets the technician's default working hours.
   */
  getWorkingHours: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('working_hours')
        .eq('id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      return data.working_hours;
    }),

  /**
   * Updates the technician's default working hours.
   */
  updateWorkingHours: protectedProcedure
    .input(workingHoursSchema)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({ working_hours: input })
        .eq('id', ctx.user.id)
        .select('working_hours')
        .single();

      if (error) {
        console.error('[Schedule] updateWorkingHours error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update working hours' });
      }

      return data?.working_hours;
    }),

  /**
   * Adds a schedule block (recurring, one-off, or lunch).
   */
  addBlock: protectedProcedure
    .input(addBlockInput)
    .mutation(async ({ ctx, input }) => {
      // Validate based on block type
      if (input.blockType === 'recurring' && input.dayOfWeek === undefined) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'dayOfWeek is required for recurring blocks',
        });
      }
      if (input.blockType === 'one_off' && !input.blockDate) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'blockDate is required for one-off blocks',
        });
      }
      if ((input.blockType === 'lunch' || input.blockType === 'recurring') && (!input.startTime || !input.endTime)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'startTime and endTime are required for lunch and recurring blocks',
        });
      }

      const { data, error } = await ctx.supabase
        .from('schedule_blocks')
        .insert({
          provider_id: ctx.user.id,
          block_type: input.blockType,
          day_of_week: input.dayOfWeek,
          block_date: input.blockDate,
          start_time: input.startTime,
          end_time: input.endTime,
          label: input.label ?? '',
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[Schedule] addBlock error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add schedule block' });
      }

      return data;
    }),

  /**
   * Removes a schedule block.
   */
  removeBlock: protectedProcedure
    .input(z.object({ blockId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('schedule_blocks')
        .update({ is_active: false })
        .eq('id', input.blockId)
        .eq('provider_id', ctx.user.id);

      if (error) {
        console.error('[Schedule] removeBlock error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to remove schedule block' });
      }

      return { success: true };
    }),

  /**
   * Lists all active schedule blocks for the technician.
   */
  getBlocks: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('schedule_blocks')
        .select('*')
        .eq('provider_id', ctx.user.id)
        .eq('is_active', true)
        .order('block_type')
        .order('day_of_week')
        .order('start_time');

      if (error) {
        console.error('[Schedule] getBlocks error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch schedule blocks' });
      }

      return data ?? [];
    }),

  /**
   * Moves the auto-scheduled lunch break for a specific date.
   * Creates a one-off lunch block that overrides the default 12-1PM.
   */
  moveLunchBreak: protectedProcedure
    .input(moveLunchInput)
    .mutation(async ({ ctx, input }) => {
      // Deactivate any existing lunch block for this date
      await ctx.supabase
        .from('schedule_blocks')
        .update({ is_active: false })
        .eq('provider_id', ctx.user.id)
        .eq('block_type', 'lunch')
        .eq('block_date', input.date);

      // Create new lunch block
      const { data, error } = await ctx.supabase
        .from('schedule_blocks')
        .insert({
          provider_id: ctx.user.id,
          block_type: 'lunch',
          block_date: input.date,
          start_time: input.startTime,
          end_time: input.endTime,
          label: 'Lunch break',
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        console.error('[Schedule] moveLunchBreak error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to move lunch break' });
      }

      return data;
    }),

  /**
   * Initializes default lunch blocks for a technician (12:00-13:00 Mon-Fri).
   * Called once during profile setup.
   */
  initDefaultLunch: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Check if lunch blocks already exist
      const { data: existing } = await ctx.supabase
        .from('schedule_blocks')
        .select('id')
        .eq('provider_id', ctx.user.id)
        .eq('block_type', 'lunch')
        .eq('is_active', true)
        .limit(1);

      if (existing?.length) {
        return { message: 'Lunch blocks already configured' };
      }

      // Create recurring lunch blocks Mon-Fri (days 1-5)
      const lunchBlocks = [1, 2, 3, 4, 5].map(day => ({
        provider_id: ctx.user.id,
        block_type: 'lunch' as const,
        day_of_week: day,
        start_time: '12:00',
        end_time: '13:00',
        label: 'Lunch break',
        is_active: true,
      }));

      const { error } = await ctx.supabase
        .from('schedule_blocks')
        .insert(lunchBlocks);

      if (error) {
        console.error('[Schedule] initDefaultLunch error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to initialize lunch blocks' });
      }

      return { message: 'Default lunch blocks created (Mon-Fri 12:00-13:00)' };
    }),

  // -------------------------------------------------------------------------
  // SEC-H6: Provider-side job CRUD (migrated from direct Supabase on client)
  // -------------------------------------------------------------------------

  /**
   * Creates a job (booking) from the provider's schedule page.
   */
  createJob: protectedProcedure
    .input(createJobInput)
    .mutation(async ({ ctx, input }) => {
      // Verify client belongs to this provider and fetch name for denormalisation
      const { data: client } = await ctx.supabase
        .from('clients')
        .select('id, name')
        .eq('id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (!client) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid client' });
      }

      // BUG-01 fix: Provider-created jobs are auto-accepted — inserting as 'pending'
      // caused them to be filtered out of the schedule and Today's Route view which
      // both use .neq('status', 'pending').
      //
      // BUG-07 fix: estimated_duration_minutes is now stored so availability
      // checks and invoice duration tracking work correctly.
      const estimatedCompletion = new Date(
        new Date(input.arrivalWindowStart).getTime() +
          input.estimatedDurationMinutes * 60_000,
      ).toISOString();

      const { data, error } = await ctx.supabase
        .from('bookings')
        .insert({
          provider_id: ctx.user.id,
          client_id: input.clientId,
          // BUG-03 fix: denormalise client_name so the schedule/dashboard
          // display doesn't fall back to 'Unknown Client'.
          client_name: client.name,
          // BUG-01/02 fix: 'accepted' not 'pending'
          status: 'accepted',
          scheduled_date: input.scheduledDate,
          arrival_window_start: input.arrivalWindowStart,
          service_type: input.serviceType,
          address: input.address,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          estimated_duration_minutes: input.estimatedDurationMinutes,
          estimated_completion: estimatedCompletion,
        })
        .select()
        .single();

      if (error) {
        console.error('[Schedule] createJob error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create job' });
      }

      return data;
    }),

  /**
   * Updates an existing job owned by this provider.
   */
  updateJob: protectedProcedure
    .input(updateJobInput)
    .mutation(async ({ ctx, input }) => {
      // BUG-08 fix: fetch updated client's name so it's written to client_name.
      // Without this, reassigning a job leaves the old name displayed.
      const { data: client } = await ctx.supabase
        .from('clients')
        .select('id, name')
        .eq('id', input.clientId)
        .eq('provider_id', ctx.user.id)
        .single();

      if (!client) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid client' });
      }

      const updatePayload: Record<string, unknown> = {
        client_id: input.clientId,
        client_name: client.name,
        scheduled_date: input.scheduledDate,
        arrival_window_start: input.arrivalWindowStart,
        service_type: input.serviceType,
        address: input.address,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        updated_at: new Date().toISOString(),
      };

      if (input.estimatedDurationMinutes !== undefined) {
        updatePayload.estimated_duration_minutes = input.estimatedDurationMinutes;
        updatePayload.estimated_completion = new Date(
          new Date(input.arrivalWindowStart).getTime() +
            input.estimatedDurationMinutes * 60_000,
        ).toISOString();
      }

      const { data, error } = await ctx.supabase
        .from('bookings')
        .update(updatePayload)
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id)
        .select()
        .single();

      if (error) {
        console.error('[Schedule] updateJob error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update job' });
      }

      return data;
    }),

  /**
   * Deletes a job owned by this provider.
   */
  deleteJob: protectedProcedure
    .input(z.object({ bookingId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('bookings')
        .delete()
        .eq('id', input.bookingId)
        .eq('provider_id', ctx.user.id);

      if (error) {
        console.error('[Schedule] deleteJob error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete job' });
      }

      return { success: true };
    }),
});
