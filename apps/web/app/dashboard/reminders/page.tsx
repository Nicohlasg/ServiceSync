"use client";
import { useState, useRef } from "react";
import { format, parseISO, addDays, subDays } from "date-fns";
import { motion } from "framer-motion";
import { Bell, ChevronLeft, ChevronRight, MessageCircle, Clock, Calendar } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  openWhatsAppWithDayBeforeReminder,
  openWhatsAppWithMorningConfirmation,
  openWhatsAppWithOnMyWay,
} from "@/lib/whatsapp-helpers";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function RemindersPage() {
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const dateInputRef = useRef<HTMLInputElement>(null);

  const { data: jobs = [], isLoading } = api.schedule.getRemindersForDate.useQuery(
    { date },
    { staleTime: 30_000 }
  );

  const { data: hasSubscription } = api.notifications.hasSubscription.useQuery();

  const savePushSubscription = api.notifications.savePushSubscription.useMutation({
    onSuccess: () => toast.success("Push notifications enabled!"),
    onError: () => toast.error("Failed to save push subscription"),
  });

  async function handleEnablePush() {
    try {
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        toast.error("Push notifications not configured");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Notification permission denied");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subJson = subscription.toJSON();
      const p256dh = subJson.keys?.p256dh ?? "";
      const auth = subJson.keys?.auth ?? "";

      savePushSubscription.mutate({
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      });
    } catch {
      toast.error("Push notifications not configured");
    }
  }

  const dateLabel = format(parseISO(date), "d MMM yyyy");

  return (
    <div className="space-y-5 pt-4 pb-28 px-4 text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3"
      >
        <BackButton href="/dashboard" />
        <div className="flex-1">
          <h1 className="text-2xl font-black text-white">Reminders</h1>
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">
            Send WhatsApp reminders to clients
          </p>
        </div>
      </motion.div>

      {/* Date selector */}
      <div className="flex items-center justify-between bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
        <button
          onClick={() => setDate((d) => format(subDays(parseISO(d), 1), "yyyy-MM-dd"))}
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
          className="flex items-center gap-2 font-black text-white text-base hover:text-blue-300 transition-colors"
        >
          <Calendar className="h-4 w-4 text-blue-400" />
          {format(parseISO(date), "EEEE, d MMMM")}
          {date === format(new Date(), "yyyy-MM-dd") && (
            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-[8px] font-black uppercase tracking-widest text-blue-300">
              Today
            </span>
          )}
        </button>
        <button
          onClick={() => setDate((d) => format(addDays(parseISO(d), 1), "yyyy-MM-dd"))}
          className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Bell className="h-12 w-12 text-zinc-700 mx-auto" />
          <p className="text-zinc-400 font-black text-lg">No jobs on this date</p>
          <p className="text-zinc-600 text-sm">Schedule a job to send reminders</p>
        </div>
      ) : (
        <div className="space-y-4">
          {(jobs as any[]).map((j: any, index: number) => {
            const timeLabel = format(parseISO(j.arrivalWindowStart), "h:mm a");
            // Mark as completed if DB status is completed OR if the scheduled time
            // has already passed (covers public bookings that stay "pending" forever).
            const isCompleted = j.status === "completed" || parseISO(j.arrivalWindowStart) < new Date();

            return (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card variant="premium" className="rounded-2xl backdrop-blur-2xl">
                  <CardContent className="p-5 relative z-10 space-y-4">
                    {/* Job info row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-white text-base tracking-tight truncate">
                          {j.clientName}
                        </p>
                        <p className="text-xs font-black text-indigo-400 uppercase tracking-widest mt-0.5">
                          {j.serviceType}
                        </p>
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeLabel}
                        </p>
                      </div>
                      <div
                        className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                          isCompleted
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                        }`}
                      >
                        {isCompleted ? "Completed" : "Upcoming"}
                      </div>
                    </div>

                    {/* WhatsApp action buttons */}
                    {j.clientPhone ? (
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() =>
                            openWhatsAppWithDayBeforeReminder(
                              j.clientPhone,
                              j.clientName,
                              j.serviceType,
                              dateLabel,
                              timeLabel
                            )
                          }
                          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                        >
                          <MessageCircle className="h-4 w-4 text-indigo-400" />
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center leading-tight">
                            Day Before
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            openWhatsAppWithMorningConfirmation(
                              j.clientPhone,
                              j.clientName,
                              j.serviceType,
                              timeLabel
                            )
                          }
                          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                        >
                          <MessageCircle className="h-4 w-4 text-indigo-400" />
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center leading-tight">
                            Morning
                          </span>
                        </button>
                        <button
                          onClick={() =>
                            openWhatsAppWithOnMyWay(
                              j.clientPhone,
                              j.clientName,
                              j.serviceType,
                              "~20 minutes"
                            )
                          }
                          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                        >
                          <MessageCircle className="h-4 w-4 text-indigo-400" />
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest text-center leading-tight">
                            On My Way
                          </span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest px-3 py-1.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                          No phone number
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Push Notifications section */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-indigo-400" /> Push Notifications
        </p>
        <Card variant="premium" className="rounded-2xl backdrop-blur-2xl">
          <CardContent className="p-5 relative z-10">
            {hasSubscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-white text-sm">Push Notifications Active</p>
                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">
                      Enabled
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                    On
                  </span>
                </div>
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                  To disable, manage in browser settings
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <Bell className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-white text-sm">Push Notifications</p>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
                      Get notified for new bookings
                    </p>
                  </div>
                </div>
                <Button
                  onClick={handleEnablePush}
                  disabled={savePushSubscription.isPending}
                  className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] border border-indigo-400/30 shadow-lg shadow-indigo-500/20"
                >
                  <Bell className="h-4 w-4 mr-2" />
                  Enable Push Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
