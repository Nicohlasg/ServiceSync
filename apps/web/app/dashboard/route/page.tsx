"use client";
import React, { useState, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { format, parseISO, addDays, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, ChevronLeft, ChevronRight } from "lucide-react";

import type RouteMapType from "@/components/ui/RouteMap";
type RouteMapProps = React.ComponentProps<typeof RouteMapType>;
const RouteMap = dynamic<RouteMapProps>(() => import("@/components/ui/RouteMap"), { ssr: false });

// ─── Pure utility functions ────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestNeighbor<T extends { lat: number | null; lng: number | null }>(
  start: { lat: number; lng: number },
  jobs: T[],
): T[] {
  const withCoords = jobs.filter(j => j.lat != null && j.lng != null);
  const noCoords = jobs.filter(j => j.lat == null || j.lng == null);
  const remaining = [...withCoords];
  const result: T[] = [];
  let current = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current.lat, current.lng, remaining[i].lat!, remaining[i].lng!);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    result.push(remaining[bestIdx]);
    current = { lat: remaining[bestIdx].lat!, lng: remaining[bestIdx].lng! };
    remaining.splice(bestIdx, 1);
  }
  return [...result, ...noCoords];
}

function buildGoogleMapsUrl(
  home: { lat: number; lng: number } | null,
  jobs: Array<{ lat: number | null; lng: number | null; address: string }>,
): string {
  const withCoords = jobs.filter(j => j.lat != null && j.lng != null);
  if (withCoords.length === 0) return '';
  const waypoints = withCoords.map(j => `${j.lat},${j.lng}`);
  const origin = home ? `${home.lat},${home.lng}` : waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const middle = waypoints.slice(0, -1).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${middle ? `&waypoints=${middle}` : ''}`;
}

// ─── Inner page (needs Suspense wrapper for useSearchParams etc.) ──────────

function RoutePage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [optimised, setOptimised] = useState(false);

  const { data, isLoading } = api.schedule.getRouteJobs.useQuery({ date }, { staleTime: 30_000 });
  const jobs = data?.jobs ?? [];
  const home = data?.home ?? null;

  const hasHome = home?.lat != null && home?.lng != null;

  const orderedJobs = useMemo(() => {
    if (optimised && hasHome) {
      return nearestNeighbor({ lat: home!.lat!, lng: home!.lng! }, jobs);
    }
    return jobs;
  }, [jobs, optimised, hasHome, home]);

  const totalKm = useMemo(() => {
    if (!hasHome) return null;
    let total = 0;
    let prev = { lat: home!.lat!, lng: home!.lng! };
    for (const j of orderedJobs) {
      if (j.lat != null && j.lng != null) {
        total += haversineKm(prev.lat, prev.lng, j.lat, j.lng);
        prev = { lat: j.lat, lng: j.lng };
      }
    }
    return Math.round(total * 10) / 10;
  }, [orderedJobs, hasHome, home]);

  return (
    <div className="space-y-5 pt-4 pb-28 px-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white">Route</h1>
          <p className="text-xs text-zinc-500 font-bold">
            {orderedJobs.length} job{orderedJobs.length !== 1 ? 's' : ''} · {date === format(new Date(), 'yyyy-MM-dd') ? 'Today' : format(parseISO(date), 'd MMM yyyy')}
          </p>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
        <button
          onClick={() => setDate(d => format(subDays(parseISO(d), 1), 'yyyy-MM-dd'))}
          className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-black text-white text-base">{format(parseISO(date), 'EEEE, d MMMM')}</p>
        <button
          onClick={() => setDate(d => format(addDays(parseISO(d), 1), 'yyyy-MM-dd'))}
          className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3"><SkeletonCard /><SkeletonCard /></div>
      ) : orderedJobs.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 space-y-3">
          <MapPin className="h-12 w-12 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 font-black text-lg">No jobs on this day</p>
          <p className="text-zinc-600 text-sm">Add jobs from the Schedule page</p>
        </div>
      ) : (
        <>
          {/* Map */}
          <div className="rounded-2xl overflow-hidden border border-white/10 h-64">
            <RouteMap
              jobs={orderedJobs}
              home={home?.lat != null && home?.lng != null ? { lat: home.lat, lng: home.lng } : null}
            />
          </div>

          {/* Actions row */}
          <div className="flex gap-3">
            <button
              onClick={() => setOptimised(o => !o)}
              className={`flex-1 h-11 rounded-xl font-black text-sm border transition-all ${
                optimised
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              {optimised ? '✓ Route Optimised' : 'Optimise Route'}
            </button>
            {hasHome && orderedJobs.some(j => j.lat != null) && (
              <a
                href={buildGoogleMapsUrl(
                  home?.lat != null && home?.lng != null ? { lat: home.lat!, lng: home.lng! } : null,
                  orderedJobs
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 h-11 rounded-xl font-black text-sm bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2 transition-colors"
              >
                <Navigation className="h-4 w-4" /> Start in Maps
              </a>
            )}
          </div>

          {/* Summary */}
          {totalKm != null && (
            <div className="flex gap-3">
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                <p className="text-xl font-black text-white">{totalKm} km</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Est. Distance</p>
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                <p className="text-xl font-black text-white">{orderedJobs.length}</p>
                <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Stops</p>
              </div>
            </div>
          )}

          {/* Job list in route order */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Driving Order</p>
            <AnimatePresence mode="popLayout">
              {orderedJobs.map((job, idx) => {
                const hasLocation = job.lat != null && job.lng != null;
                const wazeUrl = hasLocation ? `https://waze.com/ul?ll=${job.lat},${job.lng}&navigate=yes` : null;
                const timeStr = format(parseISO(job.arrivalTime), 'h:mm a');
                const statusColor = job.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500';

                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: idx * 0.04 }}
                  >
                    <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
                      <CardContent className="p-4 relative z-10">
                        <div className="flex items-start gap-3">
                          {/* Order badge */}
                          <div className={`h-8 w-8 rounded-full ${statusColor} flex items-center justify-center font-black text-white text-sm shrink-0 mt-0.5`}>
                            {idx + 1}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{timeStr}</span>
                              {job.status === 'completed' && (
                                <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase">Done</span>
                              )}
                            </div>
                            <p className="font-black text-white text-sm truncate">{job.clientName}</p>
                            <p className="text-xs text-zinc-400 font-bold truncate">{job.serviceType}</p>
                            <p className="text-[11px] text-zinc-500 truncate mt-0.5">{job.address}</p>
                            {!hasLocation && (
                              <p className="text-[10px] text-amber-400 font-bold mt-1">⚠ No coordinates — won&apos;t appear on map</p>
                            )}
                          </div>

                          {/* Navigate button */}
                          {wazeUrl && (
                            <a
                              href={wazeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 h-10 w-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                              <Navigation className="h-4 w-4" />
                            </a>
                          )}
                        </div>

                        {/* Distance from previous stop (show for stops 2+) */}
                        {idx > 0 && hasLocation && orderedJobs[idx - 1].lat != null && (() => {
                          const prev = orderedJobs[idx - 1];
                          const km = Math.round(haversineKm(prev.lat!, prev.lng!, job.lat!, job.lng!) * 10) / 10;
                          return (
                            <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-zinc-600" />
                              <span className="text-[10px] text-zinc-600 font-bold">{km} km from previous stop</span>
                            </div>
                          );
                        })()}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}

export default function RouteViewPage() {
  return (
    <Suspense fallback={
      <div className="space-y-5 pt-4 pb-28 px-4">
        <div className="h-8 bg-white/5 rounded-xl animate-pulse" />
        <div className="h-16 bg-white/5 rounded-2xl animate-pulse" />
        <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
      </div>
    }>
      <RoutePage />
    </Suspense>
  );
}
