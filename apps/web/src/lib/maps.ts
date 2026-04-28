const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SUPABASE_FUNCTIONS_PATH = process.env.NEXT_PUBLIC_SUPABASE_FUNCTIONS_PATH ?? '';

/** Build edge function base URL, avoiding double slashes when path is empty */
function fnUrl(name: string): string {
    const base = SUPABASE_FUNCTIONS_PATH
        ? `${SUPABASE_URL}/functions/v1/${SUPABASE_FUNCTIONS_PATH}/${name}`
        : `${SUPABASE_URL}/functions/v1/${name}`;
    return base;
}

export interface RouteResult {
    durationText: string; // "22 mins"
    durationValue: number; // seconds
    distanceText: string; // "15 km"
    leaveBy?: string; // "1:30 PM"
    source: "google" | "estimate";
}

const EARTH_RADIUS_KM = 6371;

// Haversine Formula for fallback
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export async function getRouteDetails(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    _arrivalTime?: Date
): Promise<RouteResult> {
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;

    try {
        const response = await fetch(fnUrl('directions'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ origin: originStr, destination: destStr })
        });

        if (response.ok) {
            const data = await response.json();
            const durationMins = Math.ceil(data.duration / 60);
            const distanceKm = (data.distance / 1000).toFixed(1);

            return {
                durationText: `${durationMins} mins`,
                durationValue: data.duration,
                distanceText: `${distanceKm} km`,
                source: "google"
            };
        }
    } catch (e) {
        console.warn("Failed to fetch from server, falling back to estimation", e);
    }

    // Fallback Calculation
    const distKm = getDistanceFromLatLonInKm(origin.lat, origin.lng, destination.lat, destination.lng);
    // Assume 30km/h average speed in city + 5 mins buffer
    const speedKmH = 30;
    const timeHours = distKm / speedKmH;
    const timeMins = Math.ceil(timeHours * 60) + 5;

    return {
        durationText: `~${timeMins} mins`,
        durationValue: timeMins * 60,
        distanceText: `${distKm.toFixed(1)} km`,
        source: "estimate"
    };
}

export function calculateLeaveTime(arrivalTimeStr: string, durationSeconds: number): string {
    // Parse time string "10:00 AM"
    const [time, period] = arrivalTimeStr.split(" ");
    const [hours, minutes] = time.split(":").map(Number);

    const targetDate = new Date();
    let targetHours = hours;
    if (period === "PM" && hours !== 12) targetHours += 12;
    if (period === "AM" && hours === 12) targetHours = 0;

    targetDate.setHours(targetHours, minutes, 0, 0);

    // Subtract duration
    const leaveDate = new Date(targetDate.getTime() - (durationSeconds * 1000));

    return leaveDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export async function geocodeAddress(address: string): Promise<{ address: string; lat: number; lng: number } | null> {
    try {
        const response = await fetch(fnUrl('geocode'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ address })
        });

        if (response.ok) {
            return await response.json();
        }
    } catch (e) {
        console.error("Geocoding failed", e);
    }
    return null;
}
