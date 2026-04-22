"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Button primitive — see docs/DESIGN_SYSTEM.md §11.1 and §16.4.
 *
 * Premium interaction gates:
 *  - Hover:    bg shift + subtle -1px lift + glow (primary)
 *  - Press:    CSS active:scale-[0.96] with spring-like cubic-bezier
 *  - Focus:    2px blue-500 ring with 2px offset
 *  - Disabled: 50% opacity + cursor-not-allowed (no hover/press reaction)
 *
 * Uses a plain <button> instead of framer-motion's motion.button to avoid
 * iOS Safari touch event conflicts (whileTap swallows pointer events inside
 * backdrop-filter compositing layers, preventing click/submit from firing).
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center whitespace-nowrap cursor-pointer",
    "rounded-xl text-base font-semibold ring-offset-background",
    "transition-[background-color,box-shadow,color,border-color,transform] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-50",
    "touch-manipulation select-none",
    "active:scale-[0.96] active:transition-transform active:duration-100",
  ].join(" "),
  {
    variants: {
      variant: {
        default: [
          "bg-blue-600 text-white shadow-lg shadow-blue-500/20",
          "hover:bg-blue-700 hover:-translate-y-px hover:shadow-xl hover:shadow-blue-500/30",
        ].join(" "),
        destructive: [
          "bg-red-500 text-white shadow-lg shadow-red-500/20",
          "hover:bg-red-600 hover:-translate-y-px hover:shadow-xl hover:shadow-red-500/30",
        ].join(" "),
        outline: [
          "border-2 border-slate-200 bg-background text-foreground",
          "hover:bg-slate-100 hover:text-slate-900 hover:border-slate-300",
        ].join(" "),
        secondary: [
          "bg-slate-100 text-slate-900",
          "hover:bg-slate-200 hover:-translate-y-px",
        ].join(" "),
        ghost: [
          "text-foreground",
          "hover:bg-white/10 hover:text-white",
        ].join(" "),
        link: "text-blue-500 underline-offset-4 hover:underline",
        glass: [
          "bg-white/10 backdrop-blur-md border border-white/20 text-white",
          "hover:bg-white/20 hover:border-white/30 hover:-translate-y-px",
          "hover:shadow-lg hover:shadow-black/20",
        ].join(" "),
        "glass-primary": [
          "bg-blue-600/20 backdrop-blur-md border border-blue-400/30 text-white",
          "shadow-glass-glow",
          "hover:bg-blue-600/30 hover:border-blue-400/50 hover:-translate-y-px",
        ].join(" "),
      },
      size: {
        default: "h-12 px-6 py-3",
        sm: "h-10 rounded-lg px-4 text-sm",
        lg: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot
          ref={ref}
          className={cn(
            buttonVariants({ variant, size }),
            className,
          )}
          // @ts-expect-error — Slot passes the disabled attr to its child
          disabled={disabled}
          {...props}
        >
          {children}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
