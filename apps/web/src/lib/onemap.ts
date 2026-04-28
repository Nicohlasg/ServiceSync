/**
 * OneMap SG address search utility.
 * Free API, no key needed, Singapore-only addresses.
 * https://www.onemap.gov.sg/apidocs/
 */

export interface OneMapResult {
  address: string;
  blkNo: string;
  roadName: string;
  building: string;
  postalCode: string;
  lat: number;
  lng: number;
}

export async function searchOneMap(query: string): Promise<OneMapResult[]> {
  if (query.length < 3) return [];

  const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).slice(0, 5).map((r: Record<string, string>) => ({
      address: r.ADDRESS,
      blkNo: r.BLK_NO,
      roadName: r.ROAD_NAME,
      building: r.BUILDING,
      postalCode: r.POSTAL,
      lat: parseFloat(r.LATITUDE),
      lng: parseFloat(r.LONGITUDE),
    }));
  } catch {
    return [];
  }
}
