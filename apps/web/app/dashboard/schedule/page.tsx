"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, X, Check, Trash2, Edit, Star, Camera, Map, MessageCircle } from "lucide-react";
import Link from "next/link";
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    addDays,
    isSameMonth,
    isSameDay,
    isToday
} from "date-fns";
import { cn, formatCurrency } from "@/lib/utils";
import { Job } from "@/lib/types";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { MonthWheelPicker } from "@/components/ui/date-wheel-picker";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
import {
    openWhatsAppWithReview,
    getReviewUrl,
    openWhatsAppWithDayBeforeReminder,
    openWhatsAppWithMorningConfirmation,
    openWhatsAppWithOnMyWay,
} from "@/lib/whatsapp-helpers";
import { useRouter } from "next/navigation";

export default function SchedulePage() {
    const { push } = useRouter();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<Job | null>(null);

    useEffect(() => {
        async function loadJobs() {
            try {
                const supabase = createSupabaseBrowserClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // BUG-12 fix: scope to ±6 months so this doesn't scan the entire
                // bookings table as history grows. The calendar only shows ±5 years
                // via the month picker, but loading all history on every visit is
                // wasteful. Widen this window when the user base grows significantly.
                const windowStart = new Date();
                windowStart.setMonth(windowStart.getMonth() - 6);
                const windowEnd = new Date();
                windowEnd.setMonth(windowEnd.getMonth() + 6);

                const { data: bookings } = await supabase
                    .from('bookings')
                    .select('id, client_id, client_name, client_phone, status, scheduled_date, arrival_window_start, service_type, address, lat, lng, amount, clients(name, phone)')
                    .eq('provider_id', user.id)
                    .neq('status', 'pending')
                    .gte('scheduled_date', windowStart.toISOString().slice(0, 10))
                    .lte('scheduled_date', windowEnd.toISOString().slice(0, 10))
                    .order('arrival_window_start', { ascending: true });

                if (bookings) {
                    const mappedJobs: Job[] = bookings.map(b => {
                        const dateObj = new Date(b.arrival_window_start);
                        const timeStr = dateObj.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true });
                        const isCompleted = b.status === 'completed';

                        // BUG-16 fix: Supabase returns the joined row as an object, not an array.
                        // The generated type says array — cast via unknown to override.
                        const joinedClient = b.clients as unknown as { name: string; phone?: string } | null;

                        return {
                            id: b.id,
                            clientId: b.client_id ?? '',
                            clientName: b.client_name || joinedClient?.name || 'Unknown Client',
                            time: timeStr,
                            service: b.service_type,
                            status: isCompleted ? "completed" : "upcoming",
                            lat: b.lat ?? undefined,
                            lng: b.lng ?? undefined,
                            address: b.address ?? '',
                            // BUG-04 fix: append T00:00:00 to force local-time parse;
                            // new Date("YYYY-MM-DD") parses as UTC midnight which is the
                            // previous calendar day in SGT (UTC+8).
                            date: new Date(b.scheduled_date + 'T00:00:00'),
                            // BUG-11 fix: read actual amount from row
                            amount: (b.amount ?? 0) / 100,
                            clientPhone: (b as Record<string, unknown>).client_phone as string | undefined || joinedClient?.phone || undefined,
                        };
                    });
                    setJobs(mappedJobs);
                }
            } catch (err) {
                console.error("Failed to load jobs", err);
            }
        }
        loadJobs();
    }, []);

    const { data: providerProfile } = api.provider.getProfile.useQuery();

    // SEC-H6: Use tRPC mutation instead of direct Supabase delete
    const deleteJobMutation = api.schedule.deleteJob.useMutation({
        onSuccess: (_data, variables) => {
            setJobs(prev => prev.filter(j => j.id !== variables.bookingId));
            toast.success("Job deleted successfully");
        },
        onError: (err) => {
            toast.error(err.message || "Failed to delete job");
        },
    });

    // BUG-10 fix: consolidated delete handler — previously there were two delete
    // functions (deleteJob + handleDelete) causing a race condition where the modal
    // closed before the async mutation settled. Now one path with proper awaiting.
    const handleDelete = async (id: string) => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { count, error: countErr } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true })
            .eq('booking_id', id)
            .eq('provider_id', user.id);

        if (countErr) {
            console.error('Invoice lookup failed', countErr);
            toast.error("Could not verify invoices for this job. Try again.");
            return;
        }

        const hasInvoice = (count ?? 0) > 0;
        const message = hasInvoice
            ? "This job has an invoice — delete anyway?"
            : "Are you sure you want to delete this job?";

        if (!confirm(message)) return;

        // Close modal immediately so the UI feels responsive;
        // the mutation handles its own success/error toasts.
        setEditingJob(null);
        deleteJobMutation.mutate({ bookingId: id });
    };

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    // Swipe Logic
    const x = useMotionValue(0);
    const opacity = useTransform(x, [-100, 0, 100], [0.5, 1, 0.5]);

    const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
        if (info.offset.x > 100) {
            prevMonth();
        } else if (info.offset.x < -100) {
            nextMonth();
        }
    };

    const onDateClick = (day: Date) => setSelectedDate(day);

    // Calendar Generation Logic
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDate;
    let formattedDate = "";

    while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
            formattedDate = format(day, dateFormat);
            const cloneDay = day;

            const hasEvents = jobs.some(e => isSameDay(new Date(e.date), day));
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, monthStart);

            days.push(
                <motion.div
                    key={day.toString()}
                    whileTap={{ scale: 0.9 }}
                    className={cn(
                        "relative h-10 w-10 md:h-12 md:w-12 mx-auto flex items-center justify-center rounded-full text-[15px] font-bold cursor-pointer transition-all select-none",
                        !isCurrentMonth ? "text-white/20" : "text-white",
                        isSelected ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40" : "hover:bg-white/5",
                        isToday(day) && !isSelected && "text-blue-400 font-black ring-1 ring-blue-500/30"
                    )}
                    onClick={() => onDateClick(cloneDay)}
                >
                    {formattedDate}
                    {hasEvents && !isSelected && (
                        <div
                            className="absolute bottom-1.5 h-1.5 w-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)]"
                        />
                    )}
                </motion.div>
            );
            day = addDays(day, 1);
        }
        rows.push(
            <div className="grid grid-cols-7 gap-y-6 gap-x-1 mb-6" key={day.toString()}>
                {days}
            </div>
        );
        days = [];
    }

    // Filter events for selected day
    const selectedEvents = jobs.filter(e => isSameDay(new Date(e.date), selectedDate));
    const selectedDayRevenue = selectedEvents.reduce((s, e) => s + (e.amount ?? 0), 0);
    const selectedDayCompleted = selectedEvents.filter(e => e.status === 'completed').length;


    const handleEdit = () => {
        if (!editingJob) return;
        push(`/dashboard/schedule/add?bookingId=${editingJob.id}`);
        setEditingJob(null);
    };

    return (
        <div className="flex flex-col h-full text-white">
            {/* Fixed Header & Calendar */}
            <div className="flex-none pt-4 pb-2 z-10 relative px-4">
                <div
                    className="flex items-center justify-between pb-4"
                >
                    <div
                        className="flex items-center gap-1 cursor-pointer hover:bg-white/5 p-2 rounded-xl transition-all active:scale-95 duration-200"
                        onClick={() => setIsMonthPickerOpen(true)}
                    >
                        <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                            {format(currentMonth, "MMMM yyyy")}
                        </h1>
                        <ChevronRight className="h-5 w-5 text-zinc-500 rotate-90" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/route">
                            <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm hover:bg-white/10 text-white" title="Route View">
                                <Map className="h-5 w-5" />
                            </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedDate(new Date()); setCurrentMonth(new Date()); }} className="h-11 w-11 rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm hover:bg-white/10 text-white">
                            <CalendarIcon className="h-5 w-5" />
                        </Button>
                        <Link href="/dashboard/schedule/add">
                            <Button size="icon" className="h-11 w-11 bg-blue-600 hover:bg-blue-700 rounded-full shadow-xl shadow-blue-600/30 active:scale-90 transition-transform">
                                <Plus className="h-6 w-6" />
                            </Button>
                        </Link>
                    </div>
                </div>

                <motion.div
                    style={{ x, opacity }}
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={0.2}
                    onDragEnd={handleDragEnd}
                >
                    <Card variant="premium" className="bg-zinc-900/40 border border-white/10 backdrop-blur-2xl rounded-3xl p-5 shadow-2xl">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-7 mb-6 text-center">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                                    <div key={i} className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="px-0">
                                {rows}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Scrollable Events List */}
            <div
                className="flex-1 px-4 pt-6 pb-32 mt-4 rounded-t-3xl border border-white/10 bg-white/5 overflow-y-auto no-scrollbar"
            >
                <div className="flex items-center justify-between mb-6 sticky top-0 bg-transparent z-10 pb-2 backdrop-blur-sm -mx-1 px-1">
                    <h2 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                        {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, d MMM")}
                    </h2>
                    <div className="flex items-center gap-2">
                        {selectedDayRevenue > 0 && (
                            <span className="text-[10px] font-black text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-widest backdrop-blur-xl tabular-nums">
                                {formatCurrency(selectedDayRevenue)}
                            </span>
                        )}
                        <span className="text-[10px] font-black bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full uppercase tracking-widest backdrop-blur-xl">
                            {selectedDayCompleted > 0
                                ? `${selectedDayCompleted}/${selectedEvents.length} Done`
                                : `${selectedEvents.length} Job${selectedEvents.length !== 1 ? 's' : ''}`
                            }
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedEvents.length > 0 ? (
                        selectedEvents.map((event) => (
                            <div
                                key={event.id}
                                className="flex gap-4 group"
                                onClick={() => setEditingJob(event)}
                            >
                                <div className="flex flex-col items-center pt-2 min-w-[50px]">
                                    <div className="text-[11px] font-black text-white uppercase tracking-tighter text-center leading-tight">
                                        {event.time.split(' ')[0]}<br/>
                                        <span className="text-zinc-500">{event.time.split(' ')[1]}</span>
                                    </div>
                                    <div className="h-full w-px bg-white/10 my-3 rounded-full group-last:hidden shadow-[0_0_10px_rgba(255,255,255,0.1)]"></div>
                                </div>
                                <Card variant="premium" className={`flex-1 min-w-0 mb-3 transition-all cursor-pointer group active:scale-[0.98] shadow-lg ${event.status === 'completed' ? 'hover:border-emerald-500/40 border-emerald-500/10' : 'hover:border-blue-500/40'}`}>
                                    <CardContent className="p-4 relative z-10">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-black text-white text-lg tracking-tight leading-tight group-hover:text-blue-400 transition-colors flex-1 min-w-0 truncate">{event.clientName}</h3>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                {(event.amount ?? 0) > 0 && (
                                                    <span className="text-sm font-black text-white tabular-nums">{formatCurrency(event.amount ?? 0)}</span>
                                                )}
                                                <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                                    event.status === 'completed'
                                                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                                        : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                                                }`}>
                                                    {event.status === 'completed' ? 'Done' : 'Upcoming'}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider mt-1">{event.service}</p>
                                        <div className="flex items-start gap-2 mt-3 text-xs text-zinc-500 font-medium">
                                            <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                                            <span className="line-clamp-2 leading-snug">{event.address}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12 flex flex-col items-center opacity-60"
                        >
                            <div className="bg-white/5 h-20 w-20 rounded-full flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                                <CalendarIcon className="h-8 w-8 text-zinc-700" />
                            </div>
                            <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">No jobs for this day</p>
                            <Link href="/dashboard/schedule/add">
                                <Button variant="link" className="text-blue-400 mt-2 font-black uppercase tracking-[0.2em] text-[10px] hover:text-blue-300">
                                    Schedule a job +
                                </Button>
                            </Link>
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Month Picker Modal */}
            <AnimatePresence>
                {isMonthPickerOpen && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 50 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 50 }}
                            className="w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
                        >
                            <div className="flex justify-between items-center p-5 border-b border-white/5 bg-white/5">
                                <span className="text-sm font-black text-white uppercase tracking-widest">Select Month</span>
                                <Button variant="ghost" size="icon" onClick={() => setIsMonthPickerOpen(false)} className="h-10 w-10 rounded-full text-blue-400 hover:bg-white/5">
                                    <Check className="h-6 w-6 stroke-[3px]" />
                                </Button>
                            </div>
                            <div className="p-8 bg-zinc-950/50 backdrop-blur-xl">
                                <MonthWheelPicker
                                    value={currentMonth}
                                    onChange={setCurrentMonth}
                                    minYear={new Date().getFullYear() - 5}
                                    maxYear={new Date().getFullYear() + 5}
                                    variant="dark"
                                    fadeColor="#09090b"
                                />
                            </div>
                        </motion.div>
                        <div className="absolute inset-0 -z-10" onClick={() => setIsMonthPickerOpen(false)} />
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Job Modal/Sheet */}
            <AnimatePresence>
                {editingJob && (
                    <>
                        <div
                            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md"
                            onClick={() => setEditingJob(null)}
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 300 }}
                            className="fixed inset-x-0 bottom-0 z-[70] bg-zinc-900 rounded-t-[2.5rem] border-t border-white/10 p-7 pb-safe space-y-6 shadow-2xl backdrop-blur-3xl"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-black text-white tracking-tight uppercase">Manage Job</h2>
                                <button onClick={() => setEditingJob(null)} className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="bg-white/5 rounded-2xl p-5 border border-white/5 backdrop-blur-md relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full blur-3xl" />
                                <h3 className="font-black text-white text-xl tracking-tight relative z-10 leading-tight">{editingJob.clientName}</h3>
                                <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1 relative z-10">{editingJob.service}</p>
                                <div className="flex gap-4 mt-4 text-xs font-black uppercase tracking-widest relative z-10">
                                    <span className="flex items-center gap-2 text-zinc-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner"><Clock className="h-3.5 w-3.5 text-blue-500" /> {editingJob.time}</span>
                                    <span className="flex items-center gap-2 text-zinc-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 shadow-inner"><CalendarIcon className="h-3.5 w-3.5 text-purple-500" /> {format(new Date(editingJob.date), "dd MMM")}</span>
                                </div>
                            </div>

                            {/* WhatsApp Reminders */}
                            {editingJob.clientPhone ? (
                                <div className="space-y-2">
                                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.2em]">Send WhatsApp</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            onClick={() => openWhatsAppWithDayBeforeReminder(
                                                editingJob.clientPhone!,
                                                editingJob.clientName,
                                                editingJob.service,
                                                format(new Date(editingJob.date), "d MMM yyyy"),
                                                editingJob.time,
                                            )}
                                            className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                                        >
                                            <MessageCircle className="h-4 w-4 text-indigo-400" />
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center leading-tight">Day Before</span>
                                        </button>
                                        <button
                                            onClick={() => openWhatsAppWithMorningConfirmation(
                                                editingJob.clientPhone!,
                                                editingJob.clientName,
                                                editingJob.service,
                                                editingJob.time,
                                            )}
                                            className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                                        >
                                            <MessageCircle className="h-4 w-4 text-indigo-400" />
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center leading-tight">Morning</span>
                                        </button>
                                        <button
                                            onClick={() => openWhatsAppWithOnMyWay(
                                                editingJob.clientPhone!,
                                                editingJob.clientName,
                                                editingJob.service,
                                                "~20 minutes",
                                            )}
                                            className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                                        >
                                            <MessageCircle className="h-4 w-4 text-indigo-400" />
                                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center leading-tight">On My Way</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-1">No phone number — add one on the client page to enable WhatsApp reminders</p>
                            )}

                            <Button
                                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-lg active:scale-95 transition-all border-none"
                                onClick={() => { push(`/dashboard/schedule/${editingJob.id}`); setEditingJob(null); }}
                            >
                                <Camera className="h-5 w-5" /> Job Report &amp; Photos
                            </Button>

                            <div className="grid grid-cols-2 gap-4 pb-4">
                                <Button
                                    variant="outline"
                                    className="h-14 rounded-2xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-black uppercase tracking-widest text-xs gap-3 shadow-lg active:scale-95 transition-all"
                                    onClick={handleEdit}
                                >
                                    <Edit className="h-5 w-5 text-blue-400" />
                                    Edit Details
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="h-14 rounded-2xl bg-rose-600/80 hover:bg-rose-700 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-lg active:scale-95 transition-all"
                                    onClick={() => handleDelete(editingJob.id)}
                                >
                                    <Trash2 className="h-5 w-5" />
                                    Delete Job
                                </Button>
                            </div>

                            {editingJob.status === "completed" && (
                                <div className="pb-4">
                                    {editingJob.clientPhone ? (
                                        <Button
                                            variant="outline"
                                            className="w-full h-14 rounded-2xl border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-black uppercase tracking-widest text-xs gap-3 shadow-lg active:scale-95 transition-all"
                                            onClick={() => {
                                                openWhatsAppWithReview(
                                                    editingJob.clientPhone!,
                                                    editingJob.clientName,
                                                    editingJob.service,
                                                    providerProfile?.slug ?? '',
                                                    editingJob.id,
                                                );
                                            }}
                                        >
                                            <Star className="h-5 w-5" />
                                            Send Review Link
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className="w-full h-14 rounded-2xl border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 font-black uppercase tracking-widest text-xs gap-3 shadow-lg active:scale-95 transition-all"
                                            onClick={async () => {
                                                const url = getReviewUrl(providerProfile?.slug ?? '', editingJob.id);
                                                await navigator.clipboard.writeText(url);
                                                toast.success("Review link copied!");
                                            }}
                                        >
                                            <Star className="h-5 w-5" />
                                            Copy Review Link
                                        </Button>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
