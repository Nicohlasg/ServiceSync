import {
  SkeletonListRow,
  SkeletonLine,
} from "@/components/ui/skeleton";

/**
 * Clients list skeleton — see docs/DESIGN_SYSTEM.md §16.3.
 * Shape-matched to the client list (avatar + name + phone rows).
 */
export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <SkeletonLine width="35%" className="h-7" />
        <SkeletonLine width="90px" className="h-10 rounded-xl" />
      </div>

      {/* Search bar */}
      <SkeletonLine width="100%" className="h-11 rounded-xl" />

      {/* Client rows */}
      <div className="glass-card glass-inner-light rounded-2xl px-4 divide-y divide-white/5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonListRow key={i} />
        ))}
      </div>
    </div>
  );
}
