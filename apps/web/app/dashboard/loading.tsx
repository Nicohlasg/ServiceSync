import {
  SkeletonStat,
  SkeletonCard,
  SkeletonLine,
} from "@/components/ui/skeleton";

/**
 * Dashboard overview skeleton — see docs/DESIGN_SYSTEM.md §16.3.
 * Shape-matched: stat tiles up top, then today's jobs cards.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Page title placeholder */}
      <div className="space-y-2">
        <SkeletonLine width="45%" className="h-7" />
        <SkeletonLine width="65%" className="h-4" />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
        <SkeletonStat />
      </div>

      {/* Today's jobs */}
      <div className="space-y-3">
        <SkeletonLine width="35%" className="h-5" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
