import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-394f5af5/health", (c) => {
  return c.json({ status: "ok" });
});

app.post("/make-server-394f5af5/directions", async (c) => {
  try {
    const { origin, destination } = await c.req.json();
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return c.json({ error: "No API Key" }, 404);
    }

    // Call Google Maps Distance Matrix API
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}&mode=driving&traffic_model=best_guess&departure_time=now`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK" && data.rows[0].elements[0].status === "OK") {
        const element = data.rows[0].elements[0];
        return c.json({
            distance: element.distance.value, // meters
            duration: element.duration_in_traffic ? element.duration_in_traffic.value : element.duration.value, // seconds
            source: "google"
        });
    } else {
        console.error("Google Maps API Error:", data);
        return c.json({ error: "Google Maps API returned invalid data" }, 500);
    }

  } catch (error) {
    console.error("Directions Error:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

app.post("/make-server-394f5af5/geocode", async (c) => {
  try {
    const { address } = await c.req.json();
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");

    if (!apiKey) {
      return c.json({ error: "No API Key" }, 404);
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}&components=country:SG`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
        const result = data.results[0];
        return c.json({
            address: result.formatted_address,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng
        });
    } else {
        return c.json({ error: "Address not found" }, 400);
    }
  } catch (error) {
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

Deno.serve(app.fetch);