import {
  SkeletonCard,
  SkeletonLine,
} from "@/components/ui/skeleton";

/**
 * Schedule page skeleton — see docs/DESIGN_SYSTEM.md §16.3.
 * Shape-matched: day picker strip at top, then job cards grouped by time.
 */
export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonLine width="40%" className="h-7" />
        <SkeletonLine width="90px" className="h-10 rounded-xl" />
      </div>

      {/* Day picker strip */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonLine
            key={i}
            width="56px"
            className="h-16 rounded-2xl shrink-0"
          />
        ))}
      </div>

      {/* Job cards */}
      <div className="space-y-3">
        <SkeletonLine width="30%" className="h-4" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonLine width="30%" className="h-4 mt-6" />
        <SkeletonCard />
      </div>
    </div>
  );
}
