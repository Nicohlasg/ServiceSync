/**
 * Shared motion tokens — the single source of truth for animation physics.
 *
 * All UI primitives (Button, Dialog, Skeleton, etc.) and all page-level
 * animations must import spring/exit/stagger tokens from this file. Never
 * hand-roll `{ type: "spring", damping: 17, ... }` inline — the whole point
 * of tokens is that "premium feel" is consistent across the app.
 *
 * See docs/DESIGN_SYSTEM.md §16 (Premium Interaction Principles) and §17
 * (Motion Tokens) for the rationale behind these values.
 */

import type { Transition, Variants } from "framer-motion";

/** Spring physics — one set of values, four named intents. */
export const spring = {
  /** Button tap rebound — snappy, playful, scale down & back. */
  press: { type: "spring", damping: 15, stiffness: 400, mass: 0.5 } satisfies Transition,
  /** Modal entrance — noticeable overshoot, arrives with confidence. */
  lift: { type: "spring", damping: 22, stiffness: 320, mass: 0.8 } satisfies Transition,
  /** Card hover lift — soft, settled, never jittery. */
  settle: { type: "spring", damping: 28, stiffness: 260, mass: 1.0 } satisfies Transition,
  /** Page transitions — gentle, barely visible, never steals focus. */
  gentle: { type: "spring", damping: 35, stiffness: 180, mass: 1.2 } satisfies Transition,
};

/**
 * Exit transition — resolved, smooth, NO spring.
 * A modal closing should feel decisive, not bouncy.
 */
export const exitEase: Transition = { duration: 0.18, ease: [0.4, 0, 1, 1] };

/**
 * Stagger container — use with motion.* children that carry `staggerItem`.
 *
 *   <motion.div variants={stagger} initial="hidden" animate="show">
 *     <motion.h2 variants={staggerItem}>Title</motion.h2>
 *     <motion.p  variants={staggerItem}>Body</motion.p>
 *   </motion.div>
 */
export const stagger: Variants = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.08 },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: spring.lift },
};

/**
 * Fade-only variants — used as a reduced-motion fallback.
 * When `useReducedMotion()` returns true, swap to these.
 */
export const fade: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

/** Modal entrance variants — spring overshoot with slight upward drift. */
export const modalContent: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 12 },
  show: { opacity: 1, scale: 1, y: 0, transition: spring.lift },
  exit: { opacity: 0, scale: 0.96, y: 4, transition: exitEase },
};

/** Modal backdrop variants — pure fade, no movement. */
export const modalBackdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } },
  exit: { opacity: 0, transition: exitEase },
};
