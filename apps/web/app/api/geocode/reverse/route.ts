/**
 * /api/geocode/reverse — Server-side proxy for OneMap reverse geocoding.
 * Converts GPS coordinates into a human-readable Singapore address.
 *
 * GET /api/geocode/reverse?lat=1.3521&lng=103.8198
 * Returns: { address: string | null }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOneMapToken } from '@/lib/onemap-token';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
    const lat = req.nextUrl.searchParams.get('lat');
    const lng = req.nextUrl.searchParams.get('lng');

    if (!lat || !lng) {
        return NextResponse.json({ address: null });
    }

    try {
        const headers: Record<string, string> = { 'Accept': 'application/json' };
        const token = await getOneMapToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const url = `https://www.onemap.gov.sg/api/public/revgeocode?location=${lat},${lng}&buffer=50&addressType=All`;
        const res = await fetch(url, { headers, next: { revalidate: 60 } });

        if (!res.ok) return NextResponse.json({ address: null });

        const data = await res.json() as { GeocodeInfo?: { BLOCK?: string; ROAD?: string; POSTALCODE?: string }[] };
        const first = data.GeocodeInfo?.[0];

        if (first?.ROAD) {
            const address = [first.BLOCK, first.ROAD, first.POSTALCODE].filter(Boolean).join(' ');
            return NextResponse.json({ address });
        }

        return NextResponse.json({ address: null });
    } catch {
        return NextResponse.json({ address: null });
    }
}
