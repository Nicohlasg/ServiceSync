/**
 * Provider Profile Router — ServiceSync
 *
 * Manages technician public profile and service listings.
 * Public profile accessible at /p/{slug}
 */

import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure } from '../trpc';

import { sanitizeHtml } from '../utils/sanitize';
import { emitAuditEvent } from '../services/audit';
import { markChecklistItemServerSide } from '../services/checklist';

// Fields that must never appear in audit diffs (payment keys are encrypted at rest).
const AUDIT_REDACTED_KEYS = new Set(['paynow_key', 'paynow_key_type']);
function redactForAudit(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    out[k] = AUDIT_REDACTED_KEYS.has(k) ? '[redacted]' : v;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Input Schemas
// ---------------------------------------------------------------------------

const updateProfileInput = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/).optional(),
  phone: z.string().min(8).optional(),
  email: z.string().email().optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().or(z.literal('')).nullable().optional(),
  baseAddress: z.string().min(5).optional(),
  baseLat: z.number().optional(),
  baseLng: z.number().optional(),
  paynowKey: z.string().optional(),
  paynowKeyType: z.enum(['nric', 'mobile', 'uen']).optional(),
  acraUen: z.string().optional(),
  acraVerified: z.boolean().optional(),
  workingHours: z.any().optional(),
});

// SGD 100,000 hard cap on a single service line — prevents overflow / typos.
const MAX_PRICE_CENTS = 10_000_000;

const addServiceInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(15).max(480),
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS),
  sortOrder: z.number().int().default(0),
});

