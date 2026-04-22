'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Briefcase,
  Check,
  ChevronRight,
  QrCode,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { trackOnboardingEvent, type ChecklistItemName } from '@/lib/analytics-events';
import { spring, stagger, staggerItem } from '@/lib/motion';

// Masterplan §6 P0 Task 7 — post-tour activation checklist.
// Three latched rows + collapse/resume affordance. Reads/writes the JSONB
// column `profiles.onboarding_checklist` via tRPC procedures defined in
// `packages/api/src/routers/provider.ts`. Server-side auto-marking also
// fires from `provider.addService` and `clients.create` (see
// services/checklist.ts) so the rows stay in sync if the user bypasses
// this surface and creates entities from elsewhere.

type ChecklistItem = 'service' | 'client' | 'paynow';

// Map our internal ids to the masterplan §9 event taxonomy names.
const EVENT_ITEM_MAP: Record<ChecklistItem, ChecklistItemName> = {
  service: 'first_service',
  client: 'first_client',
  paynow: 'paynow_preview',
};

interface Row {
  id: ChecklistItem;
  titleKey: string;
  bodyKey: string;
  icon: LucideIcon;
  deepLink?: string;
}

const ROWS: Row[] = [
  {
    id: 'service',
    titleKey: 'checklist.rowService',
    bodyKey: 'checklist.rowServiceBody',
    icon: Briefcase,
    deepLink: '/dashboard/services?action=new',
  },
  {
    id: 'client',
    titleKey: 'checklist.rowClient',
    bodyKey: 'checklist.rowClientBody',
    icon: Users,
    deepLink: '/dashboard/clients/add',
  },
  {
    id: 'paynow',
    titleKey: 'checklist.rowPaynow',
    bodyKey: 'checklist.rowPaynowBody',
    icon: QrCode,
    // Modal is driven by caller via onPreviewPaynow — see Task 8.
  },
];

interface Props {
  /** Caller owns the PayNow preview modal (Task 8). Invoked when the PayNow
   *  row is tapped; the checklist marks the item server-side on confirm. */
  onPreviewPaynow?: () => void;
}

