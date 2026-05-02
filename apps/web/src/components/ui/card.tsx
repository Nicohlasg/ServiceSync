import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card primitive — see docs/DESIGN_SYSTEM.md §11.2 (Surface Hierarchy) and
 * §16 (Premium Interaction Principles).
 *
 * Default surface: `glass-card glass-inner-light` — a blurred, dark-tinted
 * panel with an inner-light highlight. Matches the rest of the app's
 * surfaces so page authors don't need to keep re-applying:
 *
 *   <Card className="bg-slate-900/65 backdrop-blur-md border-white/15 ..." />
 *
 * Variants:
 *  - "glass"   (default) — standard dark glass panel
 *  - "premium" — extra light, high-transparency glass matching home page hero
 *  - "tinted"  — blue-tinted glass (CTAs, promos)
 *  - "plain"   — opt out of glass entirely (legacy light surface)
 */

type CardVariant = "glass" | "premium" | "tinted" | "plain";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const cardBaseByVariant: Record<CardVariant, string> = {
  glass: "glass-card glass-inner-light text-white",
  premium: "relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl text-white",
  tinted: "glass-card-tinted glass-inner-light text-white",
  plain:
    "rounded-2xl border border-slate-200 bg-white text-slate-950 shadow-sm",
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "glass", children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardBaseByVariant[variant], className)}
      {...props}
    >
      {(variant === "glass" || variant === "premium" || variant === "tinted") && (
        <div 
          aria-hidden="true"
          className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none z-0" 
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-bold leading-none tracking-tight text-white",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-slate-300", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
