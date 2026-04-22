"use client";

import { useState, useEffect, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { DateWheelPicker, TimeWheelPicker } from "@/components/ui/date-wheel-picker";
import { cn } from "@/lib/utils";
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

    useEffect(() => {
        async function loadClients() {
            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('clients')
                .select('*')
                .eq('provider_id', user.id);

            if (data) {
                setClients(data.map(c => ({
                    id: c.id,
                    name: c.name,
                    phone: c.phone || '',
                    address: c.address || '',
                    brand: '',
                    notes: c.notes || ''
                })));
            }
        }
        loadClients();
    }, []);

    // Simple Form State
    const [clientId, setClientId] = useState("");
    const [service, setService] = useState("");
    const [address, setAddress] = useState("");

    // Custom Date/Time State
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [time24, setTime24] = useState("09:00");

    useEffect(() => {
        async function loadBookingForEdit() {
            if (!bookingId) return;

            const supabase = createSupabaseBrowserClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: booking, error } = await supabase
                .from("bookings")
                .select("id, client_id, service_type, arrival_window_start, address")
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

            if (booking.arrival_window_start) {
                const start = new Date(booking.arrival_window_start);
                setSelectedDate(start);

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

        // Parse time to Date
        const [h, m] = time24.split(":").map(Number);

        const combinedDate = new Date(selectedDate);
        combinedDate.setHours(h, m, 0, 0);

        // Calculate ISO date string in local timezone (YYYY-MM-DD)
        const tzOffset = combinedDate.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(combinedDate.getTime() - tzOffset)).toISOString().slice(0, 10);

        if (isEditMode && bookingId) {
            updateJobMutation.mutate({
                bookingId,
                clientId: client.id,
                scheduledDate: localISOTime,
                arrivalWindowStart: combinedDate.toISOString(),
                serviceType: service,
                address: address.trim(),
            });
        } else {
            createJobMutation.mutate({
                clientId: client.id,
                scheduledDate: localISOTime,
                arrivalWindowStart: combinedDate.toISOString(),
                serviceType: service,
                address: address.trim(),
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
                                        if (c) setAddress(c.address || '');
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
                                <Label htmlFor="address" className="text-slate-600 font-semibold">Job Address</Label>
                                <Input
                                    id="address"
                                    placeholder="e.g. Blk 123 Ang Mo Kio Ave 6 #04-567"
                                    className="h-12 bg-white/50 border-slate-200/60 rounded-xl"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    required
                                />
                                {clientId && !address && (
                                    <p className="text-xs text-amber-600">No address on file for this client. Please enter the job address.</p>
                                )}
                            </div>

                            {/* Date Picker Accordion */}
                            <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Date</Label>
                                <div className="border border-slate-200/60 bg-white/50 rounded-xl overflow-hidden transition-all duration-300">
                                    <div
                                        className="flex items-center justify-between p-3 cursor-pointer active:bg-slate-100"
                                        onClick={() => setShowDatePicker(!showDatePicker)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                                                <CalendarIcon className="h-5 w-5" />
                                            </div>
                                            <span className="font-medium text-slate-700">{format(selectedDate, "dd MMM yyyy")}</span>
                                        </div>
                                        <ChevronDown className={cn("h-5 w-5 text-slate-400 transition-transform", showDatePicker && "rotate-180")} />
                                    </div>

                                    <AnimatePresence>
                                        {showDatePicker && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-slate-200/60 overflow-hidden"
                                            >
                                                <div className="p-4 bg-slate-50/50">
                                                    <DateWheelPicker
                                                        value={selectedDate}
                                                        onChange={setSelectedDate}
                                                        minYear={new Date().getFullYear()}
                                                        maxYear={new Date().getFullYear() + 5}
                                                        size="sm"
                                                        variant="light"
                                                        fadeColor="#f9fafb"
                                                    />
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Time Picker */}
                            <div className="space-y-2">
                                <Label className="text-slate-600 font-semibold">Time</Label>
                                <div className="border border-slate-200/60 bg-white/50 rounded-xl p-4">
                                    <TimeWheelPicker
                                        value={time24}
                                        onChange={setTime24}
                                        size="sm"
                                        minuteStep={15}
                                        variant="light"
                                        fadeColor="#ffffff"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="service" className="text-slate-600 font-semibold">Service Details</Label>
                                <Input
                                    id="service"
                                    placeholder="e.g. Aircon Servicing (3 Units)"
                                    className="h-12 bg-white/50 border-slate-200/60 rounded-xl"
                                    value={service}
                                    onChange={(e) => setService(e.target.value)}
                                    required
                                />
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
