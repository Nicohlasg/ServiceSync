'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useTranslations } from 'next-intl';

// motion-spec.md §Progress Indicator. Seven pills; active pill fills left→right
// over the step's dwell, paused by `paused`. Completed pills stay solid.
interface Props {
  currentIndex: number;
  total: number;
  dwellMs: number | null;
  paused: boolean;
}

export function TutorialProgress({ currentIndex, total, dwellMs, paused }: Props) {
  const t = useTranslations('tutorial');
  const prefersReducedMotion = useReducedMotion();
  // dwellMs === null → step 7, no timer; just render active pill as fully filled.
  const hasTimer = dwellMs !== null && !prefersReducedMotion;

  return (
    <div
      className="flex items-center justify-center gap-1.5"
      role="progressbar"
      aria-label={t('progress', { current: currentIndex + 1, total })}
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={total}
    >
      {Array.from({ length: total }).map((_, i) => {
        const isCompleted = i < currentIndex;
        const isActive = i === currentIndex;

        // Base pill sizing: active is wider to draw the eye.
        const base = isActive ? 'w-10' : 'w-6';
        const bg = isCompleted
          ? 'bg-white/60'
          : isActive
            ? 'bg-white/15'
            : 'bg-white/15';

        return (
          <div key={i} className={`relative h-1 ${base} overflow-hidden rounded-full ${bg}`}>
            {isActive && (
              <motion.div
                key={`fill-${currentIndex}-${paused ? 'paused' : 'running'}`}
                className="absolute inset-y-0 left-0 bg-white/90"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: hasTimer && !paused ? 1 : 1 }}
                transition={{
                  duration: hasTimer && !paused ? (dwellMs ?? 0) / 1000 : 0,
                  ease: 'linear',
                }}
                style={{ transformOrigin: 'left', width: '100%' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
