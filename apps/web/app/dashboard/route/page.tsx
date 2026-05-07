"use client";
import React, { useState, useMemo, useRef, useEffect, Suspense } from "react";
import { format, parseISO, addDays, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, ChevronLeft, ChevronRight, Copy, Check, Crosshair, ArrowDown } from "lucide-react";
import { toast } from "sonner";

// ─── Utilities ─────────────────────────────────────────────────────────────────

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

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Stop {
  lat: number | null;
  lng: number | null;
  address: string;
  label: string;
  isHome: boolean;
  jobData?: any;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

function RoutePage() {
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [optimised, setOptimised] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [copiedField, setCopiedField] = useState<'from' | 'to' | null>(null);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  const stops: Stop[] = useMemo(() => {
    const s: Stop[] = [];
    if (hasHome) {
      s.push({ lat: home!.lat!, lng: home!.lng!, address: 'Home', label: 'Home', isHome: true });
    }
    for (const job of orderedJobs) {
      s.push({ lat: job.lat, lng: job.lng, address: job.address, label: job.clientName, isHome: false, jobData: job });
    }
    return s;
  }, [orderedJobs, hasHome, home]);

  const totalLegs = Math.max(0, stops.length - 1);
  const clampedStep = Math.min(Math.max(currentStep, 0), Math.max(totalLegs - 1, 0));

  const originStop = stops[clampedStep] ?? null;
  const destStop = stops[clampedStep + 1] ?? null;

  const effectiveOriginLat = usingCurrentLocation && currentPos ? currentPos.lat : originStop?.lat ?? null;
  const effectiveOriginLng = usingCurrentLocation && currentPos ? currentPos.lng : originStop?.lng ?? null;
  const effectiveOriginAddress = usingCurrentLocation && currentPos ? 'Current Location' : (originStop?.address ?? '');
  const effectiveOriginLabel = usingCurrentLocation && currentPos ? 'Your Location' : (originStop?.label ?? '');

  const googleMapsUrl = destStop
    ? `https://www.google.com/maps/dir/?api=1&origin=${
        effectiveOriginLat && effectiveOriginLng
          ? `${effectiveOriginLat},${effectiveOriginLng}`
          : encodeURIComponent(effectiveOriginAddress)
      }&destination=${
        destStop.lat && destStop.lng
          ? `${destStop.lat},${destStop.lng}`
          : encodeURIComponent(destStop.address)
      }&travelmode=driving`
    : '';

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setUsingCurrentLocation(true);
        toast.success("Using your current location as origin");
      },
      () => toast.error("Could not get location. Please allow location access.")
    );
  };

  const handleCopy = async (text: string, field: 'from' | 'to') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success("Address copied!");
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Could not copy.");
    }
  };

  useEffect(() => {
    setCurrentStep(0);
    setUsingCurrentLocation(false);
    setCurrentPos(null);
  }, [date]);

  const isToday = date === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-5 pt-4 pb-28 px-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <BackButton />
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white">Route</h1>
          <p className="text-xs text-zinc-400 font-bold">
            {orderedJobs.length} job{orderedJobs.length !== 1 ? 's' : ''} · {isToday ? 'Today' : format(parseISO(date), 'd MMM yyyy')}
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
        <input
          ref={dateInputRef}
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="sr-only"
        />
        <button
          type="button"
          onClick={() => dateInputRef.current?.showPicker()}
          className="font-black text-white text-base hover:text-blue-300 transition-colors"
        >
          {format(parseISO(date), 'EEEE, d MMMM')}
        </button>
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
        <div className="text-center py-16 space-y-3">
          <MapPin className="h-12 w-12 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 font-black text-lg">No jobs on this day</p>
          <p className="text-zinc-500 text-sm">Add jobs from the Schedule page</p>
        </div>
      ) : totalLegs === 0 ? (
        <div className="text-center py-10 space-y-3">
          <MapPin className="h-12 w-12 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 font-black">Set a home address to enable step navigation</p>
          <p className="text-zinc-500 text-sm">Profile → Home Address</p>
        </div>
      ) : (
        <>
          {/* Step-by-step navigation */}
          <Card variant="premium" className="rounded-2xl backdrop-blur-2xl">
            <CardContent className="p-5 relative z-10 space-y-4">

              {/* Step counter + prev/next */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                  Step {clampedStep + 1} of {totalLegs}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCurrentStep(s => Math.max(0, s - 1)); setUsingCurrentLocation(false); }}
                    disabled={clampedStep === 0}
                    className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setCurrentStep(s => Math.min(totalLegs - 1, s + 1)); setUsingCurrentLocation(false); }}
                    disabled={clampedStep >= totalLegs - 1}
                    className="h-8 w-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* From address */}
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <div className="h-2.5 w-2.5 rounded-full bg-blue-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">From</p>
                  <p className="text-sm font-black text-white truncate">{effectiveOriginLabel}</p>
                  {effectiveOriginAddress !== effectiveOriginLabel && effectiveOriginAddress && (
                    <p className="text-xs text-zinc-400 truncate">{effectiveOriginAddress}</p>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(effectiveOriginAddress, 'from')}
                  className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white shrink-0 transition-all"
                >
                  {copiedField === 'from' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex justify-center">
                <ArrowDown className="h-4 w-4 text-zinc-600" />
              </div>

              {/* To address */}
              <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">To</p>
                  <p className="text-sm font-black text-white truncate">{destStop?.label ?? '—'}</p>
                  {destStop?.address && destStop.address !== destStop.label && (
                    <p className="text-xs text-zinc-400 truncate">{destStop.address}</p>
                  )}
                </div>
                <button
                  onClick={() => handleCopy(destStop?.address ?? '', 'to')}
                  disabled={!destStop?.address}
                  className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white disabled:opacity-30 shrink-0 transition-all"
                >
                  {copiedField === 'to' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={googleMapsUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => !googleMapsUrl && e.preventDefault()}
                  className={`h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                    googleMapsUrl
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-white/5 border border-white/10 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <Navigation className="h-4 w-4" /> Navigate
                </a>
                <button
                  onClick={handleUseCurrentLocation}
                  className={`h-12 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all border ${
                    usingCurrentLocation
                      ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Crosshair className="h-4 w-4" />
                  {usingCurrentLocation ? 'Using GPS' : 'My Location'}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Leg map (Google Maps embed) */}
          {destStop && (
            <div className="rounded-2xl overflow-hidden border border-white/10 h-52">
              <iframe
                src={`https://maps.google.com/maps?saddr=${
                  effectiveOriginLat && effectiveOriginLng
                    ? `${effectiveOriginLat},${effectiveOriginLng}`
                    : encodeURIComponent(effectiveOriginAddress)
                }&daddr=${
                  destStop.lat && destStop.lng
                    ? `${destStop.lat},${destStop.lng}`
                    : encodeURIComponent(destStop.address)
                }&t=&z=13&ie=UTF8&iwloc=&output=embed`}
                className="w-full h-full pointer-events-none"
                loading="lazy"
                title="Route map"
              />
            </div>
          )}

          {/* Optimize toggle */}
          <button
            onClick={() => setOptimised(o => !o)}
            className={`w-full h-11 rounded-xl font-black text-sm border transition-all ${
              optimised
                ? 'bg-emerald-600 border-emerald-500 text-white'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {optimised ? '✓ Route Optimised' : 'Optimise Route'}
          </button>

          {/* All stops list */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">All Stops Today</p>
            <AnimatePresence mode="popLayout">
              {(() => {
                let jobNum = 0;
                return stops.map((stop, idx) => {
                  if (!stop.isHome) jobNum++;
                  const displayNum = stop.isHome ? null : jobNum;
                  const isOriginOfActive = idx === clampedStep;
                  const isDestOfActive = idx === clampedStep + 1;
                  const timeStr = stop.jobData?.arrivalTime
                    ? format(parseISO(stop.jobData.arrivalTime), 'h:mm a')
                    : null;

                  return (
                    <motion.div
                      key={idx}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => {
                        if (idx > 0) {
                          setCurrentStep(idx - 1);
                          setUsingCurrentLocation(false);
                        }
                      }}
                      className={idx > 0 ? 'cursor-pointer' : undefined}
                    >
                      <Card variant="premium" className={`rounded-2xl backdrop-blur-xl transition-all ${
                        isOriginOfActive ? 'ring-1 ring-blue-500/50' :
                        isDestOfActive ? 'ring-1 ring-emerald-500/50' : ''
                      }`}>
                        <CardContent className="p-4 relative z-10">
                          <div className="flex items-start gap-3">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 mt-0.5 ${
                              stop.isHome ? 'bg-zinc-600 text-white text-base' :
                              stop.jobData?.status === 'completed' ? 'bg-emerald-500 text-white' :
                              'bg-blue-500 text-white'
                            }`}>
                              {stop.isHome ? '🏠' : displayNum}
                            </div>
                            <div className="flex-1 min-w-0">
                              {timeStr && (
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block mb-0.5">{timeStr}</span>
                              )}
                              <p className="font-black text-white text-sm truncate">{stop.label}</p>
                              {stop.address !== stop.label && (
                                <p className="text-xs text-zinc-400 font-bold truncate">{stop.address}</p>
                              )}
                              {stop.jobData && (
                                <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-0.5 truncate">{stop.jobData.serviceType}</p>
                              )}
                            </div>
                            {isOriginOfActive && (
                              <span className="text-[9px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 uppercase tracking-wider shrink-0">From</span>
                            )}
                            {isDestOfActive && (
                              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 uppercase tracking-wider shrink-0">Next</span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                });
              })()}
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
