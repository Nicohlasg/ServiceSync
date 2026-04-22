/**
 * Availability Engine — ServiceSync
 *
 * Route-optimized scheduling using haversine distance for travel time estimation.
 * Singapore-optimized: ~50km across, well-connected roads, 40km/h average speed.
 */

import { getAdminClient } from './supabase-admin';
import { SG_TIMEZONE_OFFSET, sgDayStart } from '../utils/time';

const supabase = getAdminClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvailableSlot {
  arrivalWindowStart: string;   // ISO timestamp
  arrivalWindowEnd: string;     // ISO timestamp (30-min window)
  estimatedDuration: number;    // minutes
  estimatedCompletion: string;  // ISO timestamp
  travelFromPrevious: number;   // minutes
}

export interface AvailabilityRequest {
  providerId: string;
  date: string;                 // YYYY-MM-DD
  serviceDurationMinutes: number;
  clientLat?: number;
  clientLng?: number;
}

interface ScheduledJob {
  id: string;
  arrivalWindowStart: string;
  arrivalWindowEnd: string;
  estimatedDurationMinutes: number;
  lat: number | null;
  lng: number | null;
}

interface TimeBlock {
  start: Date;
  end: Date;
  label: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVERAGE_SPEED_KMH = 40;          // Singapore average driving speed
const TRAVEL_BUFFER_MINUTES = 15;      // Buffer for parking, lift, etc.
const ARRIVAL_WINDOW_MINUTES = 30;     // Homeowner sees a 30-min arrival window
const EARTH_RADIUS_KM = 6371;
const SLOT_GRANULARITY_MINUTES = 15;   // Check availability every 15 min

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns available booking slots for a technician on a given date.
 * Accounts for: existing bookings, travel time, lunch break, schedule blocks.
 */
export async function getAvailableSlots(
  request: AvailabilityRequest
): Promise<AvailableSlot[]> {
  const { providerId, date, serviceDurationMinutes, clientLat, clientLng } = request;

  // 1. Fetch technician profile (working hours + base location)
  const { data: profile } = await supabase
    .from('profiles')
    .select('working_hours, base_lat, base_lng')
    .eq('id', providerId)
    .single();

  if (!profile) return [];

  const dayOfWeek = getDayKey(sgDayStart(date));
  const workingHours = (profile.working_hours as Record<string, { start: string; end: string } | null>)?.[dayOfWeek];

  if (!workingHours) return []; // Day off

  const dayStart = parseTime(date, workingHours.start);
  const dayEnd = parseTime(date, workingHours.end);

  // 2. Fetch existing accepted bookings for that date
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, arrival_window_start, arrival_window_end, estimated_duration_minutes, lat, lng')
    .eq('provider_id', providerId)
    .eq('scheduled_date', date)
    .in('status', ['accepted', 'in_progress'])
    .order('arrival_window_start', { ascending: true });

  const existingJobs: ScheduledJob[] = (bookings ?? []).map((b: any) => ({
    id: b.id,
    arrivalWindowStart: b.arrival_window_start,
    arrivalWindowEnd: b.arrival_window_end,
    estimatedDurationMinutes: b.estimated_duration_minutes ?? 60,
    lat: b.lat,
    lng: b.lng,
  }));

  // 3. Fetch schedule blocks (lunch, custom blocks)
  const { data: blocks } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('provider_id', providerId)
    .eq('is_active', true)
    .or(`block_date.eq.${date},block_type.eq.recurring,block_type.eq.lunch`);

  const timeBlocks = parseScheduleBlocks(blocks ?? [], date, dayOfWeek);

  // 4. Build list of busy periods (existing jobs + blocks)
  const busyPeriods: TimeBlock[] = [];

  for (const job of existingJobs) {
    const jobStart = new Date(job.arrivalWindowStart);
    const jobEnd = new Date(jobStart.getTime() + job.estimatedDurationMinutes * 60_000);
    busyPeriods.push({ start: jobStart, end: jobEnd, label: 'job' });
  }

  busyPeriods.push(...timeBlocks);
  busyPeriods.sort((a, b) => a.start.getTime() - b.start.getTime());

  // 5. Find available windows
  const slots: AvailableSlot[] = [];
  let cursor = new Date(dayStart);

  while (cursor.getTime() + serviceDurationMinutes * 60_000 <= dayEnd.getTime()) {
    // Calculate travel time from previous job or base
    const prevJob = findPreviousJob(cursor, existingJobs);
    const prevLat = prevJob?.lat ?? profile.base_lat;
    const prevLng = prevJob?.lng ?? profile.base_lng;

    let travelMinutes = 0;
    if (clientLat && clientLng && prevLat && prevLng) {
      const distKm = haversineDistance(prevLat, prevLng, clientLat, clientLng);
      travelMinutes = Math.ceil((distKm / AVERAGE_SPEED_KMH) * 60) + TRAVEL_BUFFER_MINUTES;
    } else {
      travelMinutes = TRAVEL_BUFFER_MINUTES; // Default buffer when no coordinates
    }

    const slotStart = new Date(cursor.getTime() + travelMinutes * 60_000);
    const slotEnd = new Date(slotStart.getTime() + serviceDurationMinutes * 60_000);

    // Check if slot conflicts with any busy period
    const hasConflict = busyPeriods.some(busy =>
      slotStart.getTime() < busy.end.getTime() && slotEnd.getTime() > busy.start.getTime()
    );

    // Check if slot fits within working hours
    const fitsInDay = slotStart.getTime() >= dayStart.getTime() && slotEnd.getTime() <= dayEnd.getTime();

    if (!hasConflict && fitsInDay) {
      const windowEnd = new Date(slotStart.getTime() + ARRIVAL_WINDOW_MINUTES * 60_000);
      slots.push({
        arrivalWindowStart: slotStart.toISOString(),
        arrivalWindowEnd: windowEnd.toISOString(),
        estimatedDuration: serviceDurationMinutes,
        estimatedCompletion: slotEnd.toISOString(),
        travelFromPrevious: travelMinutes,
      });
    }

    cursor = new Date(cursor.getTime() + SLOT_GRANULARITY_MINUTES * 60_000);
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Haversine Distance
// ---------------------------------------------------------------------------

/**
 * Calculates the great-circle distance between two points (km).
 * Accurate enough for Singapore (~50km across).
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDayKey(date: Date): string {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  // Use SGT timezone to avoid wrong day-of-week on UTC servers
  const dayIndex = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Singapore',
  }).format(date);
  const mapped: Record<string, string> = { Sun: 'sun', Mon: 'mon', Tue: 'tue', Wed: 'wed', Thu: 'thu', Fri: 'fri', Sat: 'sat' };
  return mapped[dayIndex] ?? days[date.getDay()];
}

function parseTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}:00${SG_TIMEZONE_OFFSET}`);
}

function parseScheduleBlocks(
  blocks: any[],
  date: string,
  dayOfWeek: string
): TimeBlock[] {
  const dayIndex = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(dayOfWeek);
  const result: TimeBlock[] = [];

  for (const block of blocks) {
    if (!block.is_active) continue;

    const isApplicable =
      (block.block_type === 'one_off' && block.block_date === date) ||
      (block.block_type === 'recurring' && block.day_of_week === dayIndex) ||
      (block.block_type === 'lunch' && (block.block_date === date || block.day_of_week === dayIndex));

    if (!isApplicable) continue;

    if (block.start_time && block.end_time) {
      result.push({
        start: parseTime(date, block.start_time),
        end: parseTime(date, block.end_time),
        label: block.label || block.block_type,
      });
    }
  }

  return result;
}

function findPreviousJob(
  cursor: Date,
  jobs: ScheduledJob[]
): ScheduledJob | null {
  let prev: ScheduledJob | null = null;
  for (const job of jobs) {
    const jobEnd = new Date(
      new Date(job.arrivalWindowStart).getTime() + job.estimatedDurationMinutes * 60_000
    );
    if (jobEnd.getTime() <= cursor.getTime()) {
      prev = job;
    }
  }
  return prev;
}
