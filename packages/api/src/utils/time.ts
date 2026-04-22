/**
 * Singapore timezone helpers (SEC-L1).
 *
 * All business logic (invoices, bookings, IRAS month boundaries) operates in SGT.
 * Use these helpers instead of hardcoding "+08:00" strings throughout the codebase.
 */

export const SG_TIMEZONE_OFFSET = '+08:00';
export const SG_TIMEZONE = 'Asia/Singapore';

export function sgMonthStart(year: number, month: number): string {
    const mm = String(month).padStart(2, '0');
    return `${year}-${mm}-01T00:00:00${SG_TIMEZONE_OFFSET}`;
}

export function sgNextMonthStart(year: number, month: number): string {
    return month === 12
        ? sgMonthStart(year + 1, 1)
        : sgMonthStart(year, month + 1);
}

export function sgYearStart(year: number): string {
    return `${year}-01-01T00:00:00${SG_TIMEZONE_OFFSET}`;
}

export function sgDateTime(dateStr: string, timeStr: string): Date {
    return new Date(`${dateStr}T${timeStr}:00${SG_TIMEZONE_OFFSET}`);
}

export function sgDayStart(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00${SG_TIMEZONE_OFFSET}`);
}
