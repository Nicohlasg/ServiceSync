"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, MapPin, Clock, ShieldCheck, Zap } from "lucide-react";
import { SkeletonLineLight, SkeletonCardLight } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

interface ProviderInfo { id: string; name: string; }
interface ServiceOption { id: string; name: string; price_cents: number; duration_minutes: number; }

export default function BookingPage({ params }: { params: Promise<{ providerId: string }> }) {
    const { providerId } = use(params);
    const { push, replace } = useRouter();
    const [step, setStep] = useState(1);

    const [provider, setProvider] = useState<ProviderInfo | null>(null);
    const [services, setServices] = useState<ServiceOption[]>([]);
    const [pageLoading, setPageLoading] = useState(true);

    const [bookingMode, setBookingMode] = useState<"standard" | "priority">("standard");

    const [timeStr, setTimeStr] = useState("09:00");

    const [bookingData, setBookingData] = useState({
        serviceId: "",
        serviceName: "",
        priceCents: 0,
        durationMinutes: 60,
        dateObj: new Date(),
        address: "",
        lat: null as number | null,
        lng: null as number | null,
        notes: "",
        clientName: "",
        phone: "",
    });

    const createBooking = api.booking.createBooking.useMutation({
        onSuccess: (data) => {
            const payload = data as { id?: string; bookingId?: string };
            const id = payload.bookingId ?? payload.id;
            if (id) {
                replace(`/booking/${id}/confirmed`);
            } else {
                toast.success("Booking confirmed!");
            }
        },
        onError: (err) => {
            toast.error(err.message || "Failed to create booking. Please try again.");
        },
    });

    useEffect(() => {
        async function loadProviderData() {
            setPageLoading(true);
            const supabase = createSupabaseBrowserClient();
            
            const { data: profile } = await supabase
                .from("profiles_public")
                .select("id, name")
                .eq("slug", providerId)
                .single();

            let pid = profile?.id;
            let pname = profile?.name;
            if (!pid) {
                const { data: fallback } = await supabase.from("profiles_public").select("id, name").eq("id", providerId).single();
                if (!fallback) { push("/"); return; }
                pid = fallback.id; pname = fallback.name;
            }

            setProvider({ id: pid, name: pname || "Technician" });

            const { data: svcData } = await supabase
                .from("services")
                .select("id, name, price_cents, duration_minutes")
                .eq("provider_id", pid)
                .eq("is_active", true)
                .order("sort_order");

            setServices(svcData ?? []);
            setPageLoading(false);
        }
        loadProviderData();
    }, [providerId, push]);

    const handleNext = () => {
        if (step === 2) {
            const phoneParsed = bookingData.phone.replace(/\D/g, '');
            if (!/^[89]\d{7}$/.test(phoneParsed)) {
                toast.error("Please enter a valid 8-digit Singapore mobile number (e.g., 8123 4567)");
                return;
            }
        }
        setStep(prev => prev + 1);
    };

    const handleBack = () => setStep(prev => prev - 1);

    const handleServiceSelect = (svc: ServiceOption) => {
        setBookingData({
            ...bookingData,
            serviceId: svc.id,
            serviceName: svc.name,
            priceCents: svc.price_cents,
            durationMinutes: svc.duration_minutes,
        });
        handleNext();
    };

    const handleConfirmPayment = () => {
        if (!provider) return;

        const startDate = new Date(`${format(bookingData.dateObj, "yyyy-MM-dd")}T${timeStr}:00`);
        const endDate = new Date(startDate.getTime() + bookingData.durationMinutes * 60_000);
        
        // Strictly deposit 1500 for Priority, 0 for Standard
        const depositAmountCents = bookingMode === "priority" ? 1500 : 0;

        createBooking.mutate({
            providerId: provider.id,
            serviceId: bookingData.serviceId,
            serviceType: bookingData.serviceName || "General Service",
            scheduledDate: format(bookingData.dateObj, "yyyy-MM-dd"), // YYYY-MM-DD
            arrivalWindowStart: startDate.toISOString(),
            arrivalWindowEnd: endDate.toISOString(),
            estimatedDurationMinutes: bookingData.durationMinutes,
            address: bookingData.address,
            lat: bookingData.lat ?? undefined,
            lng: bookingData.lng ?? undefined,
            amount: bookingData.priceCents,
            depositAmount: depositAmountCents,
            clientName: bookingData.clientName,
            clientPhone: bookingData.phone,
            notes: bookingData.notes || undefined,
        });
    };


    const depositAmountCents = 1500;

    if (pageLoading) {
        return (
            <div className="min-h-screen flex flex-col pt-4">
                <div className="px-4 flex items-center gap-3 mb-6">
                    <SkeletonLineLight width={40} className="h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <SkeletonLineLight width="50%" className="h-5" />
                        <SkeletonLineLight width="30%" className="h-3" />
                    </div>
                </div>
                <div className="flex-1 rounded-t-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl shadow-sm px-5 pt-8 space-y-4">
                    <SkeletonLineLight width="70%" className="h-7 mb-6" />
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 animate-pulse h-32" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col pt-4 overflow-hidden">
            {/* Header */}
            <div className="px-4 flex items-center gap-3 mb-6 relative z-10 text-white">
                <Button variant="ghost" size="icon" onClick={() => step === 1 ? push(`/p/${providerId}`) : handleBack()} className="rounded-full bg-white/5 backdrop-blur-md border border-white/10 shadow-sm hover:bg-white/10 text-white">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-xl font-bold tracking-tight">Book Appointment</h1>
                    <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mt-0.5">
                        {provider?.name}
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="px-6 mb-8 relative z-10">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2 px-1">
                    <span className={step >= 1 ? "text-blue-400" : ""}>Service</span>
                    <span className={step >= 2 ? "text-blue-400" : ""}>Details</span>
                    <span className={step >= 3 ? "text-blue-400" : ""}>Request</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-blue-600 rounded-full shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                        initial={{ width: "33%" }}
                        animate={{ width: `${(step / 3) * 100}%` }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 rounded-t-[2.5rem] bg-zinc-950/40 border-t border-white/10 backdrop-blur-2xl shadow-2xl relative px-5 pt-8 pb-24 overflow-y-auto min-h-0">
                <AnimatePresence mode="wait">

                    {/* ── STEP 1: SELECT SERVICE ── */}
                    {step === 1 && (
                        <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                            <h2 className="text-2xl font-black text-white tracking-tight mb-6">What do you need help with?</h2>
                            {services.length > 0 ? (
                                <div className="space-y-3">
                                    {services.map((svc, idx) => (
                                        <Card variant="premium" key={svc.id} className={`border-2 transition-all cursor-pointer overflow-hidden ${bookingData.serviceId === svc.id ? 'border-blue-600 bg-blue-500/10 shadow-md shadow-blue-500/10' : 'border-white/5 bg-white/5 shadow-sm hover:border-blue-500/50'}`} onClick={() => handleServiceSelect(svc)}>
                                            <CardContent className="p-4 flex items-center justify-between relative">
                                                {idx === 0 && services.length > 1 && (
                                                    <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-bl-xl tracking-wider">POPULAR</div>
                                                )}
                                                <div className="pr-4 relative z-10">
                                                    <h3 className="font-bold text-white text-lg leading-tight mb-1">{svc.name}</h3>
                                                    <div className="flex items-center text-xs text-zinc-400 font-medium gap-1">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        Est. {svc.duration_minutes >= 60 ? `${Math.floor(svc.duration_minutes / 60)} hr${svc.duration_minutes >= 120 ? 's' : ''}` : `${svc.duration_minutes} mins`}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 relative z-10">
                                                    <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(svc.price_cents / 100)}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-zinc-400">
                                    <p className="text-lg font-medium">No services listed yet</p>
                                    <p className="text-sm mt-1">This provider hasn&apos;t added services to their profile.</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* ── STEP 2: DETAILS ── */}
                    {step === 2 && (
                        <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            
                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">Request Type</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div 
                                        onClick={() => setBookingMode("standard")} 
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all backdrop-blur-md ${bookingMode === "standard" ? "border-blue-600 bg-blue-500/10 shadow-md" : "border-white/5 bg-white/5 hover:border-blue-500/50"}`}
                                    >
                                        <div className="text-blue-500 mb-2"><CalendarIcon className="h-6 w-6" /></div>
                                        <div className="font-bold text-white mb-0.5">Standard</div>
                                        <div className="text-xs text-zinc-400 font-medium">Free booking on available slots.</div>
                                    </div>
                                    <div 
                                        onClick={() => setBookingMode("priority")} 
                                        className={`p-4 rounded-2xl border-2 cursor-pointer transition-all backdrop-blur-md ${bookingMode === "priority" ? "border-purple-500 bg-purple-500/10 shadow-md" : "border-white/5 bg-white/5 hover:border-purple-500/50"}`}
                                    >
                                        <div className="text-purple-500 mb-2"><Zap className="h-6 w-6" /></div>
                                        <div className="font-bold text-white mb-0.5">Priority ($15)</div>
                                        <div className="text-xs text-zinc-400 font-medium">Request any specific bypassed time.</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <CalendarIcon className="h-5 w-5 text-blue-500" /> Date & Time
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="date"
                                        value={format(bookingData.dateObj, "yyyy-MM-dd")}
                                        onChange={(e) => {
                                            if (e.target.value) setBookingData(prev => ({...prev, dateObj: new Date(e.target.value + "T00:00:00")}));
                                        }}
                                        min={format(new Date(), "yyyy-MM-dd")}
                                        className="h-12 font-bold text-white border-white/10 bg-white/5 backdrop-blur-md rounded-xl min-w-0 max-w-full appearance-none px-3 focus:border-blue-500/50"
                                    />
                                    <Input
                                        type="time"
                                        value={timeStr}
                                        onChange={(e) => setTimeStr(e.target.value)}
                                        className="h-12 font-bold text-white border-white/10 bg-white/5 backdrop-blur-md rounded-xl min-w-0 max-w-full appearance-none px-3 focus:border-blue-500/50"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                    <MapPin className="h-5 w-5 text-emerald-500" /> Location Details
                                </h3>
                                <AddressAutocomplete
                                    value={bookingData.address}
                                    onChange={(addr, lat, lng) => setBookingData(p => ({...p, address: addr, lat, lng}))}
                                    placeholder="Search your address (e.g. Blk 123 Hougang)"
                                    className="h-12 bg-white/5 border-white/10 backdrop-blur-md rounded-xl text-white placeholder:text-zinc-500"
                                />
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-bold text-lg text-white flex items-center gap-2">Client Info</h3>
                                <div className="space-y-3">
                                    <Input placeholder="Your Name" name="clientName" value={bookingData.clientName} onChange={(e) => setBookingData(p => ({...p, clientName: e.target.value}))} className="h-12 bg-white/5 border-white/10 backdrop-blur-md rounded-xl text-white placeholder:text-zinc-500" />
                                    <Input type="tel" placeholder="Phone Number" name="phone" value={bookingData.phone} onChange={(e) => setBookingData(p => ({...p, phone: e.target.value}))} className="h-12 bg-white/5 border-white/10 backdrop-blur-md rounded-xl text-white placeholder:text-zinc-500" />
                                    <Textarea placeholder="Any specific issues or symptoms? (Optional)" name="notes" value={bookingData.notes} onChange={(e) => setBookingData(p => ({...p, notes: e.target.value}))} className="bg-white/5 border-white/10 backdrop-blur-md rounded-xl min-h-[100px] text-white placeholder:text-zinc-500" />
                                </div>
                            </div>

                            <Button
                                size="lg"
                                className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-lg shadow-xl shadow-blue-500/20 font-bold active:scale-[0.98] transition-all text-white mt-8"
                                onClick={handleNext}
                                disabled={!timeStr || !bookingData.address || !bookingData.clientName || !bookingData.phone}
                            >
                                Continue to Confirmation
                            </Button>
                        </motion.div>
                    )}

                    {/* ── STEP 3: PAYMENT / ESCROW ── */}
                    {step === 3 && (
                        <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                            
                            {bookingMode === "priority" ? (
                                <div className="text-center space-y-2 mb-8">
                                    <div className="mx-auto w-16 h-16 bg-purple-500/10 text-purple-500 rounded-2xl flex items-center justify-center mb-4 border-4 border-white/10 shadow-lg rotate-12 backdrop-blur-md">
                                        <Zap className="h-8 w-8" />
                                    </div>
                                    <h2 className="text-2xl font-black text-white tracking-tight">Priority Request</h2>
                                    <p className="text-sm text-zinc-400 font-medium px-4">Pay a $15 deposit to secure your expedited slot. The technician will prioritize this time heavily.</p>
                                    
                                    <div className="mt-4 mx-2 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-start gap-3 text-left backdrop-blur-sm">
                                        <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                        <p className="text-xs text-white font-semibold leading-relaxed">
                                            100% Refund Guarantee: A full refund will be instantly provided if the technician declines this priority request, or if they accept but fail to arrive.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-2 mb-8">
                                    <div className="mx-auto w-16 h-16 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center mb-4 border-4 border-white/10 shadow-lg rotate-12 backdrop-blur-md">
                                        <CalendarIcon className="h-8 w-8" />
                                    </div>
                                    <h2 className="text-2xl font-black text-white tracking-tight">Standard Request</h2>
                                    <p className="text-sm text-zinc-400 font-medium px-4">Your requested slot will be pending the technician&apos;s manual approval. No upfront fees required today.</p>
                                </div>
                            )}

                            <Card variant="premium" className="border-2 border-white/10 bg-white/5 shadow-md rounded-3xl overflow-hidden mb-6">
                                <div className="bg-white/5 p-4 border-b border-white/10 flex justify-between items-center text-sm font-bold uppercase tracking-widest text-zinc-400">
                                    <span>Booking Summary</span>
                                    <span className="text-blue-400 cursor-pointer" onClick={() => setStep(2)}>Edit</span>
                                </div>
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex justify-between items-start text-sm relative z-10">
                                        <span className="text-zinc-300 font-medium pr-8">{bookingData.serviceName}</span>
                                        <span className="font-bold text-white">{formatCurrency(bookingData.priceCents / 100)}</span>
                                    </div>
                                    
                                    <div className="flex justify-between items-center pt-2 border-t border-white/10 mt-2 relative z-10">
                                        <div>
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Due Now</span>
                                            <span className="text-3xl font-black text-white tracking-tight">
                                                {bookingMode === "priority" ? formatCurrency(depositAmountCents / 100) : "$0.00"}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-1">Estimated Total</span>
                                            <span className="text-xl font-bold text-zinc-400">{formatCurrency(bookingData.priceCents / 100)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button
                                size="lg"
                                onClick={handleConfirmPayment}
                                disabled={createBooking.isPending}
                                className={`w-full h-14 rounded-2xl text-lg shadow-xl font-bold active:scale-[0.98] transition-all text-white flex justify-center items-center gap-2 ${bookingMode === "priority" ? "bg-purple-600 hover:bg-purple-700 shadow-purple-600/20" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20"}`}
                            >
                                {createBooking.isPending ? (
                                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                        <Zap className="h-5 w-5" />
                                    </motion.div>
                                ) : bookingMode === "priority" ? (
                                    <>Pay {formatCurrency(depositAmountCents / 100)} Deposit <ArrowRight className="h-5 w-5 opacity-70" /></>
                                ) : (
                                    <>Confirm Request <ArrowRight className="h-5 w-5 opacity-70" /></>
                                )}
                            </Button>

                            <p className="text-center text-xs text-zinc-500 font-medium px-8 leading-relaxed mt-4">
                                By proceeding, you agree to our Terms of Service. Payment processing secured by PayNow.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