export function OnboardingChecklist({ onPreviewPaynow }: Props) {
  const t = useTranslations();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion() ?? false;

  const utils = api.useUtils();
  const checklistQuery = api.provider.getOnboardingChecklist.useQuery(undefined, {
    // Auth-gated page — callers must already be logged in. No retry on
    // UNAUTHORIZED/NOT_FOUND since both indicate "nothing to show."
    retry: (count, err) => {
      const code = (err as { data?: { code?: string } })?.data?.code;
      if (code === 'UNAUTHORIZED' || code === 'NOT_FOUND') return false;
      return count < 2;
    },
    staleTime: 30_000,
  });

  const markItem = api.provider.markChecklistItem.useMutation({
    onSuccess: () => {
      void utils.provider.getOnboardingChecklist.invalidate();
    },
  });
  const setHidden = api.provider.setChecklistHidden.useMutation({
    onSuccess: () => {
      void utils.provider.getOnboardingChecklist.invalidate();
    },
  });

  const checklist = checklistQuery.data;

  const state = useMemo(() => {
    const service = Boolean(checklist?.serviceAddedAt);
    const client = Boolean(checklist?.clientAddedAt);
    const paynow = Boolean(checklist?.paynowPreviewedAt);
    const done = [service, client, paynow].filter(Boolean).length;
    return {
      service,
      client,
      paynow,
      done,
      total: ROWS.length,
      allDone: done === ROWS.length,
      hidden: Boolean(checklist?.hiddenAt),
    };
  }, [checklist]);

  const isComplete = useCallback((id: ChecklistItem) => state[id], [state]);

  // Fire `onboarding_checklist_item_completed` exactly once per item, the
  // first time we observe a timestamp transition from null → set. Using a
  // ref-based diff (instead of firing in mutation onSuccess) means the
  // event also fires for server-side auto-marking from addService /
  // clients.create, which are the canonical paths for most users.
  const prevFlagsRef = useRef<Record<ChecklistItem, boolean> | null>(null);
  useEffect(() => {
    if (!checklist) return;
    const current: Record<ChecklistItem, boolean> = {
      service: state.service,
      client: state.client,
      paynow: state.paynow,
    };
    const prev = prevFlagsRef.current;
    if (prev) {
      (Object.keys(current) as ChecklistItem[]).forEach((id) => {
        if (!prev[id] && current[id]) {
          trackOnboardingEvent({
            name: 'onboarding_checklist_item_completed',
            item: EVENT_ITEM_MAP[id],
          });
        }
      });
    }
    prevFlagsRef.current = current;
  }, [checklist, state.service, state.client, state.paynow]);

  const handleRowTap = useCallback(
    (row: Row) => {
      if (isComplete(row.id)) return;

      if (row.id === 'paynow') {
        // PayNow row doesn't navigate — it opens a modal. The caller then
        // invokes `markItem.mutateAsync({ item: 'paynow' })` on close.
        if (onPreviewPaynow) {
          onPreviewPaynow();
        } else {
          // Fallback if host didn't wire the modal yet — mark directly so
          // the row doesn't stay stuck. Safe because `markChecklistItem`
          // is idempotent (first-completion-wins).
          markItem.mutate({ item: 'paynow' });
        }
        return;
      }

      if (row.deepLink) router.push(row.deepLink);
    },
    [isComplete, markItem, onPreviewPaynow, router]
  );

  const handleHide = useCallback(() => {
    trackOnboardingEvent({
      name: 'onboarding_checklist_dismissed',
      items_completed: state.done,
    });
    setHidden.mutate(
      { hidden: true },
      {
        onError: () => toast.error(t('errors.generic')),
      }
    );
  }, [setHidden, state.done, t]);

  const handleResume = useCallback(() => {
    setHidden.mutate(
      { hidden: false },
      {
        onError: () => toast.error(t('errors.generic')),
      }
    );
  }, [setHidden, t]);

  // Loading / empty / error — render nothing to keep the dashboard clean.
  // The checklist is a bonus surface; absence must not look like a bug.
  if (checklistQuery.isLoading || !checklist) return null;

  // Collapsed state — one-line resume CTA.
  if (state.hidden) {
    return (
      <button
        type="button"
        data-testid="onboarding-checklist-resume"
        onClick={handleResume}
        disabled={setHidden.isPending}
        className="group inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-slate-900/40 px-4 text-sm font-medium text-slate-300 backdrop-blur-md transition-colors duration-200 hover:text-slate-100 hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
      >
        <Sparkles className="h-4 w-4 text-blue-400" aria-hidden="true" />
        {t('checklist.resumeCta')}
      </button>
    );
  }

  return (
    <motion.section
      data-testid="onboarding-checklist"
      aria-labelledby="onboarding-checklist-title"
      variants={prefersReducedMotion ? undefined : stagger}
      initial="hidden"
      animate="show"
      className={`relative overflow-hidden rounded-2xl border border-white/15 bg-slate-900/40 shadow-lg backdrop-blur-md max-w-[90vw] sm:max-w-none max-h-[80vh] overflow-y-auto ${
        state.allDone ? 'p-4 sm:p-5' : 'p-4 sm:p-6'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="onboarding-checklist-title"
            className="text-lg font-semibold text-slate-100 sm:text-xl"
          >
            {state.allDone ? t('checklist.completeTitle') : t('checklist.title')}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {state.allDone ? t('checklist.completeBody') : t('checklist.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            data-testid="onboarding-checklist-progress"
            role="status"
            aria-live="polite"
            className="inline-flex items-center rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs font-medium text-slate-200"
          >
            {t('checklist.progress', { done: state.done, total: state.total })}
          </span>
          <button
            type="button"
            data-testid="onboarding-checklist-hide"
            onClick={handleHide}
            disabled={setHidden.isPending}
            aria-label={t('common.hideForNow')}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('checklist.hideCta')}</span>
          </button>
        </div>
      </div>

      {state.allDone ? (
        <motion.div
          variants={prefersReducedMotion ? undefined : staggerItem}
          className="mt-4 space-y-3"
        >
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t('checklist.nextHub')}
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { key: 'checklist.nextSchedule', href: '/dashboard/schedule' },
              { key: 'checklist.nextInvoices', href: '/dashboard/invoices' },
              { key: 'checklist.nextHelp', href: '/dashboard/profile#help' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => router.push(item.href)}
                className="flex min-h-[52px] items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:border-blue-400/40 hover:bg-slate-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>{t(item.key)}</span>
                <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <ul className="mt-5 space-y-2">
          <AnimatePresence initial={false}>
            {ROWS.map((row) => {
              const done = isComplete(row.id);
              const Icon = row.icon;
              return (
                <motion.li
                  key={row.id}
                  variants={prefersReducedMotion ? undefined : staggerItem}
                  layout={!prefersReducedMotion}
                >
                  <button
                    type="button"
                    data-testid={`onboarding-checklist-row-${row.id}`}
                    data-state={done ? 'done' : 'todo'}
                    onClick={() => handleRowTap(row)}
                    disabled={done}
                    className={`group flex w-full min-h-[72px] items-center gap-4 rounded-xl border px-4 py-3 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      done
                        ? 'cursor-default border-white/5 bg-slate-950/30 opacity-70'
                        : 'cursor-pointer border-white/10 bg-slate-950/40 hover:border-blue-400/40 hover:bg-slate-950/60'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                        done
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'bg-slate-800/60 text-slate-300 group-hover:bg-blue-600/20 group-hover:text-blue-200'
                      }`}
                    >
                      {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm font-semibold sm:text-base ${
                          done ? 'text-slate-400 line-through decoration-slate-500' : 'text-slate-100'
                        }`}
                      >
                        {t(row.titleKey)}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400 sm:text-sm">
                        {t(row.bodyKey)}
                      </span>
                    </span>

                    {!done ? (
                      <motion.span
                        aria-hidden="true"
                        className="text-slate-500 transition-colors duration-200 group-hover:text-blue-300"
                        whileHover={prefersReducedMotion ? undefined : { x: 2 }}
                        transition={spring.settle}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </motion.span>
                    ) : null}
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </motion.section>
  );
}
