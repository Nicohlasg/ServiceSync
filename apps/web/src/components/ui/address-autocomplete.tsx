"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, Navigation } from "lucide-react";

interface OneMapResult {
  address: string;
  blkNo: string;
  roadName: string;
  building: string;
  postalCode: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = "Search address...",
  className,
}: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<OneMapResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    onChangeRef.current(text, null, null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Call our server-side proxy — avoids CSP block on direct onemap.gov.sg calls
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`);
        if (res.ok) {
          const data = await res.json() as { results: OneMapResult[] };
          setResults(data.results ?? []);
          setOpen((data.results ?? []).length > 0);
        } else {
          setResults([]);
          setOpen(false);
        }
      } catch {
        setResults([]);
        setOpen(false);
      }
      setLoading(false);
    }, 150);
  }, []);

  const handleSelect = (result: OneMapResult) => {
    setQuery(result.address);
    onChange(result.address, result.lat, result.lng);
    setOpen(false);
    setResults([]);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        // Reverse geocode via our server-side proxy (avoids CSP block on direct onemap.gov.sg calls)
        try {
          const res = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`);
          if (res.ok) {
            const data = await res.json() as { address: string | null };
            if (data.address) {
              setQuery(data.address);
              onChange(data.address, latitude, longitude);
            } else {
              onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude);
            }
          } else {
            onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude);
          }
        } catch {
          onChange(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`, latitude, longitude);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`pl-9 ${className ?? ""}`}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin text-slate-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={locating}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-blue-500 hover:bg-accent transition-colors border-b border-border"
          >
            {locating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            Use current location
          </button>
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(r)}
              className="w-full text-left px-4 py-3 text-sm text-popover-foreground hover:bg-accent transition-colors border-b border-border last:border-0"
            >
              <p className="font-medium truncate">{r.address}</p>
              {r.building && r.building !== "NIL" && (
                <p className="text-xs text-muted-foreground truncate">{r.building}</p>
              )}
              {r.postalCode && r.postalCode !== "NIL" && (
                <p className="text-xs text-muted-foreground/70">S({r.postalCode})</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
