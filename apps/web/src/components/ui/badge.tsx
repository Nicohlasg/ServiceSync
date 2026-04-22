import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge primitive — see docs/DESIGN_SYSTEM.md §11.4 (Status & Chips) and
 * §16.1 (60/30/10 Color Rule).
 *
 * Badges are the 10% accent layer. They must never use raw saturated fills
 * (bg-red-500, bg-yellow-500) — that breaks the dark-glass harmony and
 * violates 60/30/10. Instead, each tone uses a tinted translucent background
 * + matching ring + high-contrast foreground text.
 *
 * Tones:
 *  - default / secondary / outline — neutral states
 *  - info     → blue    (primary accent)
 *  - success  → emerald (positive outcome)
 *  - warning  → amber   (needs attention, not an error)
 *  - danger   → rose    (error, destructive)
 */
const badgeVariants = cva(
  [
    "inline-flex items-center rounded-full border px-2.5 py-0.5",
    "text-xs font-semibold whitespace-nowrap",
    "transition-colors duration-150 ease-out",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    "motion-reduce:transition-none",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "border-blue-400/30 bg-blue-500/15 text-blue-100 backdrop-blur-sm",
        secondary:
          "border-white/10 bg-white/[0.06] text-slate-200 backdrop-blur-sm",
        destructive:
          "border-rose-400/30 bg-rose-500/15 text-rose-100 backdrop-blur-sm",
        outline:
          "border-white/20 bg-transparent text-slate-200",
        // Semantic tones (preferred going forward)
        info:
          "border-blue-400/30 bg-blue-500/15 text-blue-100 backdrop-blur-sm",
        success:
          "border-emerald-400/30 bg-emerald-500/15 text-emerald-100 backdrop-blur-sm",
        warning:
          "border-amber-400/30 bg-amber-500/15 text-amber-100 backdrop-blur-sm",
        danger:
          "border-rose-400/30 bg-rose-500/15 text-rose-100 backdrop-blur-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
