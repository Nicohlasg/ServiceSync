// BETA-ONLY: REMOVE FOR PUBLIC LAUNCH
// Delete this file, remove its entry from _app.ts, and run the schema cleanup migration.

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure } from '@/server/trpc';
import type { Context } from '@/server/trpc';
import { computeEarnings } from '../services/beta-rewards';

// ---------------------------------------------------------------------------
// Admin gate
// ---------------------------------------------------------------------------

function isAdmin(ctx: Context & { user: NonNullable<Context['user']> }): boolean {
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()) ?? [];
  return adminEmails.includes(ctx.user.email ?? '');
}

function requireAdmin(ctx: Context & { user: NonNullable<Context['user']> }): void {
  if (!isAdmin(ctx)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

const submitBugInput = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
  stepsToReproduce: z.string().max(2000).optional(),
  severity: z.enum(['low', 'med', 'high']).default('med'),
});

const submitFeatureInput = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(2000),
});

// ---------------------------------------------------------------------------
// Admin sub-router
// ---------------------------------------------------------------------------

const adminRouter = router({
  listAllBugs: protectedProcedure
    .input(
      z.object({
        status: z.enum(['submitted', 'verified', 'in_progress', 'fixed', 'rejected', 'all']).default('submitted'),
      }),
    )
    .query(async ({ ctx, input }) => {
      requireAdmin(ctx);

      let query = ctx.supabase
        .from('beta_bug_reports')
        .select('*, profiles!beta_bug_reports_provider_id_fkey(name, email)')
        .order('created_at', { ascending: false });

      if (input.status !== 'all') {
        query = query.eq('status', input.status);
      }

      const { data, error } = await query;
      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return data ?? [];
    }),

  setBugStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['submitted', 'verified', 'in_progress', 'fixed', 'rejected']),
        adminNote: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);

      const updates: Record<string, unknown> = {
        status: input.status,
        admin_note: input.adminNote ?? null,
      };

      if (input.status === 'verified') {
        updates.verified_at = new Date().toISOString();
        updates.verified_by = ctx.user.id;
      }

      const { error } = await ctx.supabase
        .from('beta_bug_reports')
        .update(updates)
        .eq('id', input.id);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),

  setFeatureStatus: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(['open', 'planned', 'shipped', 'declined']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireAdmin(ctx);

      const { error } = await ctx.supabase
        .from('beta_feature_requests')
        .update({ status: input.status })
        .eq('id', input.id);

      if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
      return { success: true };
    }),
});

// ---------------------------------------------------------------------------
// Main beta router
// ---------------------------------------------------------------------------

export const betaRouter = router({
  admin: adminRouter,

  amIAdmin: protectedProcedure.query(({ ctx }) => isAdmin(ctx)),

  // Submit a bug report
  submitBug: protectedProcedure.input(submitBugInput).mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabase.from('beta_bug_reports').insert({
      provider_id: ctx.user.id,
      title: input.title,
      description: input.description,
      steps_to_reproduce: input.stepsToReproduce ?? null,
      severity: input.severity,
    });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return { success: true };
  }),

  // Submit a feature request
  submitFeature: protectedProcedure.input(submitFeatureInput).mutation(async ({ ctx, input }) => {
    const { error } = await ctx.supabase.from('beta_feature_requests').insert({
      provider_id: ctx.user.id,
      title: input.title,
      description: input.description,
    });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return { success: true };
  }),

  // Own submissions (all statuses)
  listMyBugs: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('beta_bug_reports')
      .select('id, title, severity, status, admin_note, created_at')
      .eq('provider_id', ctx.user.id)
      .order('created_at', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }),

  // Public known bugs (verified / in_progress / fixed) — no submitter PII
  listKnownBugs: protectedProcedure.query(async ({ ctx }) => {
    const { data, error } = await ctx.supabase
      .from('beta_bug_reports')
      .select('id, title, severity, status, created_at')
      .in('status', ['verified', 'in_progress', 'fixed'])
      .order('created_at', { ascending: false });

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });
    return data ?? [];
  }),

  // Feature requests with vote totals + current user's vote
  listFeatures: protectedProcedure.query(async ({ ctx }) => {
    const [featuresRes, votesRes, myVotesRes] = await Promise.all([
      ctx.supabase
        .from('beta_feature_requests')
        .select('id, title, description, status, created_at')
        .order('created_at', { ascending: false }),
      ctx.supabase.from('beta_feature_votes').select('feature_id, value'),
      ctx.supabase
        .from('beta_feature_votes')
        .select('feature_id, value')
        .eq('provider_id', ctx.user.id),
    ]);

    if (featuresRes.error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: featuresRes.error.message });

    const voteMap = new Map<string, number>();
    for (const v of votesRes.data ?? []) {
      voteMap.set(v.feature_id, (voteMap.get(v.feature_id) ?? 0) + v.value);
    }

    const myVoteMap = new Map<string, number>();
    for (const v of myVotesRes.data ?? []) {
      myVoteMap.set(v.feature_id, v.value);
    }

    const features = (featuresRes.data ?? []).map((f) => ({
      ...f,
      score: voteMap.get(f.id) ?? 0,
      myVote: myVoteMap.get(f.id) ?? 0,
    }));

    return features.sort((a, b) => b.score - a.score);
  }),

  // Toggle vote on a feature
  voteFeature: protectedProcedure
    .input(z.object({ featureId: z.string().uuid(), value: z.union([z.literal(1), z.literal(-1)]) }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing } = await ctx.supabase
        .from('beta_feature_votes')
        .select('value')
        .eq('feature_id', input.featureId)
        .eq('provider_id', ctx.user.id)
        .maybeSingle();

      if (existing?.value === input.value) {
        // Same vote again — toggle off
        await ctx.supabase
          .from('beta_feature_votes')
          .delete()
          .eq('feature_id', input.featureId)
          .eq('provider_id', ctx.user.id);
      } else {
        // New vote or switching vote — upsert
        await ctx.supabase.from('beta_feature_votes').upsert(
          { feature_id: input.featureId, provider_id: ctx.user.id, value: input.value },
          { onConflict: 'feature_id,provider_id' },
        );
      }

      return { success: true };
    }),

  // Leaderboard: verified bug count + earnings per user
  leaderboard: protectedProcedure.query(async ({ ctx }) => {
    const { data: bugs, error } = await ctx.supabase
      .from('beta_bug_reports')
      .select('provider_id')
      .in('status', ['verified', 'in_progress', 'fixed']);

    if (error) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: error.message });

    // Aggregate counts in JS
    const countMap = new Map<string, number>();
    for (const b of bugs ?? []) {
      countMap.set(b.provider_id, (countMap.get(b.provider_id) ?? 0) + 1);
    }

    if (countMap.size === 0) return [];

    const providerIds = Array.from(countMap.keys());
    const { data: profiles, error: profilesError } = await ctx.supabase
      .from('profiles_public')
      .select('id, name, avatar_url')
      .in('id', providerIds);

    if (profilesError) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: profilesError.message });

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return Array.from(countMap.entries())
      .map(([providerId, count]) => {
        const { dollars, nextMilestone } = computeEarnings(count);
        const profile = profileMap.get(providerId);
        return {
          providerId,
          name: profile?.name ?? 'Unknown',
          avatarUrl: profile?.avatar_url ?? null,
          verifiedCount: count,
          dollars,
          nextMilestone,
        };
      })
      .sort((a, b) => b.verifiedCount - a.verifiedCount)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));
  }),
});
