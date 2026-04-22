'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';

// motion-spec.md §Coachmark (Post-Tour). Pulse ring over the MobileNav Home
// icon, auto-dismiss after 3 s or on any tap. Skipped entirely under
// prefers-reduced-motion.
//
// Positioning: this component is a child of MobileNav (or absolutely placed
// alongside it). It expects the parent to anchor it to the Home tab.
interface Props {
  onDismiss: () => void;
}

export function TutorialCoachmark({ onDismiss }: Props) {
  const prefersReducedMotion = useReducedMotion();

  // Dismiss handlers: 3 s auto + any tap.
  useEffect(() => {
    if (prefersReducedMotion) {
      onDismiss();
      return;
    }
    const t = window.setTimeout(onDismiss, 3_000);
    const anyTap = () => onDismiss();
    document.addEventListener('click', anyTap, { once: true });
    return () => {
      clearTimeout(t);
      document.removeEventListener('click', anyTap);
    };
  }, [onDismiss, prefersReducedMotion]);

  if (prefersReducedMotion) return null;

  return (
    <motion.div
      data-testid="tutorial-coachmark"
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-400"
      initial={{ opacity: 1, boxShadow: '0 0 0 0 rgba(59,130,246,0.4)' }}
      animate={{
        opacity: [1, 1, 0],
        boxShadow: [
          '0 0 0 0 rgba(59,130,246,0.4)',
          '0 0 0 20px rgba(59,130,246,0)',
          '0 0 0 20px rgba(59,130,246,0)',
        ],
      }}
      transition={{ duration: 2.8, times: [0, 0.5, 1], ease: 'easeOut', repeat: 1 }}
    />
  );
}
