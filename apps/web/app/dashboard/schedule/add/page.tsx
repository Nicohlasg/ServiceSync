"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { Client } from "@/lib/types";

function AddEvent() {
    const [loading, setLoading] = useState(false);
    const { push } = useRouter();
    const searchParams = useSearchParams();
    const bookingId = searchParams.get("bookingId");
    const isEditMode = !!bookingId;

    // Real DB state
    const [clients, setClients] = useState<Client[]>([]);
    const { data: servicesData } = api.provider.getServices.useQuery();
    const providerServices = servicesData?.filter(s => s.is_active) || [];

    useEffect(() => {
        async function loadClients() {
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name, phone, address, lat, lng, brand, notes')
                .eq('provider_id', user.id);

            if (clientsData) {
                setClients(clientsData.map(c => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone || '',
                    address: c.address || '',
                    lat: c.lat ?? undefined,
                    lng: c.lng ?? undefined,
                    brand: c.brand || '',
                    notes: c.notes || ''
                })));
            }
        }
        loadClients();
    }, []);

    // Simple Form State
    const [isManualService, setIsManualService] = useState(false);
    const [clientId, setClientId] = useState("");
    const [service, setService] = useState("");
    const [address, setAddress] = useState("");
    const [addressLat, setAddressLat] = useState<number | null>(null);
    const [addressLng, setAddressLng] = useState<number | null>(null);
    // BUG-07 fix: capture job duration so availability and invoicing work correctly
    const [durationMinutes, setDurationMinutes] = useState(60);

    // Native date/time inputs — stored as strings ("YYYY-MM-DD" and "HH:MM")
    const todayStr = new Date().toISOString().slice(0, 10);
    const [dateStr, setDateStr] = useState(todayStr);
    const [time24, setTime24] = useState("09:00");

    useEffect(() => {
        async function loadBookingForEdit() {
            if (!bookingId) return;

            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: booking, error } = await supabase
                .from("bookings")
                .select("id, client_id, service_type, arrival_window_start, address, lat, lng")
                .eq("id", bookingId)
                .eq("provider_id", user.id)
                .single();

            if (error || !booking) {
                toast.error("Booking not found");
                push("/dashboard/schedule");
                return;
            }

            setClientId(booking.client_id ?? "");
            setService(booking.service_type ?? "");
            setAddress(booking.address ?? "");
            setAddressLat(booking.lat ?? null);
            setAddressLng(booking.lng ?? null);

            if (booking.arrival_window_start) {
                const start = new Date(booking.arrival_window_start);
                // Format as YYYY-MM-DD for native date input
                const y = start.getFullYear();
                const mo = String(start.getMonth() + 1).padStart(2, '0');
                const d = String(start.getDate()).padStart(2, '0');
                setDateStr(`${y}-${mo}-${d}`);

                const hour = start.getHours();
                const minute = start.getMinutes();
                setTime24(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
            }
        }

        loadBookingForEdit();
    }, [bookingId, push]);

    // SEC-H6: Use tRPC mutations instead of direct Supabase insert/update
    const createJobMutation = api.schedule.createJob.useMutation({
        onSuccess: () => {
            toast.success("Job scheduled successfully");
            push("/dashboard/schedule");
        },
        onError: (err) => toast.error(err.message || "Failed to schedule job"),
        onSettled: () => setLoading(false),
    });

    const updateJobMutation = api.schedule.updateJob.useMutation({
        onSuccess: () => {
            toast.success("Job updated successfully");
            push("/dashboard/schedule");
        },
        onError: (err) => toast.error(err.message || "Failed to update job"),
        onSettled: () => setLoading(false),
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (clientId === "new") {
            push("/dashboard/clients/add");
            return;
        }
        if (!clientId) {
            toast.error("Please select a client");
            return;
        }
        if (!address.trim()) {
            toast.error("Please enter the job address");
            return;
        }

        setLoading(true);

        const client = clients.find(c => c.id === clientId);
        if (!client) {
            toast.error("Invalid client");
            setLoading(false);
            return;
        }

        // Parse native date/time inputs into a combined local Date
        const [h, m] = time24.split(":").map(Number);
        const [y, mo, d] = dateStr.split("-").map(Number);
        const combinedDate = new Date(y, mo - 1, d, h, m, 0, 0);

        // YYYY-MM-DD in local time for scheduled_date
        const localISOTime = dateStr;

        if (isEditMode && bookingId) {
            updateJobMutation.mutate({
                bookingId,
                clientId: client.id,
                scheduledDate: localISOTime,
                arrivalWindowStart: combinedDate.toISOString(),
                serviceType: service,
                address: address.trim(),
                lat: addressLat ?? undefined,
                lng: addressLng ?? undefined,
                estimatedDurationMinutes: durationMinutes,
            });
        } else {
            createJobMutation.mutate({
                clientId: client.id,
                scheduledDate: localISOTime,
                arrivalWindowStart: combinedDate.toISOString(),
                serviceType: service,
                address: address.trim(),
                lat: addressLat ?? undefined,
                lng: addressLng ?? undefined,
                estimatedDurationMinutes: durationMinutes,
            });
        }
    };

    return (
        <div className="space-y-6 pt-4 pb-24">
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3"
            >
                <BackButton href="/dashboard/schedule" />
                <h1 className="text-2xl font-bold text-white">{isEditMode ? "Edit Job" : "Add New Job"}</h1>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card className="bg-white/70 backdrop-blur-xl border-white/40 shadow-xl rounded-3xl overflow-hidden">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">

                            <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Select Client</Label>
                                <Select onValueChange={(val) => {
                                    setClientId(val);
                                    if (val !== "new") {
                                        const c = clients.find(cl => cl.id === val);
                                        if (c?.address) {
                                            setAddress(c.address);
                                            setAddressLat(c.lat ?? null);
                                            setAddressLng(c.lng ?? null);
                                        } else {
                                            setAddress('');
                                            setAddressLat(null);
                                            setAddressLng(null);
                                        }
                                    }
                                }} value={clientId}>
                                    <SelectTrigger className="h-12 bg-white/50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20">
                                        <SelectValue placeholder="Select a client..." />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[200px] backdrop-blur-xl bg-white/90">
                                        {clients.map(client => (
                                            <SelectItem key={client.id} value={client.id}>
                                                <span className="font-medium">{client.name}</span>
                                                <span className="text-xs text-slate-400 block truncate max-w-[200px]">{client.address || "No address"}</span>
                                            </SelectItem>
                                        ))}
                                        <SelectItem value="new" className="text-blue-600 font-semibold">+ Create New Client</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Job Address</Label>
                                <AddressAutocomplete
                                    value={address}
                                    onChange={(addr, lat, lng) => {
                                        setAddress(addr);
                                        setAddressLat(lat);
                                        setAddressLng(lng);
                                    }}
                                    placeholder="Search job address..."
                                    className="h-12 bg-white/50 border-slate-200/60 rounded-xl"
                                />
                                {clientId && !address && (
                                    <p className="text-xs text-amber-600">No address on file for this client. Please search the job address above.</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Date — native OS picker */}
                                <div className="space-y-2">
                                    <Label htmlFor="job-date" className="text-slate-600 font-semibold">Date</Label>
                                    <Input
                                        id="job-date"
                                        type="date"
                                        value={dateStr}
                                        min={todayStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="w-full h-12 bg-white/50 border-slate-200/60 rounded-xl text-slate-700 px-3"
                                        required
                                    />
                                </div>

                                {/* Time — native OS picker */}
                                <div className="space-y-2">
                                    <Label htmlFor="job-time" className="text-slate-600 font-semibold">Time</Label>
                                    <Input
                                        id="job-time"
                                        type="time"
                                        value={time24}
                                        onChange={(e) => setTime24(e.target.value)}
                                        className="w-full h-12 bg-white/50 border-slate-200/60 rounded-xl text-slate-700 px-3"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="service" className="text-slate-600 font-semibold">Service Details</Label>
                                    {providerServices.length > 0 && isManualService && (
                                        <Button 
                                            type="button" 
                                            variant="link" 
                                            className="h-auto p-0 text-xs text-blue-600"
                                            onClick={() => {
                                                setIsManualService(false);
                                                setService("");
                                            }}
                                        >
                                            Choose from list
                                        </Button>
                                    )}
                                </div>
                                
                                {providerServices.length > 0 && !isManualService ? (
                                    <Select 
                                        value={service} 
                                        onValueChange={(val) => {
                                            if (val === "manual") {
                                                setIsManualService(true);
                                                setService("");
                                            } else {
                                                setService(val);
                                                const svc = providerServices.find(s => s.name === val);
                                                if (svc?.duration_minutes) {
                                                    setDurationMinutes(svc.duration_minutes);
                                                }
                                            }
                                        }}
                                        required
                                    >
                                        <SelectTrigger className="h-12 bg-white/50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20">
                                            <SelectValue placeholder="Select a service..." />
                                        </SelectTrigger>
                                        <SelectContent className="backdrop-blur-xl bg-white/90">
                                            {providerServices.map((svc) => (
                                                <SelectItem key={svc.id} value={svc.name}>{svc.name}</SelectItem>
                                            ))}
                                            <SelectItem value="manual" className="font-semibold text-blue-600">+ Enter manually</SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        id="service"
                                        placeholder="e.g. Aircon Servicing (3 Units)"
                                        className="h-12 bg-white/50 border-slate-200/60 rounded-xl"
                                        value={service}
                                        onChange={(e) => setService(e.target.value)}
                                        required
                                    />
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="duration" className="text-slate-600 font-semibold">Estimated Duration (minutes)</Label>
                                <Select
                                    value={String(durationMinutes)}
                                    onValueChange={(v) => setDurationMinutes(Number(v))}
                                >
                                    <SelectTrigger id="duration" className="h-12 bg-white/50 border-slate-200/60 rounded-xl focus:ring-2 focus:ring-blue-500/20">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="backdrop-blur-xl bg-white/90">
                                        {[30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480].map(m => (
                                            <SelectItem key={m} value={String(m)}>
                                                {m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="pt-4">
                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full h-14 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 text-lg font-semibold hover:shadow-blue-500/40 transition-all active:scale-[0.98]"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Scheduling...</>
                                    ) : (
                                        isEditMode ? "Save Changes" : "Confirm Schedule"
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}

export default function AddEventPage() {
    return (
        <Suspense
            fallback={
                <div className="space-y-6 pt-4 pb-24">
                    <div className="flex items-center gap-3">
                        <SkeletonLine width="40px" className="h-10 rounded-full" />
                        <SkeletonLine width="55%" className="h-7" />
                    </div>
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            }
        >
            <AddEvent />
        </Suspense>
    );
}
