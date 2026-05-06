import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '../trpc';

export const notificationsRouter = router({
  /**
   * Save a push subscription for the current provider.
   * Called from the browser after the user grants notification permission.
   */
  savePushSubscription: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      p256dh: z.string().min(1),
      auth: z.string().min(1),
      userAgent: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert on endpoint so re-registrations are idempotent
      const { error } = await ctx.supabase
        .from('push_subscriptions')
        .upsert({
          user_id: ctx.user.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          user_agent: input.userAgent ?? null,
          is_active: true,
        }, { onConflict: 'endpoint' });

      if (error) {
        console.error('[Notifications] savePushSubscription error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to save push subscription' });
      }

      return { success: true };
    }),

  /**
   * Deactivate a push subscription (user unsubscribed or permission revoked).
   */
  deletePushSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('endpoint', input.endpoint)
        .eq('user_id', ctx.user.id);

      if (error) {
        console.error('[Notifications] deletePushSubscription error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete push subscription' });
      }

      return { success: true };
    }),

  /**
   * Check whether the current provider has at least one active push subscription.
   */
  hasSubscription: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', ctx.user.id)
        .eq('is_active', true)
        .limit(1);

      if (error) {
        return { subscribed: false };
      }

      return { subscribed: (data?.length ?? 0) > 0 };
    }),
});
