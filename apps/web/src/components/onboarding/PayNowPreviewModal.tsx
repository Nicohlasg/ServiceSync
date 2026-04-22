'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

import { trackEvent } from '@/lib/analytics';
import { api } from '@/lib/api';
import { modalBackdrop, modalContent } from '@/lib/motion';

// Masterplan §6 P0 Task 8 — PayNow preview modal.
//
// Read-only educational modal mounted on /dashboard. Opens when the third
// row of OnboardingChecklist is tapped (onPreviewPaynow callback). Shows:
//   • A sample invoice line (plumbing repair — S$120)
//   • A client-side-generated QR with a *static sample payload* (no live
//     PayNow key — we can't enrich with real merchant data without the
//     user's PayNow key being set, and this row is specifically for users
//     who haven't done that yet)
//   • "SAMPLE" badge + explicit caption + footer copy so there is zero
//     ambiguity that no money will move
//
// Confirming (or closing) marks the PayNow row complete via tRPC
// markChecklistItem. First-completion-wins on the server preserves the
// original preview timestamp across replays.

// Static payload — the exact string never matters because the modal is
// labelled as a SAMPLE and we render to a data URL client-side. This is
// just enough entropy to produce a realistic-looking QR pattern.
const SAMPLE_PAYLOAD =
  '00020101021226370009SG.PAYNOW010100212+658888888803011040412345520400005303702540612.005802SG5912ServiceSync6009Singapore62230119INV-SAMPLE-000163040F0F';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PayNowPreviewModal({ open, onClose }: Props) {
  const t = useTranslations();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const utils = api.useUtils();
  const markItem = api.provider.markChecklistItem.useMutation({
    onSuccess: () => {
      void utils.provider.getOnboardingChecklist.invalidate();
    },
  });

  // ---- QR generation (client-side, one-shot on open) --------------------
  useEffect(() => {
    if (!open || qrDataUrl) return;
    let cancelled = false;
    QRCode.toDataURL(SAMPLE_PAYLOAD, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((err) => {
        console.warn('[PayNowPreviewModal] QR generation failed:', err);
      });
    return () => {
      cancelled = true;
    };
  }, [open, qrDataUrl]);

  // ---- Lifecycle --------------------------------------------------------
  const openedRef = useRef(false);
  useEffect(() => {
    if (open && !openedRef.current) {
      openedRef.current = true;
      trackEvent('paynow_preview_opened');
    } else if (!open && openedRef.current) {
      openedRef.current = false;
    }
  }, [open]);

  const close = useCallback(
    (reason: 'confirmed' | 'dismissed') => {
      trackEvent('paynow_preview_closed', { reason });
      // Mark-complete is fire-and-forget — first-completion-wins on server
      // and the auto-invalidate refetches the checklist query. The
      // taxonomy event `onboarding_checklist_item_completed` (masterplan
      // §9) fires from OnboardingChecklist's diff-detection once the
      // query returns with the new timestamp — no direct emit from here
      // to avoid duplicates.
      markItem.mutate({ item: 'paynow' });
      onClose();
    },
    [markItem, onClose]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close('dismissed');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) closeBtnRef.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="paynow-preview-backdrop"
          data-testid="paynow-preview-modal"
          variants={modalBackdrop}
          initial="hidden"
          animate="show"
          exit="exit"
          role="dialog"
          aria-modal="true"
          aria-labelledby="paynow-preview-title"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-md"
          onClick={() => close('dismissed')}
          style={{
            paddingTop: 'env(safe-area-inset-top)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <motion.div
            variants={prefersReducedMotion ? undefined : modalContent}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-slate-900/85 shadow-2xl backdrop-blur-xl"
          >
            {/* ---- Header ---- */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div className="min-w-0 flex-1">
                <h2
                  id="paynow-preview-title"
                  className="text-lg font-semibold text-slate-100 sm:text-xl"
                >
                  {t('paynowPreview.title')}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{t('paynowPreview.subtitle')}</p>
              </div>
              <button
                ref={closeBtnRef}
                type="button"
                data-testid="paynow-preview-close"
                onClick={() => close('dismissed')}
                aria-label={t('paynowPreview.ctaDismiss')}
                className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors duration-200 hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              >
                <X className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">{t('paynowPreview.ctaDismiss')}</span>
              </button>
            </div>

            {/* ---- Sample invoice card ---- */}
            <div className="px-6 py-5">
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                <span
                  aria-hidden="true"
                  className="absolute right-4 top-4 inline-flex items-center rounded-full border border-blue-400/40 bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-200"
                >
                  {t('paynowPreview.sampleBadge')}
                </span>

                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {t('paynowPreview.reference')}
                </p>
                <p className="mt-0.5 text-sm font-mono text-slate-300">
                  {t('paynowPreview.referenceValue')}
                </p>

                <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-white/5 pt-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-300">
                      {t('paynowPreview.lineService')}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{t('paynowPreview.lineAmount')}</p>
                  </div>
                  <p className="shrink-0 text-2xl font-semibold tabular-nums text-slate-100">
                    {t('paynowPreview.amountValue')}
                  </p>
                </div>

                {/* ---- QR ---- */}
                <div className="mt-5 flex flex-col items-center gap-2 border-t border-white/5 pt-5">
                  <div className="relative rounded-xl bg-white p-3 shadow-inner">
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="Sample PayNow QR code"
                        width={192}
                        height={192}
                        className="block h-48 w-48"
                      />
                    ) : (
                      <div
                        className="h-48 w-48 animate-pulse rounded bg-slate-200"
                        aria-label="Generating QR code"
                      />
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{t('paynowPreview.sampleCaption')}</p>
                </div>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-slate-400">
                {t('paynowPreview.legal')}
              </p>
            </div>

            {/* ---- Footer CTA ---- */}
            <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4">
              <button
                type="button"
                data-testid="paynow-preview-confirm"
                onClick={() => close('confirmed')}
                disabled={markItem.isPending}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-blue-600/90 px-6 text-base font-semibold text-white shadow-lg transition-colors duration-200 hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-60 cursor-pointer"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {t('paynowPreview.ctaConfirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
