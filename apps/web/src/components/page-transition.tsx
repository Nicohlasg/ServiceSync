"use client";

import { motion, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";

/**
 * PageTransition — wraps a route's content with a gentle fade + slight upward
 * drift on mount. See docs/DESIGN_SYSTEM.md §16.5 (Page Transitions).
 *
 * Rules:
 *  - Subtle only. Page transitions are a supporting detail, not a main event.
 *  - `spring.gentle` (damping 35 / stiffness 180) — barely perceptible lift.
 *  - Respect `prefers-reduced-motion` — fall back to a pure fade.
 */
export function PageTransition({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      transition={prefersReducedMotion ? { duration: 0.15 } : spring.gentle}
    >
      {children}
    </motion.div>
  );
}