const updateServiceInput = z.object({
  serviceId: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  priceCents: z.number().int().min(0).max(MAX_PRICE_CENTS).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const providerRouter = router({
  /**
   * Returns the public profile for /p/{slug} page.
   * Includes: name, bio, verified status, services.
   */
  getPublicProfile: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const { data: profile, error } = await ctx.supabase
        .from('profiles_public')
        .select(`
          id, slug, name, bio, avatar_url, banner_url,
          acra_registered, acra_uen, acra_verified,
          total_jobs, avg_rating, review_count,
          created_at
        `)
        .eq('slug', input.slug)
        .single();

      if (error || !profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Provider not found' });
      }

      // Fetch services for this provider
      const { data: services } = await ctx.supabase
        .from('services')
        .select('id, name, description, price_cents, duration_minutes, is_active, sort_order, created_at')
        .eq('provider_id', profile.id)
        .order('created_at');

      return {
        ...profile,
        services: services ?? [],
      };
    }),

  /**
   * Gets the authenticated technician's own profile.
   */
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('*')
        .eq('id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      return data;
    }),

  /**
   * Updates the authenticated technician's profile.
   */
  /**
   * Persists the user's preferred locale. Authoritative over localStorage
   * and the NEXT_LOCALE cookie — see onboarding masterplan §4.1.
   * Narrow mutation (one column) keeps the audit diff unambiguous and lets
   * low-literacy users change language from anywhere without triggering
   * the heavier `updateProfile` validation.
   */
  setPreferredLocale: protectedProcedure
    .input(
      z.object({
        locale: z.enum(['en-SG', 'zh-Hans-SG', 'ms-SG', 'ta-SG']),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({ preferred_locale: input.locale })
        .eq('id', ctx.user.id)
        .select('id, preferred_locale')
        .single();

      if (error) {
        console.error('[Provider] setPreferredLocale error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save language preference',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: { changes: { preferred_locale: input.locale } },
      });

      return data;
    }),

  /**
   * Cross-device tutorial gating — masterplan §4.2, P0 Task 6.
   *
   * Client reads this once on mount. If `tutorialCompletedAt !== null`, the
   * client promotes the cached localStorage flag so subsequent visits on this
   * device skip the overlay without an extra round-trip.
   */
  getTutorialStatus: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('tutorial_completed_at')
        .eq('id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      return { tutorialCompletedAt: data.tutorial_completed_at as string | null };
    }),

  /**
   * Marks the tour finished so the overlay won't auto-show again on any
   * device. Idempotent: if the column is already set, we keep the original
   * timestamp (first-completion wins) — this preserves "when did this user
   * first onboard" telemetry across replays.
   */
  markTutorialComplete: protectedProcedure
    .input(z.object({ reason: z.enum(['completed', 'skipped']) }).optional())
    .mutation(async ({ ctx, input }) => {
      // Read first so we can preserve the original timestamp on replay.
      const { data: existing } = await ctx.supabase
        .from('profiles')
        .select('tutorial_completed_at')
        .eq('id', ctx.user.id)
        .single();

      if (existing?.tutorial_completed_at) {
        return { tutorialCompletedAt: existing.tutorial_completed_at as string };
      }

      const nowIso = new Date().toISOString();
      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({ tutorial_completed_at: nowIso })
        .eq('id', ctx.user.id)
        .select('tutorial_completed_at')
        .single();

      if (error) {
        console.error('[Provider] markTutorialComplete error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to save tutorial status',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: {
          changes: {
            tutorial_completed_at: nowIso,
            tutorial_close_reason: input?.reason ?? 'completed',
          },
        },
      });

      return { tutorialCompletedAt: data.tutorial_completed_at as string };
    }),

  /**
   * Clears `tutorial_completed_at` so the replay button can show the tour
   * again on the next dashboard visit (Task 15 — profile replay row, and the
   * Re-run Setup Wizard button from Task 15b).
   */
  resetTutorialCompletion: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { error } = await ctx.supabase
        .from('profiles')
        .update({ tutorial_completed_at: null })
        .eq('id', ctx.user.id);

      if (error) {
        console.error('[Provider] resetTutorialCompletion error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset tutorial status',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: { changes: { tutorial_completed_at: null } },
      });

      return { success: true };
    }),

  /**
   * Post-tour activation checklist (masterplan §6 P0 Task 7).
   *
   * Stored as a JSONB column `onboarding_checklist` on profiles so we can
   * evolve the shape without schema migrations. Shape is append-only:
   *   {
   *     serviceAddedAt:    string | null,
   *     clientAddedAt:     string | null,
   *     paynowPreviewedAt: string | null,
   *     hiddenAt:          string | null
   *   }
   *
   * Latched flags (not derived from row counts) so that deleting the only
   * service/client doesn't retrigger the onboarding nudge — per §7 rationale.
   */
  getOnboardingChecklist: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('profiles')
        .select('onboarding_checklist')
        .eq('id', ctx.user.id)
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      // Defensive: legacy rows may have NULL; normalise to empty object.
      const raw = (data.onboarding_checklist ?? {}) as Record<string, unknown>;
      return {
        serviceAddedAt: (raw.serviceAddedAt as string | null) ?? null,
        clientAddedAt: (raw.clientAddedAt as string | null) ?? null,
        paynowPreviewedAt: (raw.paynowPreviewedAt as string | null) ?? null,
        hiddenAt: (raw.hiddenAt as string | null) ?? null,
      };
    }),

  /**
   * Marks a checklist item as completed. First-completion wins — repeat calls
   * do not overwrite the timestamp (audit fidelity for "when did this user
   * first add a service"). Safe to call from client-initiated actions like
   * the PayNow preview modal.
   */
  markChecklistItem: protectedProcedure
    .input(z.object({ item: z.enum(['service', 'client', 'paynow']) }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing, error: readErr } = await ctx.supabase
        .from('profiles')
        .select('onboarding_checklist')
        .eq('id', ctx.user.id)
        .single();

      if (readErr || !existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      const current = (existing.onboarding_checklist ?? {}) as Record<string, string | null>;
      const keyMap: Record<'service' | 'client' | 'paynow', string> = {
        service: 'serviceAddedAt',
        client: 'clientAddedAt',
        paynow: 'paynowPreviewedAt',
      };
      const key = keyMap[input.item];

      if (current[key]) {
        // First-completion-wins — return existing state untouched.
        return current;
      }

      const nowIso = new Date().toISOString();
      const next = { ...current, [key]: nowIso };

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update({ onboarding_checklist: next })
        .eq('id', ctx.user.id)
        .select('onboarding_checklist')
        .single();

      if (error) {
        console.error('[Provider] markChecklistItem error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update checklist',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: { changes: { [`onboarding_checklist.${key}`]: nowIso } },
      });

      return (data.onboarding_checklist ?? next) as Record<string, string | null>;
    }),

  /**
   * Toggles the checklist's collapsed/visible state via a `hiddenAt` timestamp.
   * When unhiding, we clear the timestamp so the resume banner disappears.
   */
  setChecklistHidden: protectedProcedure
    .input(z.object({ hidden: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const { data: existing, error: readErr } = await ctx.supabase
        .from('profiles')
        .select('onboarding_checklist')
        .eq('id', ctx.user.id)
        .single();

      if (readErr || !existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' });
      }

      const current = (existing.onboarding_checklist ?? {}) as Record<string, string | null>;
      const next = {
        ...current,
        hiddenAt: input.hidden ? new Date().toISOString() : null,
      };

      const { error } = await ctx.supabase
        .from('profiles')
        .update({ onboarding_checklist: next })
        .eq('id', ctx.user.id);

      if (error) {
        console.error('[Provider] setChecklistHidden error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update checklist visibility',
        });
      }

      return next;
    }),

  /**
   * Clears the entire checklist so the Re-run Setup Wizard flow (Task 15b)
   * can restart activation from zero. Complements resetTutorialCompletion.
   */
  resetOnboardingChecklist: protectedProcedure
    .mutation(async ({ ctx }) => {
      const empty = {
        serviceAddedAt: null,
        clientAddedAt: null,
        paynowPreviewedAt: null,
        hiddenAt: null,
      };
      const { error } = await ctx.supabase
        .from('profiles')
        .update({ onboarding_checklist: empty })
        .eq('id', ctx.user.id);

      if (error) {
        console.error('[Provider] resetOnboardingChecklist error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset checklist',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: { changes: { onboarding_checklist: empty } },
      });

      return empty;
    }),

  /**
   * Re-run Setup Wizard — resets onboarding gating flags so the full wizard
   * (username, language, services, PayNow) re-appears on next dashboard visit.
   *
   * Does NOT wipe profile data (name, slug, locale, services etc.) — the wizard
   * itself is idempotent and overwrites fields as the user re-confirms each step.
   * This mutation only clears the flags that gate wizard visibility.
   *
   * Idempotent: safe to call multiple times.
   */
  resetOnboarding: protectedProcedure
    .mutation(async ({ ctx }) => {
      const emptyChecklist = {
        serviceAddedAt: null,
        clientAddedAt: null,
        paynowPreviewedAt: null,
        hiddenAt: null,
      };

      const { error } = await ctx.supabase
        .from('profiles')
        .update({
          tutorial_completed_at: null,
          onboarding_checklist: emptyChecklist,
        })
        .eq('id', ctx.user.id);

      if (error) {
        console.error('[Provider] resetOnboarding error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to reset onboarding',
        });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: {
          changes: {
            tutorial_completed_at: null,
            onboarding_checklist: emptyChecklist,
          },
        },
      });

      return { success: true };
    }),

  updateProfile: protectedProcedure
    .input(updateProfileInput)
    .mutation(async ({ ctx, input }) => {
      // If slug is being changed, check uniqueness
      if (input.slug) {
        const { data: existing } = await ctx.supabase
          .from('profiles')
          .select('id')
          .eq('slug', input.slug)
          .neq('id', ctx.user.id)
          .single();

        if (existing) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This URL slug is already taken',
          });
        }
      }

      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = sanitizeHtml(input.name);
      if (input.slug !== undefined) updateData.slug = sanitizeHtml(input.slug);
      if (input.phone !== undefined) updateData.phone = sanitizeHtml(input.phone);
      if (input.email !== undefined) updateData.email = sanitizeHtml(input.email ?? '');
      if (input.bio !== undefined) updateData.bio = sanitizeHtml(input.bio ?? '');
      if (input.avatarUrl !== undefined) updateData.avatar_url = input.avatarUrl;
      if (input.bannerUrl !== undefined) updateData.banner_url = input.bannerUrl ? input.bannerUrl : null;
      if (input.baseAddress !== undefined) updateData.base_address = sanitizeHtml(input.baseAddress ?? '');
      if (input.baseLat !== undefined) updateData.base_lat = input.baseLat;
      if (input.baseLng !== undefined) updateData.base_lng = input.baseLng;
      if (input.paynowKey !== undefined) updateData.paynow_key = input.paynowKey;
      if (input.paynowKeyType !== undefined) updateData.paynow_key_type = input.paynowKeyType;
      if (input.acraUen !== undefined) updateData.acra_uen = sanitizeHtml(input.acraUen ?? '');
      if (input.acraVerified !== undefined) updateData.acra_verified = input.acraVerified;
      if (input.workingHours !== undefined) updateData.working_hours = input.workingHours;

      const { data, error } = await ctx.supabase
        .from('profiles')
        .update(updateData)
        .eq('id', ctx.user.id)
        .select()
        .single();

      if (error) {
        console.error('[Provider] updateProfile error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update profile' });
      }

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'update',
        diff: { changes: redactForAudit(updateData) },
      });

      return data;
    }),

  /**
   * Task 1.5: Record PDPA consent. Idempotent — only sets if not already set.
   */
  acceptPdpa: protectedProcedure
    .mutation(async ({ ctx }) => {
      const { data } = await ctx.supabase
        .from('profiles')
        .select('pdpa_consent_at')
        .eq('id', ctx.user.id)
        .single();

      if (data?.pdpa_consent_at) {
        return { alreadyAccepted: true, consentAt: data.pdpa_consent_at };
      }

      const now = new Date().toISOString();
      await ctx.supabase
        .from('profiles')
        .update({ pdpa_consent_at: now })
        .eq('id', ctx.user.id);

      void emitAuditEvent({
        actorId: ctx.user.id,
        actorIp: ctx.clientIp,
        entityType: 'profile',
        entityId: ctx.user.id,
        action: 'pdpa_consent',
        diff: { pdpa_consent_at: now },
      });

      return { alreadyAccepted: false, consentAt: now };
    }),

  /**
   * Lists the technician's services.
   */
  getServices: protectedProcedure
    .query(async ({ ctx }) => {
      const { data, error } = await ctx.supabase
        .from('services')
        .select('*')
        .eq('provider_id', ctx.user.id)
        .order('sort_order');

      if (error) {
        console.error('[Provider] getServices error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to fetch services' });
      }

      return data ?? [];
    }),

  /**
   * Adds a new service type.
   */
  addService: protectedProcedure
    .input(addServiceInput)
    .mutation(async ({ ctx, input }) => {
      const { data, error } = await ctx.supabase
        .from('services')
        .insert({
          provider_id: ctx.user.id,
          name: sanitizeHtml(input.name),
          description: sanitizeHtml(input.description) ?? '',
          duration_minutes: input.durationMinutes,
          price_cents: input.priceCents,
          sort_order: input.sortOrder,
        })
        .select()
        .single();

      if (error) {
        console.error('[Provider] addService error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to add service' });
      }

      // Onboarding checklist auto-mark (masterplan §6 P0 Task 7). Fire-and-forget:
      // failure must never block the main response. Helper already swallows errors.
      void markChecklistItemServerSide(ctx.supabase, ctx.user.id, 'service');

      return data;
    }),

  /**
   * Updates an existing service.
   */
  updateService: protectedProcedure
    .input(updateServiceInput)
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = sanitizeHtml(input.name);
      if (input.description !== undefined) updateData.description = sanitizeHtml(input.description);
      if (input.durationMinutes !== undefined) updateData.duration_minutes = input.durationMinutes;
      if (input.priceCents !== undefined) updateData.price_cents = input.priceCents;
      if (input.isActive !== undefined) updateData.is_active = input.isActive;
      if (input.sortOrder !== undefined) updateData.sort_order = input.sortOrder;

      const { data, error } = await ctx.supabase
        .from('services')
        .update(updateData)
        .eq('id', input.serviceId)
        .eq('provider_id', ctx.user.id)
        .select()
        .single();

      if (error || !data) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Service not found' });
      }

      return data;
    }),

  /**
   * Soft-deletes a service (sets is_active to false).
   */
  deleteService: protectedProcedure
    .input(z.object({ serviceId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('services')
        .update({ is_active: false })
        .eq('id', input.serviceId)
        .eq('provider_id', ctx.user.id);

      if (error) {
        console.error('[Provider] deleteService error:', error.message);
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to delete service' });
      }

      return { success: true };
    }),

  /**
   * Permanently deletes the authenticated user's account.
   *
   * Cascade chain (ON DELETE CASCADE in schema.sql):
   *   auth.users → profiles → services, clients, bookings, invoices, schedule_entries, etc.
   *
   * Uses the service-role admin client to call auth.admin.deleteUser().
   * PDPA Article 16 — right to withdraw consent and request deletion.
   */
  deleteAccount: protectedProcedure
    .input(z.object({ confirmEmail: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      // Safety: verify the confirmation email matches the authenticated user
      const { data: { user } } = await ctx.supabase.auth.getUser();

      if (!user || user.email !== input.confirmEmail) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Confirmation email does not match your account email.',
        });
      }

      // Use admin client to delete the auth user (cascades everything)
      const { getAdminClient } = await import('../services/supabase-admin');
      const admin = getAdminClient();

      const { error } = await admin.auth.admin.deleteUser(ctx.user.id);

      if (error) {
        console.error('[Provider] deleteAccount error:', error.message);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete account. Please contact support.',
        });
      }

      console.log(`[Provider] Account deleted: ${ctx.user.id}`);
      return { success: true };
    }),
});
