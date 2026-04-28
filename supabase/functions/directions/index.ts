import "@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!GOOGLE_MAPS_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Google Maps API key not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { origin, destination, departure_time } = await req.json();

    if (!origin || !destination) {
      return new Response(
        JSON.stringify({ error: "origin and destination are required (format: 'lat,lng')" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Build Google Directions API URL
    const params = new URLSearchParams({
      origin,
      destination,
      mode: "driving",
      key: GOOGLE_MAPS_API_KEY,
      region: "sg",
      units: "metric",
    });

    // Use departure_time for traffic-aware routing
    // "now" gives real-time traffic; a Unix timestamp gives predicted traffic
    if (departure_time) {
      params.set("departure_time", departure_time);
    } else {
      params.set("departure_time", "now");
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?${params}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" || !data.routes?.length) {
      return new Response(
        JSON.stringify({ error: `Google API error: ${data.status}`, details: data.error_message }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const leg = data.routes[0].legs[0];

    // duration_in_traffic is only available when departure_time is set
    const duration = leg.duration_in_traffic?.value ?? leg.duration.value; // seconds
    const durationText = leg.duration_in_traffic?.text ?? leg.duration.text;
    const distance = leg.distance.value; // metres
    const distanceText = leg.distance.text;

    return new Response(
      JSON.stringify({
        duration,
        durationText,
        distance,
        distanceText,
        startAddress: leg.start_address,
        endAddress: leg.end_address,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
