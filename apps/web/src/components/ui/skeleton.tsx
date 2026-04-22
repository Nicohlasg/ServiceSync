"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton primitives — see docs/DESIGN_SYSTEM.md §16.3 (Skeleton Psychology).
 *
 * Rules:
 *   1. Shape-matched — use the content-shaped compounds (SkeletonCard,
 *      SkeletonListRow, SkeletonStat) rather than raw rectangles.
 *   2. Directional shimmer — shimmer travels left → right in LTR locales.
 *      Reversing it feels wrong.
 *   3. Never use a spinner where a skeleton will do. Spinners are only for
 *      (a) full-page initial load and (b) inline button loading states.
 */

const shimmerBase =
  "relative overflow-hidden isolate " +
  "bg-white/[0.06] " +
  "before:absolute before:inset-0 before:-translate-x-full " +
  "before:animate-[shimmer_2s_linear_infinite] " +
  "before:bg-gradient-to-r before:from-transparent before:via-white/[0.08] before:to-transparent " +
  "motion-reduce:before:animate-none";

/** Light-mode shimmer for public / light-background pages. */
const shimmerLight =
  "relative overflow-hidden isolate " +
  "bg-slate-200/60 " +
  "before:absolute before:inset-0 before:-translate-x-full " +
  "before:animate-[shimmer_2s_linear_infinite] " +
  "before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent " +
  "motion-reduce:before:animate-none";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(shimmerBase, "rounded-md", className)}
      {...props}
    />
  );
}

/** A single line of text — pass `width` to hint line length. */
function SkeletonLine({
  className,
  width = "100%",
  ...props
}: React.ComponentProps<"div"> & { width?: string | number }) {
  return (
    <div
      data-slot="skeleton-line"
      className={cn(shimmerBase, "h-4 rounded-full", className)}
      style={{ width, ...props.style }}
      {...props}
    />
  );
}

/** A circular placeholder — avatars, icons. */
function SkeletonCircle({
  className,
  size = 40,
  ...props
}: React.ComponentProps<"div"> & { size?: number }) {
  return (
    <div
      data-slot="skeleton-circle"
      className={cn(shimmerBase, "rounded-full shrink-0", className)}
      style={{ width: size, height: size, ...props.style }}
      {...props}
    />
  );
}

/** A rectangular block — media, hero images. */
function SkeletonBlock({
  className,
  aspect = "video",
  ...props
}: React.ComponentProps<"div"> & { aspect?: "video" | "square" | "auto" }) {
  const aspectClass =
    aspect === "video" ? "aspect-video" : aspect === "square" ? "aspect-square" : "";
  return (
    <div
      data-slot="skeleton-block"
      className={cn(shimmerBase, "rounded-xl w-full", aspectClass, className)}
      {...props}
    />
  );
}

/** Content-shaped skeleton for a single card (header + body + action). */
function SkeletonCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-card"
      className={cn(
        "glass-card glass-inner-light rounded-2xl p-6 space-y-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <SkeletonCircle size={40} />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="60%" />
          <SkeletonLine width="40%" className="h-3" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonLine width="100%" />
        <SkeletonLine width="85%" />
      </div>
      <SkeletonLine width="30%" className="h-10 rounded-xl" />
    </div>
  );
}

/** Content-shaped skeleton for a list row (avatar + two lines of text). */
function SkeletonListRow({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-list-row"
      className={cn("flex items-center gap-3 py-3", className)}
      {...props}
    >
      <SkeletonCircle size={44} />
      <div className="flex-1 space-y-2">
        <SkeletonLine width="55%" />
        <SkeletonLine width="35%" className="h-3" />
      </div>
    </div>
  );
}

/** Content-shaped skeleton for a dashboard stat tile (label + number). */
function SkeletonStat({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-stat"
      className={cn(
        "glass-card glass-inner-light rounded-2xl p-6 space-y-3",
        className,
      )}
      {...props}
    >
      <SkeletonLine width="50%" className="h-3" />
      <SkeletonLine width="40%" className="h-8" />
    </div>
  );
}

/** Light-mode single line. */
function SkeletonLineLight({
  className,
  width = "100%",
  ...props
}: React.ComponentProps<"div"> & { width?: string | number }) {
  return (
    <div
      data-slot="skeleton-line-light"
      className={cn(shimmerLight, "h-4 rounded-full", className)}
      style={{ width, ...props.style }}
      {...props}
    />
  );
}

/** Light-mode circle. */
function SkeletonCircleLight({
  className,
  size = 40,
  ...props
}: React.ComponentProps<"div"> & { size?: number }) {
  return (
    <div
      data-slot="skeleton-circle-light"
      className={cn(shimmerLight, "rounded-full shrink-0", className)}
      style={{ width: size, height: size, ...props.style }}
      {...props}
    />
  );
}

/** Light-mode block. */
function SkeletonBlockLight({
  className,
  aspect = "video",
  ...props
}: React.ComponentProps<"div"> & { aspect?: "video" | "square" | "auto" }) {
  const aspectClass =
    aspect === "video" ? "aspect-video" : aspect === "square" ? "aspect-square" : "";
  return (
    <div
      data-slot="skeleton-block-light"
      className={cn(shimmerLight, "rounded-xl w-full", aspectClass, className)}
      {...props}
    />
  );
}

/** Light-mode card skeleton. */
function SkeletonCardLight({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-card-light"
      className={cn(
        "bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-4",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        <SkeletonCircleLight size={40} />
        <div className="flex-1 space-y-2">
          <SkeletonLineLight width="60%" />
          <SkeletonLineLight width="40%" className="h-3" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonLineLight width="100%" />
        <SkeletonLineLight width="85%" />
      </div>
      <SkeletonLineLight width="30%" className="h-10 rounded-xl" />
    </div>
  );
}

export {
  Skeleton,
  SkeletonLine,
  SkeletonCircle,
  SkeletonBlock,
  SkeletonCard,
  SkeletonListRow,
  SkeletonStat,
  SkeletonLineLight,
  SkeletonCircleLight,
  SkeletonBlockLight,
  SkeletonCardLight,
};
