import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input primitive — see docs/DESIGN_SYSTEM.md §11.3 (Form Controls) and
 * §16 (Premium Interaction Principles).
 *
 * Default surface: `glass-input` — a dark, frosted input that already ships
 * a focus-glow (`0 0 0 2px rgba(59,130,246,0.2)`) via globals.css.
 *
 * Premium interaction gates:
 *  - Focus: border shifts to blue-500/50, glow ring, background brightens
 *  - Hover: subtle background shift
 *  - Disabled: 50% opacity, not-allowed cursor
 *
 * Touch target: h-12 (48px) — above the 44×44 WCAG minimum for mobile.
 *
 * Callers can still opt out by passing a full set of bg/border classes;
 * tailwind-merge in `cn()` will let those win.
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Glass surface (focus-glow + placeholder color wired in globals.css)
          "glass-input",
          // Layout & sizing
          "flex h-12 w-full px-4 py-2 text-base",
          // File input bits (kept from shadcn default)
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          // Disabled state
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Mobile touch
          "touch-manipulation",
          // Motion — smooth color/shadow transitions, not transform
          "transition-[background-color,border-color,box-shadow] duration-150 ease-out",
          "motion-reduce:transition-none",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
