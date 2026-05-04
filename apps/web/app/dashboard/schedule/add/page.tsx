"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Check, ChevronsUpDown, Search, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { Client } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

type ClientWithUnit = Client & { unit_number?: string };

function AddEvent() {
    const [loading, setLoading] = useState(false);
    const { push } = useRouter();
    const searchParams = useSearchParams();
    const bookingId = searchParams.get("bookingId");
    const isEditMode = !!bookingId;

    // Real DB state
    const [clients, setClients] = useState<ClientWithUnit[]>([]);
    const { data: servicesData } = api.provider.getServices.useQuery(undefined, { staleTime: 5 * 60 * 1000 });
    const providerServices = servicesData?.filter(s => s.is_active) || [];

    useEffect(() => {
        async function loadClients() {
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: clientsData } = await supabase
                .from('clients')
                .select('id, name, phone, address, unit_number, lat, lng, brand, notes')
                .eq('provider_id', user.id)
                .eq('is_deleted', false)
                .order('name', { ascending: true });

            if (clientsData) {
                setClients(clientsData.map(c => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone || '',
                    address: c.address || '',
                    unit_number: c.unit_number || '',
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
    const [isManualClient, setIsManualClient] = useState(false);
    const [isManualService, setIsManualService] = useState(false);
    const [clientId, setClientId] = useState("");
    const [manualClientName, setManualClientName] = useState("");
    const [manualClientPhone, setManualClientPhone] = useState("");
    const [service, setService] = useState("");
    const [address, setAddress] = useState("");
    const [addressLat, setAddressLat] = useState<number | null>(null);
    const [addressLng, setAddressLng] = useState<number | null>(null);
    
    // Duration State
    const [durationHours, setDurationHours] = useState(1);
    const [durationMinutes, setDurationMinutes] = useState(0);

    // Search state for client combo
    const [openClientCombo, setOpenClientCombo] = useState(false);

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
                .select("id, client_id, service_type, arrival_window_start, address, lat, lng, estimated_duration_minutes")
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
            
            const totalMins = booking.estimated_duration_minutes || 60;
            setDurationHours(Math.floor(totalMins / 60));
            setDurationMinutes(totalMins % 60);

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
        
        if (isManualClient && !manualClientName.trim()) {
            toast.error("Please enter a client name");
            return;
        }

        if (isManualClient) {
            const phoneParsed = manualClientPhone.replace(/\D/g, '');
            if (!/^[89]\d{7}$/.test(phoneParsed)) {
                toast.error("Please enter a valid 8-digit Singapore mobile number starting with 8 or 9");
                return;
            }
        }

        if (!isManualClient && !clientId) {
            toast.error("Please select a client");
            return;
        }

        if (!address.trim()) {
            toast.error("Please enter the job address");
            return;
        }

        setLoading(true);
        
        let targetClientId = clientId;

        if (isManualClient) {
            try {
                const supabase = createSupabaseBrowserClient();
                const { data: { user } } = await supabase.auth.getUser();
                
                const { data: newClient, error: clientErr } = await supabase
                    .from('clients')
                    .insert({
                        provider_id: user?.id,
                        name: manualClientName.trim(),
                        phone: manualClientPhone.trim(),
                        address: address.trim(),
                        lat: addressLat,
                        lng: addressLng,
                        brand: '',
                        notes: ''
                    })
                    .select()
                    .single();

                if (clientErr) throw clientErr;
                targetClientId = newClient.id;
            } catch (err: any) {
                toast.error("Failed to create new client: " + err.message);
                setLoading(false);
                return;
            }
        }

        // Parse native date/time inputs into a combined local Date
        const [h, m] = time24.split(":").map(Number);
        const [y, mo, d] = dateStr.split("-").map(Number);
        const combinedDate = new Date(y, mo - 1, d, h, m, 0, 0);

        const totalDuration = (durationHours * 60) + durationMinutes;

        if (isEditMode && bookingId) {
            updateJobMutation.mutate({
                bookingId,
                clientId: targetClientId,
                scheduledDate: dateStr,
                arrivalWindowStart: combinedDate.toISOString(),
                serviceType: service,
                address: address.trim(),
                lat: addressLat ?? undefined,
                lng: addressLng ?? undefined,
                estimatedDurationMinutes: totalDuration,
            });
        } else {
            createJobMutation.mutate({
                clientId: targetClientId,
                scheduledDate: dateStr,
                arrivalWindowStart: combinedDate.toISOString(),
                serviceType: service,
                address: address.trim(),
                lat: addressLat ?? undefined,
                lng: addressLng ?? undefined,
                estimatedDurationMinutes: totalDuration,
            });
        }
    };

    return (
        <div className="space-y-6 pt-4 pb-24 text-white">
            <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3"
            >
                <BackButton href="/dashboard/schedule" />
                <h1 className="text-2xl font-black tracking-tight">{isEditMode ? "Edit Job" : "Add New Job"}</h1>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
            >
                <Card variant="premium" className="rounded-3xl overflow-hidden backdrop-blur-2xl shadow-2xl">
                    <CardContent className="p-6">
                        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Client</Label>
                                    <Button 
                                        type="button" 
                                        variant="link" 
                                        className="h-auto p-0 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300"
                                        onClick={() => {
                                            setIsManualClient(!isManualClient);
                                            setClientId("");
                                            setManualClientName("");
                                            setManualClientPhone("");
                                        }}
                                    >
                                        {isManualClient ? "Pick from list" : "+ Enter Manually"}
                                    </Button>
                                </div>

                                {isManualClient ? (
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Client Name"
                                            value={manualClientName}
                                            onChange={(e) => setManualClientName(e.target.value)}
                                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus:border-blue-500/50 backdrop-blur-md font-bold"
                                            required
                                        />
                                        <Input
                                            placeholder="Mobile Number"
                                            type="tel"
                                            value={manualClientPhone}
                                            onChange={(e) => setManualClientPhone(e.target.value)}
                                            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl focus:border-blue-500/50 backdrop-blur-md font-bold"
                                            required
                                        />
                                    </div>
                                ) : (
                                    <Popover open={openClientCombo} onOpenChange={setOpenClientCombo}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={openClientCombo}
                                                className="w-full h-12 justify-between bg-white/5 border-white/10 rounded-xl text-white font-bold hover:bg-white/10 transition-all text-left px-4"
                                            >
                                                <span className="truncate">
                                                    {clientId
                                                        ? clients.find((c) => c.id === clientId)?.name
                                                        : "Select a client..."}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[calc(100vw-3rem)] max-w-[400px] p-0 rounded-2xl border-white/10 shadow-2xl overflow-hidden backdrop-blur-3xl bg-zinc-950/95">
                                            <Command className="bg-transparent">
                                                <CommandInput placeholder="Search clients..." className="h-12 text-white" />
                                                <CommandList className="max-h-[250px] no-scrollbar">
                                                    <CommandEmpty className="py-8 text-center text-sm text-zinc-500 font-medium">
                                                        No client found.
                                                        <Button 
                                                            variant="link" 
                                                            className="text-blue-400 ml-1 font-black uppercase tracking-widest text-[10px]"
                                                            onClick={() => {
                                                                setOpenClientCombo(false);
                                                                setIsManualClient(true);
                                                            }}
                                                        >
                                                            Create new?
                                                        </Button>
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        {clients.map((client) => (
                                                            <CommandItem
                                                                key={client.id}
                                                                value={client.name}
                                                                onSelect={() => {
                                                                    setClientId(client.id);
                                                                    if (client.address) {
                                                                        setAddress(client.address);
                                                                        setAddressLat(client.lat ?? null);
                                                                        setAddressLng(client.lng ?? null);
                                                                    }
                                                                    setOpenClientCombo(false);
                                                                }}
                                                                className="py-3 px-4 flex flex-col items-start gap-0.5 aria-selected:bg-white/10 cursor-pointer"
                                                            >
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span className="font-black text-white text-base tracking-tight">{client.name}</span>
                                                                    <Check
                                                                        className={cn(
                                                                            "h-4 w-4 text-blue-400",
                                                                            clientId === client.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate w-full">
                                                                    {[client.address, client.unit_number].filter(Boolean).join(', ') || "No address on file"}
                                                                </span>
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                                <div className="p-2 border-t border-white/5 bg-white/5">
                                                    <Button 
                                                        variant="ghost" 
                                                        className="w-full justify-start text-blue-400 font-black uppercase tracking-widest text-[10px] h-10 rounded-xl hover:bg-white/5"
                                                        onClick={() => push("/dashboard/clients/add")}
                                                    >
                                                        <UserPlus className="mr-2 h-4 w-4" /> Add Full Client Record
                                                    </Button>
                                                </div>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Job Address</Label>
                                <AddressAutocomplete
                                    value={address}
                                    onChange={(addr, lat, lng) => {
                                        setAddress(addr);
                                        setAddressLat(lat);
                                        setAddressLng(lng);
                                    }}
                                    placeholder="Search job address..."
                                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl backdrop-blur-md font-bold"
                                />
                                {(clientId || manualClientName) && !address && (
                                    <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider ml-1">Please provide the location for this job.</p>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Date — native OS picker */}
                                <div className="space-y-1.5 flex-1">
                                    <Label htmlFor="job-date" className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Date</Label>
                                    <Input
                                        id="job-date"
                                        type="date"
                                        value={dateStr}
                                        min={todayStr}
                                        onChange={(e) => setDateStr(e.target.value)}
                                        className="w-full h-12 bg-white/5 border-white/10 text-white rounded-xl appearance-none px-3 font-bold backdrop-blur-md"
                                        required
                                    />
                                </div>

                                {/* Time — native OS picker */}
                                <div className="space-y-1.5 flex-1">
                                    <Label htmlFor="job-time" className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Time</Label>
                                    <Input
                                        id="job-time"
                                        type="time"
                                        value={time24}
                                        onChange={(e) => setTime24(e.target.value)}
                                        className="w-full h-12 bg-white/5 border-white/10 text-white rounded-xl appearance-none px-3 font-bold backdrop-blur-md"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="service" className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Service Details</Label>
                                    {providerServices.length > 0 && isManualService && (
                                        <Button 
                                            type="button" 
                                            variant="link" 
                                            className="h-auto p-0 text-[10px] font-black text-blue-400 uppercase tracking-widest hover:text-blue-300"
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
                                                    setDurationHours(Math.floor(svc.duration_minutes / 60));
                                                    setDurationMinutes(svc.duration_minutes % 60);
                                                }
                                            }
                                        }}
                                        required
                                    >
                                        <SelectTrigger className="h-12 bg-white/5 border-white/10 rounded-xl text-white font-bold hover:bg-white/10 transition-all px-4 backdrop-blur-md">
                                            <SelectValue placeholder="Select a service..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950/95 border-white/10 backdrop-blur-3xl text-white">
                                            {providerServices.map((svc) => (
                                                <SelectItem key={svc.id} value={svc.name} className="py-3 font-bold">{svc.name}</SelectItem>
                                            ))}
                                            <SelectItem value="manual" className="font-black text-blue-400 uppercase tracking-widest text-[10px] py-3">
                                                + Enter manually
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <Input
                                        id="service"
                                        placeholder="e.g. Aircon Servicing (3 Units)"
                                        className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold backdrop-blur-md"
                                        value={service}
                                        onChange={(e) => setService(e.target.value)}
                                        required
                                    />
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="duration" className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Estimated Duration</Label>
                                <Input
                                    id="duration"
                                    type="time"
                                    value={`${String(durationHours).padStart(2, '0')}:${String(durationMinutes).padStart(2, '0')}`}
                                    onChange={(e) => {
                                        const [h, m] = (e.target.value || '01:00').split(':').map(Number);
                                        setDurationHours(isNaN(h) ? 1 : h);
                                        setDurationMinutes(isNaN(m) ? 0 : m);
                                    }}
                                    className="h-14 bg-white/5 border-white/10 text-white rounded-xl appearance-none px-3 font-black backdrop-blur-md focus:border-blue-500/50 text-xl"
                                />
                                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider ml-1 mt-1">How long will this job take?</p>
                            </div>

                            <div className="pt-4">
                                <Button
                                    type="submit"
                                    size="lg"
                                    className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 text-lg font-black uppercase tracking-widest active:scale-[0.98] transition-all text-white border-none"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <><Loader2 className="mr-2 h-6 w-6 animate-spin" /> SCHEDULING...</>
                                    ) : (
                                        isEditMode ? "SAVE CHANGES" : "CONFIRM SCHEDULE"
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
                    <div className="flex items-center gap-3 px-1">
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
