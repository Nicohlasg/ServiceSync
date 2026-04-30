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
            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between">
                    <SkeletonLine width="45%" className="h-7" />
                    <SkeletonLine width="70px" className="h-6 rounded-full" />
                </div>
                <div className="space-y-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-red-400 font-medium">Failed to load requests.</p>
                <Button variant="outline" onClick={() => refetch()} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 h-full flex flex-col">
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <div className="flex items-center gap-3">
                    <BackButton />
                    <h1 className="text-2xl font-bold text-white drop-shadow-md">Job Requests</h1>
                </div>
                <div className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                    {requests.length} New
                </div>
            </motion.div>

            <div className="flex-1 overflow-y-auto no-scrollbar pb-10 space-y-4">
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
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -100 }}
                                    transition={{ delay: i * 0.1 }}
                                >
                                    <Card className="overflow-hidden shadow-lg">
                                        <CardContent className="p-0">
                                            <div className="p-5 space-y-4">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-bold text-lg text-white">{displayName}</h3>
                                                        <div className="flex items-center gap-1 text-slate-300 text-sm">
                                                            <MapPin className="h-3.5 w-3.5" />
                                                            <span className="truncate max-w-[200px]">{displayAddress}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-blue-300 text-lg">{formatCurrency(displayAmount / 100)}</p>
                                                        <p className="text-xs text-slate-400 font-medium">{req.service_type}</p>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 text-sm font-medium">
                                                    <div className="flex items-center gap-1.5 bg-slate-900/40 px-3 py-1.5 rounded-lg text-slate-200 border border-white/10">
                                                        <Calendar className="h-4 w-4 text-slate-400" />
                                                        {req.scheduled_date ? format(new Date(req.scheduled_date + "T00:00:00"), "dd MMM") : "TBD"}
                                                    </div>
                                                    {arrivalTime && (
                                                        <div className="flex items-center gap-1.5 bg-slate-900/40 px-3 py-1.5 rounded-lg text-slate-200 border border-white/10">
                                                            <Clock className="h-4 w-4 text-slate-400" />
                                                            {arrivalTime}
                                                        </div>
                                                    )}
                                                </div>

                                                {isClashing && (
                                                    <div className="flex items-center gap-2 bg-rose-500/15 text-rose-200 px-3 py-2 rounded-lg text-xs font-bold border border-rose-400/25 backdrop-blur-sm">
                                                        <AlertCircle className="h-4 w-4" />
                                                        Warning: Clashes with an existing job
                                                    </div>
                                                )}

                                                {req.notes && (
                                                    <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-400/25 backdrop-blur-sm">
                                                        <p className="text-xs text-amber-200 font-medium leading-relaxed">&quot;{req.notes}&quot;</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className="grid grid-cols-2 border-t border-white/15 divide-x divide-white/15">
                                                <button
                                                    disabled={processing === req.id}
                                                    onClick={() => handleAction(req.id, "decline")}
                                                    className="py-4 text-slate-400 font-semibold text-sm hover:bg-slate-900/80 active:bg-slate-900/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    <X className="h-4 w-4" /> Decline
                                                </button>
                                                <button
                                                    disabled={processing === req.id}
                                                    onClick={() => handleAction(req.id, "accept")}
                                                    className="py-4 text-blue-300 font-bold text-sm hover:bg-slate-900/80 active:bg-slate-900/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {processing === req.id ? (
                                                        <span className="animate-pulse">Processing...</span>
                                                    ) : (
                                                        <>
                                                            <Check className="h-4 w-4" /> Accept Job
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
                        <div className="text-center py-12 opacity-50 bg-slate-900/65 rounded-3xl border border-white/15 backdrop-blur-md">
                            <p className="text-lg font-medium text-slate-300">No new requests</p>
                            <p className="text-sm text-slate-400">You&apos;re all caught up!</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
