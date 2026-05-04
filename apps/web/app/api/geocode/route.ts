/**
 * /api/geocode — Server-side proxy for OneMap SG address search.
 *
 * Why a proxy?
 * 1. The browser CSP (connect-src) blocks direct calls to onemap.gov.sg.
 * 2. OneMap now requires a Bearer token — keeping it server-side means we
 *    can add the token from env without exposing it to the client.
 * 3. Centralises geocoding so we can swap providers later without touching UI.
 *
 * GET /api/geocode?q=<searchTerm>
 * Returns: { results: OneMapResult[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkHttpRateLimit } from '@servicesync/api';
import { getOneMapToken } from '@/lib/onemap-token';

export const runtime = 'nodejs';

interface OneMapRaw {
    ADDRESS: string;
    BLK_NO: string;
    ROAD_NAME: string;
    BUILDING: string;
    POSTAL: string;
    LATITUDE: string;
    LONGITUDE: string;
}

export async function GET(req: NextRequest) {
    // Rate limit: 60 geocode searches/min per IP
    // TODO: Raise to 120/min when user base exceeds 500 active users.
    const limited = await checkHttpRateLimit(req, 'geocode');
    if (limited) return limited;

    const q = req.nextUrl.searchParams.get('q') ?? '';
    if (q.length < 3) {
        return NextResponse.json({ results: [] });
    }

    try {
        const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(q)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };

        const token = await getOneMapToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(url, { headers, next: { revalidate: 60 } });
        if (!res.ok) {
            return NextResponse.json({ results: [] });
        }

        const data = await res.json() as { results?: OneMapRaw[] };
        const results = (data.results ?? []).slice(0, 8).map((r: OneMapRaw) => ({
            address: r.ADDRESS,
            blkNo: r.BLK_NO,
            roadName: r.ROAD_NAME,
            building: r.BUILDING,
            postalCode: r.POSTAL,
            lat: parseFloat(r.LATITUDE),
            lng: parseFloat(r.LONGITUDE),
        }));

        return NextResponse.json({ results });
    } catch {
        return NextResponse.json({ results: [] });
    }
}
