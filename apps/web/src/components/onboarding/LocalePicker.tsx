'use client';

import { Check, Globe, Loader2 } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { locales, localeLabels, type Locale, isLocale } from '@/i18n/config';
import { useChangeLocale } from '@/i18n/useChangeLocale';
import { trackOnboardingEvent, type OnboardingStage } from '@/lib/analytics-events';

// Masterplan §4.1 + §6.4. One component, two variants:
//   - "chip"  — landing/signup, compact trigger + inline menu
//   - "cards" — wizard step 1, four ≥72px tappable glass cards
//
// Both share the same side-effects in `commit`:
//   1. Write cookie + localStorage (useChangeLocale)
//   2. If authenticated, persist to profiles.preferred_locale via tRPC
//      (optimistic: UI flips immediately, rollback on failure via toast)
//   3. Hard-reload so server-rendered messages match on next paint
//      (avoids CJK/Latin metric shifts mid-page — §10 risk)

type Variant = 'chip' | 'cards';

interface Props {
  variant: Variant;
  /** Pass true on wizard step 1 / profile to skip the network write when
   *  the caller already handles it (e.g. wizard submits the whole form in
   *  one shot). Default false — commits to DB if a session exists. */
  skipRemoteWrite?: boolean;
  /** Funnel stage for analytics (masterplan §9). Defaults to 'profile' —
   *  callers on landing/signup/wizard should pass the appropriate stage. */
  stage?: OnboardingStage;
  onSelected?: (locale: Locale) => void;
}

export function LocalePicker({
  variant,
  skipRemoteWrite = false,
  stage = 'profile',
  onSelected,
}: Props) {
  const currentLocale = useLocale();
  const active: Locale = isLocale(currentLocale) ? currentLocale : 'en-SG';

  const { change } = useChangeLocale();
  const setPreferredLocale = api.provider.setPreferredLocale.useMutation();

  const [pending, setPending] = useState<Locale | null>(null);

  const commit = useCallback(
    async (next: Locale) => {
      if (next === active) return;
      setPending(next);

      // Optimistic: trigger the caller's side-effects first so the button
      // reads "selected" immediately while the server write is in flight.
      onSelected?.(next);

      if (!skipRemoteWrite) {
        try {
          await setPreferredLocale.mutateAsync({ locale: next });
        } catch (err) {
          // UNAUTHORIZED is expected pre-auth (landing/signup) — cookie is
          // enough, the profile row doesn't exist yet.
          // For any other error, warn but still apply the locale change locally
          // so the UI language switch is never blocked by a server write failure.
          const code = (err as { data?: { code?: string } })?.data?.code;
          if (code && code !== 'UNAUTHORIZED') {
            toast.error("Language saved locally — couldn't sync to server.");
          }
        }
      }

      trackOnboardingEvent({
        name: 'onboarding_language_selected',
        locale: next,
        stage,
      });

      // Apply locally: cookie + reload. Page will re-render in the new
      // locale before the user sees the finger lift.
      change(next);
    },
    [active, change, onSelected, setPreferredLocale, skipRemoteWrite, stage]
  );

  if (variant === 'chip') {
    return <ChipVariant active={active} pending={pending} onPick={commit} />;
  }

  return <CardsVariant active={active} pending={pending} onPick={commit} />;
}

// ---------------------------------------------------------------------------
// Variant: chip (landing / signup header)
// ---------------------------------------------------------------------------

function ChipVariant({
  active,
  pending,
  onPick,
}: {
  active: Locale;
  pending: Locale | null;
  onPick: (l: Locale) => void;
}) {
  const [open, setOpen] = useState(false);
  const activeLabel = localeLabels[active].native;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Choose your language"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-slate-900/65 px-4 py-2 text-sm font-medium text-slate-100 backdrop-blur-md transition-colors duration-200 hover:bg-slate-800/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 cursor-pointer"
      >
        <Globe className="h-4 w-4" aria-hidden="true" />
        <span>{activeLabel}</span>
      </button>

      {open ? (
        <ul
          role="listbox"
          aria-label="Languages"
          className="absolute right-0 z-50 mt-2 min-w-[200px] overflow-hidden rounded-xl border border-white/15 bg-slate-900/95 p-1 shadow-xl backdrop-blur-md"
        >
          {locales.map((loc) => {
            const isActive = loc === active;
            const isPending = pending === loc;
            const { native, english } = localeLabels[loc];
            return (
              <li key={loc}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={isPending}
                  onClick={() => {
                    setOpen(false);
                    onPick(loc);
                  }}
                  className={`flex w-full min-h-[44px] items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                    isActive
                      ? 'bg-blue-600/20 text-slate-50'
                      : 'text-slate-200 hover:bg-slate-800/80'
                  }`}
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{native}</span>
                    {native !== english ? (
                      <span className="text-xs text-slate-400">{english}</span>
                    ) : null}
                  </span>
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-300" aria-hidden="true" />
                  ) : isActive ? (
                    <Check className="h-4 w-4 text-blue-400" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variant: cards (wizard step 1)
// ---------------------------------------------------------------------------

function CardsVariant({
  active,
  pending,
  onPick,
}: {
  active: Locale;
  pending: Locale | null;
  onPick: (l: Locale) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Choose your language"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {locales.map((loc) => {
        const isActive = loc === active;
        const isPending = pending === loc;
        const { native, english } = localeLabels[loc];
        return (
          <button
            key={loc}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={isPending}
            onClick={() => onPick(loc)}
            className={`group relative flex min-h-[72px] w-full items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-colors duration-200 cursor-pointer disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
              isActive
                ? 'border-blue-500 bg-blue-600/15 text-slate-50'
                : 'border-white/15 bg-slate-800/60 text-slate-200 hover:bg-slate-800/80'
            }`}
          >
            <span className="flex flex-col">
              <span className="text-lg font-semibold leading-tight">{native}</span>
              {native !== english ? (
                <span className="mt-0.5 text-sm text-slate-400">{english}</span>
              ) : null}
            </span>
            <span
              aria-hidden="true"
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200 ${
                isActive
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700/70 text-transparent group-hover:text-slate-300'
              }`}
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Check className="h-5 w-5" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
