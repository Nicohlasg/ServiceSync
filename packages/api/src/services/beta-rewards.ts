// BETA-ONLY: REMOVE FOR PUBLIC LAUNCH

const MILESTONES = [5, 10, 15, 20] as const;

export function computeEarnings(verifiedCount: number): {
  dollars: number;
  nextMilestone: number | null;
} {
  const milestonesHit = MILESTONES.filter((m) => m <= verifiedCount).length;
  const dollars = verifiedCount + milestonesHit * 3;
  const nextMilestone = MILESTONES.find((m) => m > verifiedCount) ?? null;
  return { dollars, nextMilestone };
}
