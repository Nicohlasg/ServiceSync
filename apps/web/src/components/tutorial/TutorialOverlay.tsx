'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { trackEvent } from '@/lib/analytics';
import { spring } from '@/lib/motion';
import { TUTORIAL_STEPS, TUTORIAL_TOTAL_STEPS } from './steps';
import { TutorialProgress } from './TutorialProgress';
import { useTutorialGate } from './useTutorialGate';

// Coachmark tour (Intercom/Pendo style). Renders a small anchored popup near
// the UI the user should tap, plus a pulse ring on the target. The rest of
// the screen stays fully interactive — no backdrop, no blur. On tap of the
// target we advance to the next step, giving the user hands-on practice.
//
// Hybrid gating (`useTutorialGate`) decides if the tour should show at all.

const POPUP_WIDTH = 288; // ~w-72, fits comfortably on a 360-width phone
const POPUP_MARGIN = 12;
const POPUP_VIEWPORT_MARGIN = 16;
const RING_PADDING = 10;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  open?: boolean;
  onClose?: (reason: 'completed' | 'skipped') => void;
}

export function TutorialOverlay({ open, onClose }: Props) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const router = useRouter();
  const pathname = usePathname();

  const { shouldShow, markComplete } = useTutorialGate();
  const isOpen = open ?? shouldShow;

  const [index, setIndex] = useState(0);
  const current = TUTORIAL_STEPS[index];
  const isLast = index === TUTORIAL_TOTAL_STEPS - 1;
  const isFirst = index === 0;

  // Reset to step 0 on a fresh open (handles replay flow).
  const prevOpenRef = useRef(isOpen);
  useEffect(() => {
    if (!prevOpenRef.current && isOpen) {
      const raf = window.requestAnimationFrame(() => setIndex(0));
      prevOpenRef.current = isOpen;
      return () => window.cancelAnimationFrame(raf);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // ---- Analytics ----
  const openedRef = useRef(false);
  useEffect(() => {
    if (isOpen && !openedRef.current) {
      openedRef.current = true;
      trackEvent('tutorial_started');
    } else if (!isOpen && openedRef.current) {
      openedRef.current = false;
    }
  }, [isOpen]);
  useEffect(() => {
    if (isOpen) trackEvent('tutorial_step_viewed', { step: index + 1, id: current.id });
  }, [isOpen, index, current.id]);

  const close = useCallback(
    (reason: 'completed' | 'skipped') => {
      trackEvent(reason === 'completed' ? 'tutorial_completed' : 'tutorial_skipped', {
        step: index + 1,
      });
      void markComplete(reason);
      onClose?.(reason);
    },
    [index, markComplete, onClose]
  );

  const goNext = useCallback(() => {
    setIndex((i) => (i >= TUTORIAL_TOTAL_STEPS - 1 ? i : i + 1));
  }, []);
  const goBack = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // ---- Target tracking ----
  //
  // We re-read the target rect on:
  //   (a) step change
  //   (b) DOM mutations (target appears/disappears, sibling reflow)
  //   (c) scroll / resize (rect drifts)
  // The popup and pulse ring snap to the updated rect each frame.
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const targetEl = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!current.targetSelector) {
      targetEl.current = null;
      const raf = window.requestAnimationFrame(() => setTargetRect(null));
      return () => window.cancelAnimationFrame(raf);
    }

    let raf: number | null = null;
    const scheduleRead = () => {
      if (raf !== null) return;
      raf = window.requestAnimationFrame(() => {
        raf = null;
        const el = document.querySelector(current.targetSelector!);
        targetEl.current = el;
        if (!el) {
          setTargetRect(null);
          return;
        }
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      });
    };

    scheduleRead();
    const observer = new MutationObserver(scheduleRead);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('scroll', scheduleRead, true);
    window.addEventListener('resize', scheduleRead);

    return () => {
      if (raf !== null) window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('scroll', scheduleRead, true);
      window.removeEventListener('resize', scheduleRead);
    };
  }, [isOpen, current.targetSelector, pathname]);

  // ---- Advance on tap of the target ----
  useEffect(() => {
    if (!isOpen) return;
    if (!current.targetSelector) return;
    const selector = current.targetSelector;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest(selector)) {
        // Let the user's tap through to the real UI — we just listen.
        // Delay the advance slightly so the navigation/press animation starts
        // before the popup hops to the next step.
        window.setTimeout(() => {
          if (isLast) close('completed');
          else goNext();
        }, 120);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isOpen, current.targetSelector, isLast, close, goNext]);

  // ---- Keyboard support (desktop / assistive) ----
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close('skipped');
      } else if (e.key === 'ArrowRight') {
        if (isLast) close('completed');
        else goNext();
      } else if (e.key === 'ArrowLeft' && !isFirst) {
        goBack();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isLast, isFirst, close, goNext, goBack]);

  // ---- Popup placement ----
  //
  // If there's no target (welcome / ready / route-mismatch) → centered card.
  // Otherwise decide above vs below based on available space, then clamp
  // horizontally to keep the card inside the viewport.
  const placement = useMemo<{
    mode: 'center' | 'anchored';
    style: React.CSSProperties;
    caret: 'top' | 'bottom' | null;
  }>(() => {
    const viewportH = typeof window === 'undefined' ? 800 : window.innerHeight;
    const viewportW = typeof window === 'undefined' ? 360 : window.innerWidth;

    if (!targetRect || !current.targetSelector) {
      return {
        mode: 'center',
        style: {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: `min(${POPUP_WIDTH}px, calc(100vw - 32px))`,
        },
        caret: null,
      };
    }

    const spaceBelow = viewportH - (targetRect.top + targetRect.height);
    const spaceAbove = targetRect.top;
    const placeBelow = spaceBelow >= spaceAbove;

    const width = Math.min(POPUP_WIDTH, viewportW - POPUP_VIEWPORT_MARGIN * 2);
    const anchorCenter = targetRect.left + targetRect.width / 2;
    let left = anchorCenter - width / 2;
    left = Math.max(POPUP_VIEWPORT_MARGIN, Math.min(left, viewportW - width - POPUP_VIEWPORT_MARGIN));

    const top = placeBelow
      ? targetRect.top + targetRect.height + POPUP_MARGIN
      : targetRect.top - POPUP_MARGIN;

    return {
      mode: 'anchored',
      style: {
        top,
        left,
        width,
        transform: placeBelow ? undefined : 'translateY(-100%)',
      },
      caret: placeBelow ? 'top' : 'bottom',
    };
  }, [targetRect, current.targetSelector]);

  // Route-mismatch: target selector is set but we're on the wrong route.
  // Show a center card with a "Go to …" CTA instead of an anchored popup.
  const showingRouteCta =
    current.targetSelector !== null &&
    targetRect === null &&
    (current.route ? pathname !== current.route : true);

  const Icon = current.icon;

  return (
    <AnimatePresence>
      {isOpen ? (
        // pointer-events: none on the layer so the rest of the app stays tappable.
        // Interactive children (card, skip, ring) opt back in with pointer-events: auto.
        <motion.div
          key="tutorial-overlay"
          data-testid="tutorial-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-none fixed inset-0 z-[300]"
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          {/* Pulse ring around the target — pure visual, never intercepts taps. */}
          {targetRect && !showingRouteCta ? (
            <motion.div
              key={`ring-${current.id}`}
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={prefersReducedMotion ? { duration: 0.15 } : spring.settle}
              className="pointer-events-none fixed rounded-2xl"
              style={{
                top: targetRect.top - RING_PADDING,
                left: targetRect.left - RING_PADDING,
                width: targetRect.width + RING_PADDING * 2,
                height: targetRect.height + RING_PADDING * 2,
                boxShadow:
                  '0 0 0 3px rgba(59,130,246,0.9), 0 0 24px 8px rgba(59,130,246,0.55)',
                animation: prefersReducedMotion ? undefined : 'tutorialPulse 1.6s ease-out infinite',
              }}
            />
          ) : null}

          {/* Popup card wrapper to preserve positioning transforms */}
          <div className="fixed pointer-events-none z-50" style={placement.style}>
            <motion.div
              key={`card-${current.id}-${placement.mode}`}
              role="dialog"
              aria-modal="false"
              aria-labelledby="tutorial-title"
              aria-describedby="tutorial-body"
              initial={{ opacity: 0, scale: 0.96, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 4 }}
              transition={prefersReducedMotion ? { duration: 0.15 } : spring.settle}
              className="pointer-events-auto w-full h-full rounded-2xl border border-white/15 bg-slate-900/95 shadow-2xl backdrop-blur-md"
            >
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="flex-1">
                <TutorialProgress
                  currentIndex={index}
                  total={TUTORIAL_TOTAL_STEPS}
                  dwellMs={null}
                  paused={true}
                />
              </div>
              <button
                type="button"
                data-testid="tutorial-skip"
                onClick={() => close('skipped')}
                aria-label={t('tutorial.skipButton')}
                className="ml-2 inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{t('tutorial.skipButton')}</span>
              </button>
            </div>

            <div className="px-4 pb-4 pt-1">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 id="tutorial-title" className="text-base font-black text-white tracking-tight">
                    {t(`tutorial.${current.translationKey}.title`)}
                  </h2>
                  <p id="tutorial-body" className="mt-1 text-sm text-slate-300 leading-snug">
                    {t(`tutorial.${current.translationKey}.body`)}
                  </p>
                  {placement.mode === 'anchored' && !showingRouteCta ? (
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      {t('tutorial.tapHighlighted')}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button
                  type="button"
                  data-testid="tutorial-back"
                  onClick={goBack}
                  aria-label={t('common.back')}
                  className={`inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-slate-300 transition-colors duration-200 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                    isFirst ? 'pointer-events-none opacity-0' : ''
                  }`}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  {t('common.back')}
                </button>

                {showingRouteCta && current.ctaRoute && current.ctaLabelKey ? (
                  <button
                    type="button"
                    data-testid="tutorial-route-cta"
                    onClick={() => router.push(current.ctaRoute!)}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-blue-400/30 bg-blue-600 px-4 text-sm font-bold text-white shadow-lg transition-colors duration-200 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  >
                    {t(`tutorial.${current.ctaLabelKey}`)}
                  </button>
                ) : placement.mode === 'center' ? (
                  <button
                    type="button"
                    data-testid="tutorial-next"
                    onClick={() => (isLast ? close('completed') : goNext())}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-blue-400/30 bg-blue-600 px-5 text-sm font-bold text-white shadow-lg transition-colors duration-200 hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
                  >
                    {isLast ? t('common.start') : t('common.continue')}
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500 font-medium">
                    {t('tutorial.progress', { current: index + 1, total: TUTORIAL_TOTAL_STEPS })}
                  </span>
                )}
              </div>
            </div>
            </motion.div>
          </div>

          <style jsx global>{`
            @keyframes tutorialPulse {
              0% {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.9),
                  0 0 0 0 rgba(59, 130, 246, 0.55);
              }
              70% {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.9),
                  0 0 0 16px rgba(59, 130, 246, 0);
              }
              100% {
                box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.9),
                  0 0 0 0 rgba(59, 130, 246, 0);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              @keyframes tutorialPulse {
                0%,
                100% {
                  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.9);
                }
              }
            }
          `}</style>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
