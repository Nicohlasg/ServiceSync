"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Clock, MapPin, Calendar, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";

export default function RequestsPage() {
    const [processing, setProcessing] = useState<string | null>(null);
    const utils = api.useUtils();
    const { push } = useRouter();

    // Query key for the pending-bookings list — shared by query + optimistic updates
    const pendingInput = { status: "pending" as const, limit: 50 };

    // Fetch pending bookings via tRPC
    const {
        data: bookingsData,
        isLoading,
        isError,
        refetch,
    } = api.booking.listBookings.useQuery(pendingInput, { refetchInterval: 30000 });

    // Also fetch today's accepted/in-progress jobs for clash detection
    const today = new Date().toISOString().slice(0, 10);
    const { data: todayJobs } = api.booking.listBookings.useQuery(
        { status: "accepted", date: today, limit: 50 },
    );

    /**
     * Optimistic mutation helper: both accept + decline remove the booking from
     * the pending list immediately, then roll back on error.
     */
    const removeOptimistically = async (bookingId: string) => {
        // Cancel outgoing refetches so they don't clobber our optimistic update
        await utils.booking.listBookings.cancel(pendingInput);
        const previous = utils.booking.listBookings.getData(pendingInput);
        utils.booking.listBookings.setData(pendingInput, (old) => {
            if (!old) return old;
            return { ...old, bookings: old.bookings.filter((b) => b.id !== bookingId) };
        });
        return { previous };
    };

    const acceptMutation = api.booking.acceptBooking.useMutation({
        onMutate: ({ bookingId }) => removeOptimistically(bookingId),
        onSuccess: () => {
            toast.success("Request accepted and scheduled!");
            // Navigate to schedule — the page's useEffect re-runs on mount,
            // so the newly accepted job loads automatically. No manual refresh needed.
            push("/dashboard/schedule");
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.previous) {
                utils.booking.listBookings.setData(pendingInput, ctx.previous);
            }
            toast.error(err.message || "Failed to accept booking");
        },
        onSettled: () => {
            utils.booking.listBookings.invalidate();
            setProcessing(null);
        },
    });

    const declineMutation = api.booking.declineBooking.useMutation({
        onMutate: ({ bookingId }) => removeOptimistically(bookingId),
        onSuccess: () => {
            toast.info("Request declined");
        },
        onError: (err, _vars, ctx) => {
            if (ctx?.previous) {
                utils.booking.listBookings.setData(pendingInput, ctx.previous);
            }
            toast.error(err.message || "Failed to decline booking");
        },
        onSettled: () => {
            utils.booking.listBookings.invalidate();
            setProcessing(null);
        },
    });

    const handleAction = (bookingId: string, action: "accept" | "decline") => {
        setProcessing(bookingId);
        if (action === "accept") {
            acceptMutation.mutate({ bookingId });
        } else {
            declineMutation.mutate({ bookingId });
        }
    };

    const requests = bookingsData?.bookings ?? [];
    const existingJobs = todayJobs?.bookings ?? [];

    const checkClash = (scheduledDate: string, arrivalStart: string | null) => {
        if (!arrivalStart) return false;
        const reqStart = new Date(arrivalStart).getTime();
        return existingJobs.some((j) => {
            if (j.scheduled_date !== scheduledDate || !j.arrival_window_start || !j.arrival_window_end) return false;
            const jobStart = new Date(j.arrival_window_start).getTime();
            const jobEnd = new Date(j.arrival_window_end).getTime();
            return reqStart >= jobStart && reqStart < jobEnd;
        });
    };

    if (isLoading) {
        return (
            <div className="space-y-6 pt-4 px-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <SkeletonLine width="40px" className="h-10 rounded-full" />
                        <SkeletonLine width="140px" className="h-7" />
                    </div>
                    <SkeletonLine width="70px" className="h-6 rounded-full" />
                </div>
                {/* Request card skeletons — match actual card shape */}
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card glass-inner-light rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                            <SkeletonLine width="45%" className="h-5" />
                            <SkeletonLine width="60px" className="h-5 rounded-full" />
                        </div>
                        <div className="flex items-center gap-2">
                            <SkeletonLine width="16px" className="h-4 rounded" />
                            <SkeletonLine width="65%" className="h-3" />
                        </div>
                        <div className="flex items-center gap-2">
                            <SkeletonLine width="16px" className="h-4 rounded" />
                            <SkeletonLine width="40%" className="h-3" />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <SkeletonLine width="48%" className="h-11 rounded-xl" />
                            <SkeletonLine width="48%" className="h-11 rounded-xl" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4 text-white">
                <p className="text-rose-400 font-bold uppercase tracking-widest text-xs">Failed to load requests.</p>
                <Button variant="outline" onClick={() => refetch()} className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl font-black uppercase tracking-widest text-[10px]">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 h-full flex flex-col text-white">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <BackButton />
                    <h1 className="text-2xl font-black text-white tracking-tight">Job Requests</h1>
                </div>
                <div className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-xl">
                    {requests.length} New
                </div>
            </motion.div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-32 space-y-5 px-1">
                <AnimatePresence mode="popLayout">
                    {requests.length > 0 ? (
                        requests.map((req, i: number) => {
                            const isClashing = checkClash(req.scheduled_date, req.arrival_window_start);
                            const clientInfo = req.clients ?? {};
                            const displayName = req.client_name || clientInfo.name || "Unknown";
                            const displayAddress = req.address || clientInfo.address || "";
                            const displayAmount = req.amount ?? 0;
                            const arrivalTime = req.arrival_window_start
                                ? new Date(req.arrival_window_start).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Singapore" })
                                : "";

                            return (
                                <motion.div
                                    key={req.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Card variant="premium" className="overflow-hidden shadow-2xl backdrop-blur-2xl rounded-3xl">
                                        <CardContent className="p-0 relative z-10">
                                            <div className="p-6 space-y-5">
                                                <div className="flex justify-between items-start">
                                                    <div className="overflow-hidden">
                                                        <h3 className="font-black text-xl text-white tracking-tight truncate leading-tight">{displayName}</h3>
                                                        <div className="flex items-center gap-1.5 text-zinc-400 text-xs font-bold mt-1 uppercase tracking-wider">
                                                            <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                                            <span className="truncate max-w-[200px]">{displayAddress}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="font-black text-white text-xl tracking-tight">{formatCurrency(displayAmount / 100)}</p>
                                                        <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-1">{req.service_type}</p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-3 text-xs font-black uppercase tracking-widest">
                                                    <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl text-zinc-200 border border-white/10 shadow-inner">
                                                        <Calendar className="h-4 w-4 text-blue-500" />
                                                        {req.scheduled_date ? format(new Date(req.scheduled_date + "T00:00:00"), "dd MMM") : "TBD"}
                                                    </div>
                                                    {arrivalTime && (
                                                        <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-xl text-zinc-200 border border-white/10 shadow-inner">
                                                            <Clock className="h-4 w-4 text-purple-500" />
                                                            {arrivalTime}
                                                        </div>
                                                    )}
                                                </div>

                                                {isClashing && (
                                                    <div className="flex items-center gap-3 bg-rose-500/10 text-rose-400 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-rose-500/20 backdrop-blur-md">
                                                        <AlertCircle className="h-5 w-5 shrink-0" />
                                                        <span>Time Clash: overlaps with an existing job</span>
                                                    </div>
                                                )}

                                                {req.notes && (
                                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 backdrop-blur-md relative overflow-hidden group">
                                                        <div className="absolute top-0 right-0 w-1 bg-amber-500/40 h-full" />
                                                        <p className="text-[11px] text-zinc-400 font-medium leading-relaxed italic">&quot;{req.notes}&quot;</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="grid grid-cols-2 border-t border-white/10 divide-x divide-white/10 bg-white/5">
                                                <button
                                                    disabled={processing === req.id}
                                                    onClick={() => handleAction(req.id, "decline")}
                                                    className="py-5 text-zinc-500 font-black text-[10px] uppercase tracking-widest hover:bg-rose-500/10 hover:text-rose-400 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <X className="h-4 w-4" /> Decline
                                                </button>
                                                <button
                                                    disabled={processing === req.id}
                                                    onClick={() => handleAction(req.id, "accept")}
                                                    className="py-5 text-blue-400 font-black text-[10px] uppercase tracking-widest hover:bg-blue-600/10 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {processing === req.id ? (
                                                        <span className="animate-pulse">Processing...</span>
                                                    ) : (
                                                        <>
                                                            <Check className="h-4 w-4 stroke-[3px]" /> Accept Job
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/5 border-dashed backdrop-blur-md"
                        >
                            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                <Clock className="h-10 w-10 text-zinc-700" />
                            </div>
                            <p className="text-xl font-black text-white tracking-tight uppercase">No new requests</p>
                            <p className="text-sm text-zinc-500 font-bold mt-1 uppercase tracking-wider">You&apos;re all caught up!</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
