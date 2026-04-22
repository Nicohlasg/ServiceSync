import {
  SkeletonCard,
  SkeletonLine,
  SkeletonStat,
} from "@/components/ui/skeleton";

/**
 * Invoices list skeleton — see docs/DESIGN_SYSTEM.md §16.3.
 * Shape-matched: totals strip at top, then invoice cards.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonLine width="40%" className="h-7" />
        <SkeletonLine width="110px" className="h-10 rounded-xl" />
      </div>

      {/* Totals strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat className="hidden md:block" />
      </div>

      {/* Invoice cards */}
      <div className="space-y-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
