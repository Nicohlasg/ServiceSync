/**
 * SGT-aware date arithmetic — Sprint 3 Task 3.4.
 *
 * Singapore Standard Time (UTC+8) never observes DST, so the offset is
 * constant. We avoid the UTC-date pitfall where a payment at 11:30 PM SGT
 * (= 15:30 UTC same day) shifts `next_service_date` to the wrong calendar
 * day when naive `Date.setDate()` operates in UTC.
 *
 * Strategy: convert to SGT wall-clock, add days, convert back to ISO string.
 */

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000; // +08:00

/**
 * Adds `days` to an ISO date string using Singapore wall-clock dates.
 *
 * Returns an ISO string at midnight SGT of the target date so that
 * `next_service_date` always lands on the expected calendar day in SG.
 */
export function addDaysSGT(isoDate: string, days: number): string {
  const utcMs = new Date(isoDate).getTime();
  // Shift to SGT wall-clock
  const sgtMs = utcMs + SGT_OFFSET_MS;
  const sgtDate = new Date(sgtMs);
  // Add days in SGT
  sgtDate.setUTCDate(sgtDate.getUTCDate() + days);
  // Set to midnight SGT (= 16:00 UTC previous day)
  sgtDate.setUTCHours(0, 0, 0, 0);
  // Shift back to UTC
  const resultUtcMs = sgtDate.getTime() - SGT_OFFSET_MS;
  return new Date(resultUtcMs).toISOString();
}
