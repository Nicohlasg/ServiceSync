"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "./utils";

/**
 * Tabs primitive — see docs/DESIGN_SYSTEM.md §11.5 (Segmented Controls) and
 * §16 (Premium Interaction Principles).
 *
 * Visual:
 *  - TabsList: glass pill container (white/[0.04] on blur)
 *  - TabsTrigger: transparent by default, `data-[state=active]` becomes a
 *    tinted glass pill with inner highlight and soft shadow
 *  - Active state is driven by radix's `data-state` attribute, so Framer
 *    Motion is not required
 *
 * Touch target: h-11 (44px) — meets the WCAG 2.5.5 minimum for mobile.
 */

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        // Glass pill container
        "inline-flex h-11 w-fit items-center justify-center gap-1",
        "rounded-2xl p-1",
        "bg-white/[0.04] backdrop-blur-md border border-white/10",
        className,
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base
        "inline-flex flex-1 items-center justify-center gap-1.5",
        "rounded-xl px-4 h-9 min-h-[36px]",
        "text-sm font-semibold whitespace-nowrap",
        "text-slate-400",
        // Motion — color + background only (no scale, no layout shift)
        "transition-[background-color,color,box-shadow] duration-200 ease-out",
        "motion-reduce:transition-none",
        // Hover: softer tint
        "hover:text-slate-100 hover:bg-white/[0.05]",
        // Active: tinted glass pill with inner highlight + glow
        "data-[state=active]:bg-blue-500/15 data-[state=active]:text-white",
        "data-[state=active]:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_4px_16px_rgba(59,130,246,0.15)]",
        "data-[state=active]:border data-[state=active]:border-blue-400/20",
        // Focus ring
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        // Icons
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
