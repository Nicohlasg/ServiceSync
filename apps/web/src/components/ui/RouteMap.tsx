"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default icon broken in webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function createNumberedIcon(num: number, done: boolean) {
  const bg = done ? "#22c55e" : "#3b82f6";
  return L.divIcon({
    html: `<div style="background:${bg};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);font-family:system-ui">${num}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

const homeIcon = L.divIcon({
  html: `<div style="background:#10b981;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)">🏠</div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
});

// Auto-fit map to all markers
function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, positions]);
  return null;
}

interface RouteMapProps {
  jobs: Array<{
    id: string;
    clientName: string;
    address: string;
    lat: number | null;
    lng: number | null;
    serviceType: string;
    status: string;
  }>;
  home: { lat: number; lng: number } | null;
}

export default function RouteMap({ jobs, home }: RouteMapProps) {
  const jobsWithCoords = jobs.filter(j => j.lat != null && j.lng != null);

  // Collect all positions for FitBounds
  const allPositions: [number, number][] = [
    ...(home ? [[home.lat, home.lng] as [number, number]] : []),
    ...jobsWithCoords.map(j => [j.lat!, j.lng!] as [number, number]),
  ];

  // Polyline: home → job1 → job2 → ...
  const polylinePoints: [number, number][] = [
    ...(home ? [[home.lat, home.lng] as [number, number]] : []),
    ...jobsWithCoords.map(j => [j.lat!, j.lng!] as [number, number]),
  ];

  // Singapore center as default
  const defaultCenter: [number, number] = [1.3521, 103.8198];

  return (
    <MapContainer
      center={allPositions[0] ?? defaultCenter}
      zoom={12}
      style={{ height: "100%", width: "100%", background: "#18181b" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds positions={allPositions} />

      {/* Route polyline */}
      {polylinePoints.length > 1 && (
        <Polyline
          positions={polylinePoints}
          color="#3b82f6"
          weight={3}
          opacity={0.7}
          dashArray="8 4"
        />
      )}

      {/* Home marker */}
      {home && (
        <Marker position={[home.lat, home.lng]} icon={homeIcon}>
          <Popup>
            <div style={{ fontFamily: "system-ui", fontWeight: 900, fontSize: 13 }}>🏠 Start / Home</div>
          </Popup>
        </Marker>
      )}

      {/* Job markers */}
      {jobsWithCoords.map((job, idx) => (
        <Marker
          key={job.id}
          position={[job.lat!, job.lng!]}
          icon={createNumberedIcon(idx + 1, job.status === "completed")}
        >
          <Popup>
            <div style={{ fontFamily: "system-ui", minWidth: 150 }}>
              <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 2 }}>#{idx + 1} {job.clientName}</div>
              <div style={{ fontSize: 11, color: "#555" }}>{job.serviceType}</div>
              <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{job.address}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
