"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, MapPin, ShieldCheck } from "lucide-react";
import { SkeletonLineLight, SkeletonCircleLight } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
// formatCurrency removed — SEC-H1: deposit amount no longer exposed publicly
import { toast } from "sonner";

function formatTimeSg(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-SG", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Singapore",
  });
}

export default function BookingConfirmedPage() {
  const params = useParams<{ bookingId: string }>();
  const router = useRouter();
  const bookingId = params?.bookingId ?? "";

  const { data, isLoading, isError, refetch } = api.booking.getBookingConfirmation.useQuery(
    { bookingId },
    { enabled: Boolean(bookingId) },
  );

  const profileHref = data?.providerSlug ? `/p/${data.providerSlug}` : data?.providerId ? `/p/${data.providerId}` : "/";

  if (!bookingId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <p className="text-slate-600">Invalid booking link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col pt-4">
        <div className="px-4 mb-6 space-y-2">
          <SkeletonLineLight width="55%" className="h-5" />
          <SkeletonLineLight width="30%" className="h-3" />
        </div>
        <div className="flex-1 rounded-t-[2.5rem] bg-white shadow-sm px-5 pt-8">
          <div className="text-center space-y-6 pt-8">
            <SkeletonCircleLight size={96} className="mx-auto rounded-[2rem]" />
            <div className="space-y-3 flex flex-col items-center">
              <SkeletonLineLight width="65%" className="h-7" />
              <SkeletonLineLight width="80%" className="h-4" />
            </div>
            <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-3 mt-8">
              <SkeletonLineLight width="75%" />
              <SkeletonLineLight width="60%" />
              <SkeletonLineLight width="40%" className="h-3" />
            </div>
            <SkeletonLineLight width="100%" className="h-12 rounded-2xl mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 gap-4">
        <p className="text-slate-700 text-center max-w-sm">
          We couldn&apos;t load this booking confirmation. The link may be invalid or expired.
        </p>
        <Button onClick={() => refetch()} variant="outline" className="rounded-2xl">
          Try again
        </Button>
        <Button onClick={() => router.push("/")} className="rounded-2xl bg-blue-600">
          Home
        </Button>
      </div>
    );
  }

  const timeStr = formatTimeSg(data.arrivalWindowStart);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-4 overflow-hidden">
      <div className="px-4 mb-6 relative z-10">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Booking confirmed</h1>
        <p className="text-xs text-blue-600 font-bold uppercase tracking-widest mt-0.5">{data.providerName}</p>
      </div>

      <div className="flex-1 rounded-t-[2.5rem] bg-white shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.05)] relative px-5 pt-8 pb-24 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 pt-8"
        >
          <div className="mx-auto w-24 h-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-500/40 relative">
            <CheckCircle2 className="h-12 w-12" />
            <motion.div
              className="absolute -inset-4 border-2 border-emerald-500/30 rounded-[2.5rem] -z-10"
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Booking Confirmed!</h2>
            <p className="text-slate-500 font-medium">
              {data.providerName} has received your request
              {data.scheduledDate ? (
                <>
                  {" "}
                  for{" "}
                  <span className="text-slate-900 font-bold">{data.scheduledDate}</span>
                  {timeStr ? (
                    <>
                      {" "}
                      at <span className="text-slate-900 font-bold">{timeStr}</span>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "."
              )}
            </p>
          </div>

          <Card className="bg-slate-50 border-slate-100 shadow-sm rounded-2xl text-left mt-8">
            <CardContent className="p-4 space-y-3">
              <div className="flex gap-3">
                <MapPin className="h-5 w-5 text-slate-400 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-slate-700 leading-tight">{data.addressArea}</p>
              </div>
              {data.depositSecured && (
                <div className="flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-slate-700 leading-tight">
                    Deposit held securely in ServiceSync escrow.
                  </p>
                </div>
              )}
              <p className="text-xs text-slate-400 pt-2">Reference: {data.id}</p>
            </CardContent>
          </Card>

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              const url = `${window.location.origin}/booking/${bookingId}/confirmed`;
              void navigator.clipboard.writeText(url);
              toast.success("Confirmation link copied to clipboard!");
            }}
            className="w-full h-12 rounded-2xl font-bold bg-white text-slate-700 border-slate-200 mt-6"
          >
            Copy confirmation link
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={() => router.push(profileHref)}
            className="w-full h-14 rounded-2xl font-bold bg-white text-slate-700 border-slate-200 mt-2"
          >
            Back to profile
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
