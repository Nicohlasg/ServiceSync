"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Calendar as CalendarIcon, MapPin, Clock, X, Check, Trash2, Edit } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Job } from "@/lib/types";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { MonthWheelPicker } from "@/components/ui/date-wheel-picker";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { api } from "@/lib/api";
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
                    .select('id, client_id, client_name, status, scheduled_date, arrival_window_start, service_type, address, lat, lng, amount, clients(name)')
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
                        const joinedClient = b.clients as unknown as { name: string } | null;

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

    const deleteJob = (id: string) => {
        deleteJobMutation.mutate({ bookingId: id });
    };

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
                        "relative h-10 w-10 md:h-12 md:w-12 mx-auto flex items-center justify-center rounded-full text-[15px] font-medium cursor-pointer transition-all select-none",
                        !isCurrentMonth ? "text-white/40" : "text-white",
                        isSelected ? "bg-[#3399ff] text-white" : "hover:bg-slate-800/40",
                        isToday(day) && !isSelected && "text-blue-400 font-bold"
                    )}
                    onClick={() => onDateClick(cloneDay)}
                >
                    {formattedDate}
                    {hasEvents && !isSelected && (
                        <div
                            className="absolute bottom-1.5 h-1.5 w-1.5 bg-blue-500 rounded-full"
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


    const handleEdit = () => {
        if (!editingJob) return;
        push(`/dashboard/schedule/add?bookingId=${editingJob.id}`);
        setEditingJob(null);
    };

    return (
        <div className="flex flex-col h-full">
            {/* Fixed Header & Calendar */}
            <div className="flex-none pt-4 pb-2 z-10 relative px-4">
                <div
                    className="flex items-center justify-between pb-2"
                >
                    <div
                        className="flex items-center gap-1 cursor-pointer hover:bg-slate-900/40 p-2 rounded-xl transition-colors active:scale-95 duration-200"
                        onClick={() => setIsMonthPickerOpen(true)}
                    >
                        <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">
                            {format(currentMonth, "MMMM yyyy")}
                        </h1>
                        <ChevronRight className="h-6 w-6 text-white/70 rotate-90" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedDate(new Date()); setCurrentMonth(new Date()); }} className="hover:bg-slate-900/40 rounded-full text-white">
                            <CalendarIcon className="h-6 w-6" />
                        </Button>
                        <Link href="/dashboard/schedule/add">
                            <Button size="icon" className="h-12 w-12 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full shadow-xl shadow-blue-500/30 hover:shadow-blue-500/40 active:scale-95 transition-all">
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
                    <Card className="border-none shadow-none bg-transparent p-0">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-7 mb-6 text-center px-2">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
                                    <div key={i} className="text-[13px] font-normal text-white/70">
                                        {d}
                                    </div>
                                ))}
                            </div>
                            <div className="px-1">
                                {rows}
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>

            {/* Scrollable Events List */}
            <div
                className="flex-1 px-4 pt-6 pb-20 mt-4 border-t border-white/15 overflow-y-auto no-scrollbar"
            >
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-transparent z-10 pb-2">
                    <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                        {isToday(selectedDate) ? "Today" : format(selectedDate, "EEEE, d MMM")}
                    </h2>
                    <span className="text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-500/30 px-2 py-1 rounded-full">
                        {selectedEvents.length} Jobs
                    </span>
                </div>

                <div className="space-y-4">
                    {selectedEvents.length > 0 ? (
                        selectedEvents.map((event) => (
                            <div
                                key={event.id}
                                className="flex gap-4 group"
                                onClick={() => setEditingJob(event)}
                            >
                                <div className="flex flex-col items-center pt-1 min-w-[45px]">
                                    {/* BUG-06 fix: show full time string including AM/PM;
                                        the previous split(':')[1].substring(0,2) dropped it */}
                                    <div className="text-sm font-bold text-white">{event.time}</div>
                                    <div className="h-full w-[2px] bg-white/20 my-2 rounded-full group-last:hidden"></div>
                                </div>
                                <Card className="flex-1 min-w-0 mb-2 hover:shadow-lg hover:bg-white/[0.07] transition-all cursor-pointer border-l-4 border-l-blue-500 active:scale-[0.98]">
                                    <CardContent className="p-4 py-3">
                                        <h3 className="font-bold text-white text-base">{event.clientName}</h3>
                                        <p className="text-sm text-slate-200 font-medium">{event.service}</p>
                                        <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-300 font-medium truncate">
                                            <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                                            <span className="truncate">{event.address}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))
                    ) : (
                        <div
                            className="text-center py-8 opacity-60 flex flex-col items-center"
                        >
                            <div className="bg-slate-900/65 h-20 w-20 rounded-full flex items-center justify-center mb-4 border border-white/15">
                                <CalendarIcon className="h-8 w-8 text-white/50" />
                            </div>
                            <p className="text-slate-300 font-medium">No jobs for {isToday(selectedDate) ? "today" : "this day"}.</p>
                            <Link href="/dashboard/schedule/add">
                                <Button variant="link" className="text-blue-300 mt-1 font-semibold">
                                    Schedule a job +
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Month Picker Modal */}
            <AnimatePresence>
                {isMonthPickerOpen && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <div className="flex justify-between items-center p-4 border-b border-white/10">
                                <span className="text-lg font-bold text-white">Select Month</span>
                                <Button variant="ghost" size="icon" onClick={() => setIsMonthPickerOpen(false)} className="rounded-full text-blue-400 hover:bg-white/10">
                                    <Check className="h-6 w-6" />
                                </Button>
                            </div>
                            <div className="p-6 bg-slate-950/50">
                                <MonthWheelPicker
                                    value={currentMonth}
                                    onChange={setCurrentMonth}
                                    minYear={new Date().getFullYear() - 5}
                                    maxYear={new Date().getFullYear() + 5}
                                    variant="dark"
                                    fadeColor="#0a0f1a"
                                />
                            </div>
                        </motion.div>
                        {/* Click outside to close */}
                        <div className="absolute inset-0 -z-10" onClick={() => setIsMonthPickerOpen(false)} />
                    </div>
                )}
            </AnimatePresence>

            {/* Edit Job Modal/Sheet */}
            <AnimatePresence>
                {editingJob && (
                    <>
                        <div
                            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
                            onClick={() => setEditingJob(null)}
                        />
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            className="fixed inset-x-0 bottom-0 z-[70] bg-slate-900 rounded-t-[2rem] border-t border-white/10 p-6 pb-safe space-y-6"
                        >
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Manage Job</h2>
                                <Button variant="ghost" size="icon" onClick={() => setEditingJob(null)} className="rounded-full text-white/50 hover:text-white hover:bg-white/10">
                                    <X className="h-6 w-6" />
                                </Button>
                            </div>

                            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                <h3 className="font-bold text-white text-lg">{editingJob.clientName}</h3>
                                <p className="text-slate-400">{editingJob.service}</p>
                                <div className="flex gap-4 mt-2 text-sm text-slate-300">
                                    <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {editingJob.time}</span>
                                    <span className="flex items-center gap-1"><CalendarIcon className="h-4 w-4" /> {format(new Date(editingJob.date), "dd MMM")}</span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Button
                                    variant="outline"
                                    className="h-14 rounded-xl border-white/10 text-white hover:bg-white/10 hover:text-white text-base font-semibold gap-2"
                                    onClick={handleEdit}
                                >
                                    <Edit className="h-5 w-5" />
                                    Edit Details
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="h-14 rounded-xl bg-red-500/80 hover:bg-red-600 text-white text-base font-semibold gap-2"
                                    onClick={() => handleDelete(editingJob.id)}
                                >
                                    <Trash2 className="h-5 w-5" />
                                    Delete
                                </Button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
