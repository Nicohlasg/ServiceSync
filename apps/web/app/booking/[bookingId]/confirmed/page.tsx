"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, MapPin, ShieldCheck, ArrowLeft, Home } from "lucide-react";
import { SkeletonLineLight, SkeletonCircleLight } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 text-white">
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Invalid booking link.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col pt-4">
        <div className="px-4 mb-6 space-y-2">
          <SkeletonLineLight width="55%" className="h-5" />
          <SkeletonLineLight width="30%" className="h-3" />
        </div>
        <div className="flex-1 rounded-t-[2.5rem] bg-white/5 border-t border-white/10 backdrop-blur-xl px-5 pt-8">
          <div className="text-center space-y-6 pt-8">
            <SkeletonCircleLight size={96} className="mx-auto rounded-[2rem]" />
            <div className="space-y-3 flex flex-col items-center">
              <SkeletonLineLight width="65%" className="h-7" />
              <SkeletonLineLight width="80%" className="h-4" />
            </div>
            <div className="bg-white/5 rounded-2xl border border-white/5 p-4 space-y-3 mt-8">
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
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 gap-4 text-white">
        <p className="text-zinc-400 text-center max-w-sm font-medium">
          We couldn&apos;t load this booking confirmation. The link may be invalid or expired.
        </p>
        <Button onClick={() => refetch()} variant="outline" className="rounded-xl border-white/10 bg-white/5 text-white hover:bg-white/10 font-bold uppercase tracking-widest text-xs h-12">
          Try again
        </Button>
        <Link href="/">
            <Button className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-xs h-12 px-8">
                Home
            </Button>
        </Link>
      </div>
    );
  }

  const timeStr = formatTimeSg(data.arrivalWindowStart);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col pt-4 overflow-hidden text-white">
      <div className="px-4 mb-6 relative z-10 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(profileHref)} className="rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm hover:bg-white/10 text-white">
            <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
            <h1 className="text-xl font-black text-white tracking-tight">Booking confirmed</h1>
            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest mt-0.5">{data.providerName}</p>
        </div>
      </div>

      <div className="flex-1 rounded-t-[2.5rem] bg-zinc-950/40 border-t border-white/10 backdrop-blur-2xl shadow-2xl relative px-5 pt-8 pb-24 overflow-y-auto">
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
            <h2 className="text-3xl font-black text-white tracking-tight">Booking Confirmed!</h2>
            <p className="text-zinc-400 font-medium">
              {data.providerName} has received your request
              {data.scheduledDate ? (
                <>
                  {" "}
                  for{" "}
                  <span className="text-white font-black">{data.scheduledDate}</span>
                  {timeStr ? (
                    <>
                      {" "}
                      at <span className="text-white font-black">{timeStr}</span>
                    </>
                  ) : null}
                  .
                </>
              ) : (
                "."
              )}
            </p>
          </div>

          <Card variant="premium" className="bg-white/5 border-white/10 shadow-xl rounded-[2rem] text-left mt-8 backdrop-blur-xl">
            <CardContent className="p-6 space-y-4 relative z-10">
              <div className="flex gap-4">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0 h-fit">
                    <MapPin className="h-5 w-5" />
                </div>
                <p className="text-sm font-bold text-zinc-200 leading-snug">{data.addressArea}</p>
              </div>
              {data.depositSecured && (
                <div className="flex gap-4">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0 h-fit">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-zinc-200 leading-snug">
                    Deposit held securely in ServiceSync escrow.
                  </p>
                </div>
              )}
              <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Reference</span>
                <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded border border-white/5">{data.id}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3 pt-4 max-w-sm mx-auto">
            <Button
                variant="outline"
                size="lg"
                onClick={() => {
                const url = `${window.location.origin}/booking/${bookingId}/confirmed`;
                void navigator.clipboard.writeText(url);
                toast.success("Confirmation link copied!");
                }}
                className="w-full h-14 rounded-2xl font-black bg-white/5 text-white border-white/10 backdrop-blur-md active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
                Copy confirmation link
            </Button>

            <Button
                variant="outline"
                size="lg"
                onClick={() => router.push(profileHref)}
                className="w-full h-14 rounded-2xl font-black bg-blue-600 hover:bg-blue-700 text-white border-none shadow-xl shadow-blue-600/20 active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
                Back to profile
            </Button>

            <Link href="/" className="block pt-2">
                <Button variant="ghost" className="text-zinc-500 hover:text-zinc-300 font-black uppercase tracking-widest text-[10px]">
                    <Home className="h-3 w-3 mr-2" /> Home
                </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
