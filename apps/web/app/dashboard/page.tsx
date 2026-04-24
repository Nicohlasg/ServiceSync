"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { MapPin, DollarSign, ChevronRight, Navigation, Clock, Calendar, X, Mail, Banknote, Building2, CheckCircle2, UserCircle, Bell, Settings, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Job } from "@/lib/types";
import { getRouteDetails, calculateLeaveTime, RouteResult } from "@/lib/maps";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { SkeletonCard, SkeletonStat, SkeletonLine } from "@/components/ui/skeleton";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { PayNowPreviewModal } from "@/components/onboarding/PayNowPreviewModal";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/basic-dropdown";

interface ClientHistoryItem {
    id: string;
    service_type: string | null;
    scheduled_date: string | null;
    status: string | null;
    completed_at: string | null;
}

export default function DashboardPage() {
    const [userProfile, setUserProfile] = useState<{ name: string; avatar_url?: string; base_lat?: number; base_lng?: number } | null>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [cashInPocket, setCashInPocket] = useState(0);
    const [bankTransfers, setBankTransfers] = useState(0);
    const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // UI State
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [routeData, setRouteData] = useState<RouteResult | null>(null);
    const [loadingRoute, setLoadingRoute] = useState(false);
    const [clientHistory, setClientHistory] = useState<ClientHistoryItem[]>([]);
    const [openPaynowPreview, setOpenPaynowPreview] = useState(false);
    const { push } = useRouter();

    useEffect(() => {
        async function loadDashboardData() {
            setLoading(true);
            try {
                const supabase = createSupabaseBrowserClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // 1. Fetch Profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('name, avatar_url, base_lat, base_lng')
                    .eq('id', user.id)
                    .single();

                if (profile) setUserProfile({ name: profile.name ?? 'Technician', avatar_url: profile.avatar_url, base_lat: profile.base_lat, base_lng: profile.base_lng });

                const todayStr = new Date().toISOString().split('T')[0];

                // 2. Fetch Today's Bookings (Exclude pending)
                const { data: bookings } = await supabase
                    .from('bookings')
                    .select('id, client_id, client_name, status, scheduled_date, arrival_window_start, service_type, address, lat, lng, clients(name)')
                    .eq('provider_id', user.id)
                    .eq('scheduled_date', todayStr)
                    .neq('status', 'pending')
                    .order('arrival_window_start', { ascending: true });

                if (bookings) {
                    const mappedJobs: Job[] = bookings.map(b => {
                        const dateObj = new Date(b.arrival_window_start);
                        const timeStr = dateObj.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: true });
                        const isCompleted = b.status === 'completed';

                        return {
                            id: b.id,
                            clientId: b.client_id ?? '',
                            clientName: b.client_name || b.clients?.[0]?.name || 'Unknown Client',
                            time: timeStr,
                            service: b.service_type,
                            status: isCompleted ? "completed" : "upcoming",
                            lat: b.lat ?? undefined,
                            lng: b.lng ?? undefined,
                            address: b.address ?? '',
                            date: new Date(b.scheduled_date),
                            amount: 0,
                        };
                    });
                    setJobs(mappedJobs);
                }

                // 3. Fetch Today's Earnings (from invoices paid today)
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('total_cents, paid_at, status, payment_method')
                    .eq('provider_id', user.id)
                    .in('status', ['paid_cash', 'paid_qr']);

                if (invoices) {
                    let cashCents = 0;
                    let bankCents = 0;
                    
                    invoices.forEach(inv => {
                        if (inv.paid_at && inv.paid_at.startsWith(todayStr)) {
                            if (inv.payment_method === 'cash') cashCents += (inv.total_cents ?? 0);
                            else bankCents += (inv.total_cents ?? 0);
                        }
                    });

                    setCashInPocket(cashCents / 100);
                    setBankTransfers(bankCents / 100);
                }

                // 4. Fetch Pending Requests Count
                const { count } = await supabase
                    .from('bookings')
                    .select('*', { count: 'exact', head: true })
                    .eq('provider_id', user.id)
                    .eq('status', 'pending');
                setPendingRequestsCount(count || 0);

            } catch (err) {
                console.error("Failed to load dashboard data", err);
            } finally {
                setLoading(false);
            }
        }

        loadDashboardData();
    }, []);

    const handleJobSelect = async (job: Job) => {
        setSelectedJob(job);
        setLoadingRoute(true);
        setRouteData(null);
        setClientHistory([]);

        // Fetch client's past completed bookings for CRM recall
        if (job.clientId) {
            const supabase = createSupabaseBrowserClient();
            const { data: pastJobs } = await supabase
                .from('bookings')
                .select('id, service_type, scheduled_date, status, completed_at')
                .eq('client_id', job.clientId)
                .neq('id', job.id)
                .in('status', ['completed', 'accepted', 'in_progress'])
                .order('scheduled_date', { ascending: false })
                .limit(5);
            if (pastJobs) {
                setClientHistory(pastJobs.map((pastJob) => ({
                    id: pastJob.id,
                    service_type: pastJob.service_type ?? null,
                    scheduled_date: pastJob.scheduled_date ?? null,
                    status: pastJob.status ?? null,
                    completed_at: pastJob.completed_at ?? null,
                })));
            }
        }

        // Determine Origin
        const currentIndex = jobs.findIndex(j => j.id === job.id);
        // Default to Provider's Base/Home OR Singapore Center
        let origin = { lat: userProfile?.base_lat ?? 1.3521, lng: userProfile?.base_lng ?? 103.8198 };

        if (currentIndex > 0) {
            const prevJob = jobs[currentIndex - 1];
            if (prevJob.lat && prevJob.lng) {
                origin = { lat: prevJob.lat, lng: prevJob.lng };
            }
        }

        const destination = { lat: job.lat || 1.3521, lng: job.lng || 103.8198 };

        const result = await getRouteDetails(origin, destination);
        const leaveBy = calculateLeaveTime(job.time, result.durationValue);

        setRouteData({ ...result, leaveBy });
        setLoadingRoute(false);
    };

    const handleStartNavigation = () => {
        if (selectedJob && selectedJob.lat && selectedJob.lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedJob.lat},${selectedJob.lng}`, '_blank');
        }
    };

    const handleLogout = async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        push('/auth/login');
    };

    // Till Management logic
    const todayEarnings = cashInPocket + bankTransfers;
    const hasEarningsToday = todayEarnings > 0;

    // Upcoming today
    const upcomingJobs = jobs;

    if (loading) {
        return (
            <div className="space-y-6 pt-4">
                {/* Header placeholder */}
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        <SkeletonLine width="48px" className="h-12 w-12 rounded-full" />
                        <div className="space-y-1">
                            <SkeletonLine width="80px" className="h-3" />
                            <SkeletonLine width="120px" className="h-5" />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <SkeletonLine width="48px" className="h-12 w-12 rounded-full" />
                        <SkeletonLine width="48px" className="h-12 w-12 rounded-full" />
                    </div>
                </div>

                {/* Earnings + till stat tiles */}
                <div className="grid grid-cols-2 gap-3">
                    <SkeletonStat />
                    <SkeletonStat />
                </div>

                {/* Today's jobs */}
                <div className="space-y-3">
                    <SkeletonLine width="35%" className="h-5" />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 relative pb-8">
            {/* Header Redesign */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Dropdown>
                        <DropdownTrigger className="cursor-pointer group">
                            <div data-tutorial-target="profile-link">
                                {userProfile?.avatar_url ? (
                                    <Image src={userProfile.avatar_url} alt="Profile" width={48} height={48} className="rounded-full object-cover border-2 border-transparent hover:border-blue-400 shadow-sm h-12 w-12 transition-colors duration-200" unoptimized />
                                ) : (
                                    <div className="h-12 w-12 rounded-full bg-slate-800 border-2 border-transparent hover:border-blue-400 shadow-sm flex items-center justify-center text-slate-300 transition-colors duration-200">
                                        <UserCircle className="h-7 w-7" />
                                    </div>
                                )}
                            </div>
                        </DropdownTrigger>
                        <DropdownContent align="start" className="w-56 mt-2 border border-slate-700/50 bg-slate-900/95 backdrop-blur-xl">
                            <DropdownItem data-tutorial-target="dropdown-profile-btn" className="gap-3 font-medium text-slate-200 py-3" onClick={() => push('/dashboard/profile')}>
                                <UserCircle className="h-4 w-4" />
                                Profile
                            </DropdownItem>
                            <DropdownItem className="gap-3 font-medium text-slate-200 py-3" onClick={() => push('/dashboard/settings')}>
                                <Settings className="h-4 w-4" />
                                Settings
                            </DropdownItem>
                            <DropdownSeparator className="bg-slate-800/50" />
                            <DropdownItem className="gap-3 font-bold py-3" destructive onClick={handleLogout}>
                                <LogOut className="h-4 w-4" />
                                Log out
                            </DropdownItem>
                        </DropdownContent>
                    </Dropdown>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-400">Good morning!</span>
                        <span className="text-lg font-black text-white leading-tight">{userProfile?.name ?? 'Technician'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Link href="/dashboard/requests" className="relative h-12 w-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 shadow-sm hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                        <Bell className="h-5 w-5" />
                        {pendingRequestsCount > 0 && (
                            <span className="absolute top-3 right-3 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-slate-900 pointer-events-none shadow-sm"></span>
                        )}
                    </Link>
                </div>
            </div>

            {/* Activation checklist — post-wizard masterplan §6 Task 7 */}
            <OnboardingChecklist onPreviewPaynow={() => setOpenPaynowPreview(true)} />

            {/* Stats Overview: Till Management */}
            <div className="space-y-3">
                {/* Main Earnings */}
                <Card className="bg-blue-600 text-white shadow-xl rounded-2xl overflow-hidden relative border-0">
                    <CardContent className="p-6 flex items-center justify-between relative z-10 w-full">
                        <div>
                            <p className="text-blue-100 text-sm font-bold uppercase tracking-wider mb-1">Total Earned Today</p>
                            <p className="text-4xl font-black tracking-tight">{formatCurrency(todayEarnings || 0)}</p>
                            {!hasEarningsToday && (
                                <p className="text-blue-100/90 text-sm font-medium mt-2 max-w-[220px] leading-snug">
                                    No payments recorded for today yet. Paid invoices will appear here.
                                </p>
                            )}
                        </div>
                        <div className="bg-white/20 w-14 h-14 rounded-2xl flex items-center justify-center border border-white/20 shadow-inner">
                            <DollarSign className="h-7 w-7 text-white" />
                        </div>
                    </CardContent>
                </Card>

                {/* Cash vs Bank Split */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-slate-800/80 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl">
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                            <div className="text-emerald-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-emerald-500/15 border border-emerald-500/20">
                                <Banknote className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Physical Cash</p>
                                <p className="text-2xl font-black text-white tracking-tight tabular-nums">
                                    {hasEarningsToday ? formatCurrency(cashInPocket) : "—"}
                                </p>
                                {hasEarningsToday ? (
                                    <p className="text-[10px] text-emerald-400 mt-1 font-bold bg-emerald-500/15 inline-block px-1.5 py-0.5 rounded">To bank in</p>
                                ) : (
                                    <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">No cash collected today</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-slate-800/80 backdrop-blur-md border border-white/10 shadow-lg rounded-2xl">
                        <CardContent className="p-5 flex flex-col justify-between h-full">
                            <div className="text-blue-400 w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-blue-500/15 border border-blue-500/20">
                                <Building2 className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Bank Transfers</p>
                                <p className="text-2xl font-black text-white tracking-tight tabular-nums">
                                    {hasEarningsToday ? formatCurrency(bankTransfers) : "—"}
                                </p>
                                {hasEarningsToday ? (
                                    <p className="text-[10px] text-blue-400 mt-1 font-bold bg-blue-500/15 inline-block px-1.5 py-0.5 rounded">Processing</p>
                                ) : (
                                    <p className="text-[11px] text-slate-500 mt-1.5 leading-tight">No PayNow received today</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Collect Payment - Inline CTA */}
            <div>
                <Link href="/dashboard/invoices/new" data-tutorial-target="collect-payment" className="block">
                    <Button size="lg" className="w-full h-16 rounded-2xl bg-emerald-600 text-xl shadow-lg shadow-emerald-500/30 hover:bg-emerald-500 transition-all active:scale-[0.98] font-black text-white border border-emerald-400/30 flex items-center justify-center gap-3">
                        <DollarSign className="h-7 w-7" />
                        Collect Payment
                    </Button>
                </Link>
            </div>

            {/* Today's Jobs (Clustered List) */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-black text-white flex items-center gap-3">
                        Today&apos;s Route <span className="bg-blue-600 text-sm font-bold text-white px-3 py-1 rounded-full shadow-sm">{upcomingJobs.length} Jobs</span>
                    </h2>
                    <Link href="/dashboard/schedule" className="text-blue-400 font-bold text-base hover:text-blue-300 hover:underline">
                        See All
                    </Link>
                </div>

                <div className="space-y-4 relative pb-2 overflow-x-hidden">
                    {/* The "Route Timeline" connecting line */}
                    <div className="absolute left-[40px] top-8 bottom-8 w-1 bg-slate-700/60 z-0 rounded-full"></div>

                    {upcomingJobs.length > 0 ? (
                        upcomingJobs.map((job, index) => (
                            <div
                                key={job.id}
                                onClick={() => handleJobSelect(job)}
                                className="relative z-10"
                            >
                                <Card className="active:scale-[0.98] transition-all hover:shadow-lg bg-slate-800/80 backdrop-blur-md border border-white/10 hover:border-blue-500/40 rounded-2xl overflow-hidden group cursor-pointer shadow-lg">
                                    <CardContent className="p-0 flex">
                                        <div className={`w-2 ${job.status === 'completed' ? 'bg-emerald-500' : index === 0 ? 'bg-blue-500' : 'bg-slate-600'}`}></div>
                                        <div className="flex-1 p-5 flex items-center gap-5">
                                            {/* Time Badge */}
                                            <div className={`flex flex-col items-center justify-center min-w-[72px] bg-slate-900/80 rounded-xl py-3 border shadow-inner ${job.status === 'completed' ? 'border-emerald-500/30' : index === 0 ? 'border-blue-500/50' : 'border-white/10'}`}>
                                                <span className={`text-lg font-black ${job.status === 'completed' ? 'text-emerald-400' : index === 0 ? 'text-blue-400' : 'text-slate-200'}`}>
                                                    {job.time.split(" ")[0]}
                                                </span>
                                                <span className={`text-sm font-bold uppercase -mt-1 ${job.status === 'completed' ? 'text-emerald-500' : index === 0 ? 'text-blue-500' : 'text-slate-500'}`}>
                                                    {job.time.split(" ")[1]}
                                                </span>
                                            </div>

                                            {/* Job Details */}
                                            <div className="flex-1 space-y-1.5 overflow-hidden">
                                                <div className="flex items-center justify-between">
                                                    <h3 className={`font-black text-lg truncate pr-2 ${job.status === 'completed' ? 'text-slate-500 line-through' : 'text-white'}`}>{job.clientName}</h3>
                                                    {job.status === "completed" ? (
                                                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs uppercase font-bold tracking-wider rounded-md px-2 py-0.5">Done</Badge>
                                                    ) : (
                                                        index === 0 ? (
                                                            <Badge variant="secondary" className="text-blue-300 bg-blue-500/15 border border-blue-500/30 text-xs uppercase font-bold tracking-wider rounded-md px-2 py-0.5">
                                                                Next
                                                            </Badge>
                                                        ) : null
                                                    )}
                                                </div>
                                                <p className={`text-base line-clamp-1 font-medium ${job.status === 'completed' ? 'text-slate-500' : 'text-slate-300'}`}>{job.service}</p>
                                                <div className="flex items-center text-sm text-slate-400 gap-1.5 mt-1">
                                                    <MapPin className="h-4 w-4 shrink-0" />
                                                    <span className="truncate font-bold">{job.address}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-10 bg-slate-800/60 rounded-3xl border border-white/10 border-dashed">
                            <p className="text-slate-400 font-bold text-lg">No jobs scheduled for today.</p>
                            <Link href="/dashboard/schedule/add">
                                <Button variant="link" className="text-blue-400 font-bold text-base mt-2">Add a job +</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>

            {/* Job Details Modal */}
            <AnimatePresence>
                {selectedJob && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedJob(null)}
                            className="fixed inset-0 bg-slate-950/80 z-[90] backdrop-blur-md"
                        />

                        {/* Drawer */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-x-0 bottom-0 top-12 z-[100] bg-slate-900 shadow-2xl rounded-t-[2rem] overflow-hidden flex flex-col border-t border-white/10"
                        >
                            {/* Header Image / Map */}
                            <div className="relative h-[30vh] w-full bg-slate-800 shrink-0 border-b border-white/5">
                                {selectedJob.lat && selectedJob.lng ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        frameBorder="0"
                                        scrolling="no"
                                        marginHeight={0}
                                        marginWidth={0}
                                        src={`https://maps.google.com/maps?q=${selectedJob.lat},${selectedJob.lng}&z=17&output=embed&iwloc=near`}
                                        className="w-full h-full opacity-90"
                                    ></iframe>
                                ) : (
                                    <Image
                                        src="https://images.unsplash.com/photo-1625322086987-feece9d1b9cc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaW5nYXBvcmUlMjBtYXAlMjBsb2NhdGlvbiUyMG5hdmlnYXRpb24lMjBtYXB8ZW58MXx8fHwxNzcwMzIwODc2fDA&ixlib=rb-4.1.0&q=80&w=1080"
                                        alt="Map"
                                        fill
                                        sizes="100vw"
                                        className="object-cover opacity-50"
                                        unoptimized
                                    />
                                )}

                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-slate-900 via-transparent to-transparent" />

                                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full cursor-pointer" onClick={() => setSelectedJob(null)} />

                                <button
                                    onClick={() => setSelectedJob(null)}
                                    className="absolute top-4 right-4 bg-black/40 backdrop-blur-md border border-white/10 p-2 rounded-full text-white shadow-lg z-10 active:scale-90 transition-transform hover:bg-black/60"
                                >
                                    <X className="h-6 w-6" />
                                </button>

                                <div className="absolute bottom-4 left-6 right-6 pointer-events-none z-10 w-full block">
                                    <h2 className="text-3xl font-black text-white mb-2 drop-shadow-md tracking-tight leading-tight">{selectedJob.clientName}</h2>
                                    <div className="flex items-center gap-1.5 text-slate-200 font-bold bg-black/50 backdrop-blur-md self-start truncate px-3 py-1.5 rounded-xl border border-white/10 shadow-lg text-sm w-fit max-w-[90%]">
                                        <MapPin className="h-4 w-4 text-blue-400 shrink-0" />
                                        <span className="truncate">{selectedJob.address}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 px-5 pt-5 overflow-y-auto pb-40 space-y-5 bg-slate-900">

                                {/* CRM Context Card (Aha! Moment) */}
                                <div className="bg-indigo-900/30 border border-indigo-500/20 p-4 rounded-3xl relative overflow-hidden mt-2">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />
                                    <div className="flex items-start gap-3 relative z-10">
                                        <div className="bg-indigo-500/20 p-2 rounded-xl text-indigo-400">
                                            <Clock className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-indigo-300 font-black text-xs mb-1 uppercase tracking-wider">CRM Recall</h4>
                                            <div className="text-white text-sm leading-relaxed font-medium">
                                                {clientHistory.length > 0 ? (
                                                    <>
                                                        {clientHistory.slice(0, 3).map((h) => (
                                                            <p key={h.id} className="text-indigo-100 mb-1">
                                                                {h.scheduled_date ? new Date(h.scheduled_date + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" }) : "?"}: {h.service_type ?? "Service"}
                                                            </p>
                                                        ))}
                                                        <p className="text-white font-bold mt-1">Today: {selectedJob.service}</p>
                                                    </>
                                                ) : (
                                                    <p className="text-indigo-200">New client — no past history.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Travel Time Card */}
                                <div className="bg-slate-800/60 border border-white/10 shadow-lg p-5 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-600/20 p-2.5 rounded-xl text-blue-400 border border-blue-500/20">
                                            <Navigation className="h-5 w-5" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Est. Travel</p>
                                            <div>
                                                {loadingRoute ? (
                                                    <div className="h-7 w-20 bg-white/5 animate-pulse rounded mt-1" />
                                                ) : (
                                                    <p className="text-2xl font-black text-white flex items-center gap-2 tracking-tight truncate">
                                                        {routeData?.durationText}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right border-l border-white/10 pl-4 shrink-0">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Leave By</p>
                                        <div>
                                            {loadingRoute ? (
                                                <div className="h-7 w-20 bg-white/5 animate-pulse rounded mt-1 ml-auto" />
                                            ) : (
                                                <p className="text-2xl font-black text-orange-400 tracking-tight">
                                                    {routeData?.leaveBy}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Job Info */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800/60 border border-white/10 shadow-lg p-4 rounded-3xl">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                                            <Clock className="h-3.5 w-3.5 text-blue-400" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Time</span>
                                        </div>
                                        <p className="font-black text-white flex items-baseline gap-1">
                                            <span className="text-2xl">{selectedJob.time.split(" ")[0]}</span>
                                            <span className="text-sm text-slate-400 font-bold">{selectedJob.time.split(" ")[1]}</span>
                                        </p>
                                    </div>
                                    <div className="bg-slate-800/60 border border-white/10 shadow-lg p-4 rounded-3xl overflow-hidden relative">
                                        <div className="flex items-center gap-2 mb-2 text-slate-400 relative z-10">
                                            <Calendar className="h-3.5 w-3.5 text-purple-400" />
                                            <span className="text-[10px] font-bold uppercase tracking-widest">Service</span>
                                        </div>
                                        <p className="font-bold text-white text-sm leading-tight relative z-10 line-clamp-2">{selectedJob.service}</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="fixed bottom-0 left-0 right-0 p-5 z-20 bg-slate-900 border-t border-white/10">
                                    <div className="space-y-3 max-w-md mx-auto">
                                        <Button
                                            onClick={handleStartNavigation}
                                            className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-xl shadow-lg shadow-blue-500/30 font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all text-white border-2 border-blue-400/50"
                                        >
                                            <Navigation className="h-6 w-6" />
                                            Navigate Now
                                        </Button>
                                        {selectedJob.status !== "completed" ? (
                                            <Button
                                                variant="outline"
                                                className="w-full h-14 rounded-2xl bg-emerald-600/10 border-emerald-500/30 text-emerald-400 font-bold hover:bg-emerald-600/20 transition-colors"
                                                onClick={() => {
                                                    setSelectedJob(null);
                                                    push("/dashboard/invoices/new");
                                                }}
                                            >
                                                <CheckCircle2 className="h-5 w-5 mr-2" />
                                                Complete & Invoice
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                className="w-full h-14 rounded-2xl bg-white/5 border-white/10 text-slate-300 font-bold hover:bg-white/10 transition-colors"
                                                disabled
                                            >
                                                Job Completed
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* PayNow preview modal — opened from checklist paynow row */}
            <PayNowPreviewModal open={openPaynowPreview} onClose={() => setOpenPaynowPreview(false)} />
        </div>
    );
}
