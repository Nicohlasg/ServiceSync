"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Clock, Sparkles, CheckCircle2, ChevronRight, X, User, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";

interface RetentionItem {
    assetId: string;
    clientName: string;
    clientPhone: string | null;
    assetType: string;
    locationInHome: string | null;
    lastServiceDate: string | null;
    monthsPassed: number;
    isOverdue: boolean;
}

interface QueueItem extends RetentionItem {
    draft: string;
}

function generateDraft(item: RetentionItem): string {
    const lastStr = item.lastServiceDate
        ? format(new Date(item.lastServiceDate), "dd MMM yyyy")
        : "a while back";
    const unit = item.locationInHome ? ` (${item.locationInHome})` : "";
    return `Hi ${item.clientName.split(" ")[0]}! It's been about ${item.monthsPassed} month${item.monthsPassed !== 1 ? "s" : ""} since your last ${item.assetType}${unit} service on ${lastStr}. Regular maintenance helps keep things running efficiently and prevents costly breakdowns.\n\nWould you like me to schedule a visit? Just let me know a convenient time!`;
}

export default function RetentionQueuePage() {
    const { push } = useRouter();

    const { data: retentionData, isLoading, isError, refetch } = api.clients.getRetentionQueue.useQuery(
        { lookaheadDays: 14, limit: 50 },
    );

    const initialQueue = useMemo<QueueItem[]>(() => {
        return (retentionData ?? []).map((item) => ({
            ...item,
            draft: generateDraft(item),
        }));
    }, [retentionData]);

    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const queue = initialQueue.filter((item) => !dismissed.has(item.assetId));

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState("");
    const [drafts, setDrafts] = useState<Record<string, string>>({});

    const getDraft = (msg: QueueItem) => drafts[msg.assetId] ?? msg.draft;

    const handleApprove = (msg: QueueItem) => {
        const text = encodeURIComponent(getDraft(msg));
        const phone = (msg.clientPhone ?? "").replace(/\D/g, "");
        if (phone) {
            window.open(`https://wa.me/${phone}?text=${text}`, "_blank");
        }
        toast.success("Opening WhatsApp...");
        setDismissed((prev) => new Set(prev).add(msg.assetId));
    };

    const handleDismiss = (id: string) => {
        toast.info("Reminder dismissed.");
        setDismissed((prev) => new Set(prev).add(id));
    };

    const handleEditClick = (msg: QueueItem) => {
        setEditingId(msg.assetId);
        setEditDraft(getDraft(msg));
    };

    const saveEdit = () => {
        if (editingId) {
            setDrafts((prev) => ({ ...prev, [editingId]: editDraft }));
        }
        setEditingId(null);
        toast.success("Draft updated");
    };

    if (isLoading) {
        return (
            <div className="space-y-6 pt-4 px-2">
                <div className="flex items-center gap-3 px-2">
                    <SkeletonLine width="40px" className="h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <SkeletonLine width="55%" className="h-7" />
                        <SkeletonLine width="75%" className="h-4" />
                    </div>
                </div>
                <div className="px-2 space-y-5">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4 text-white">
                <p className="text-rose-400 font-bold uppercase tracking-widest text-xs">Failed to load follow-ups.</p>
                <Button variant="outline" onClick={() => refetch()} className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl font-black uppercase tracking-widest text-[10px]">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 relative pb-32 text-white">
            {/* Header */}
            <div className="flex items-center gap-3 px-2">
                <BackButton />
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight leading-none mb-1">Smart Follow-ups</h1>
                    <p className="text-zinc-400 text-xs font-bold uppercase tracking-wider">AI reminders to secure repeat jobs.</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-1 space-y-5">
                <AnimatePresence mode="popLayout">
                {queue.length > 0 ? (
                    queue.map((msg, idx: number) => {
                        const lastStr = msg.lastServiceDate
                            ? format(new Date(msg.lastServiceDate), "dd MMM yyyy")
                            : "Unknown";

                        return (
                        <motion.div
                            key={msg.assetId}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, x: -100 }}
                            transition={{ delay: idx * 0.05 }}
                        >
                            <Card variant="premium" className="shadow-2xl rounded-3xl overflow-hidden relative backdrop-blur-2xl">
                                {/* Status/Context Header */}
                                <div className="bg-white/5 p-4 border-b border-white/5 flex items-center justify-between relative z-10">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border backdrop-blur-xl ${msg.isOverdue ? "bg-rose-600/20 text-rose-400 border-rose-500/30" : "bg-blue-600/20 text-blue-400 border-blue-500/30"}`}>
                                            {msg.isOverdue ? "Overdue" : "Due Soon"} &middot; {msg.monthsPassed}mo
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                                        <Clock className="h-3 w-3" />
                                        Last: {lastStr}
                                    </div>
                                </div>

                                <CardContent className="p-6 space-y-5 relative z-10">
                                    {/* Client Info */}
                                    <div className="flex items-center gap-4 mb-2">
                                        <div className="h-12 w-12 rounded-2xl bg-white/5 flex items-center justify-center text-blue-400 border border-white/10 shadow-inner">
                                            <User className="h-6 w-6" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="font-black text-white text-xl tracking-tight leading-tight truncate">{msg.clientName}</p>
                                            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1 truncate">{msg.assetType}{msg.locationInHome ? ` — ${msg.locationInHome}` : ""}</p>
                                        </div>
                                    </div>

                                    {/* Draft Content */}
                                    <div className="bg-white/5 p-5 rounded-2xl border border-white/5 relative backdrop-blur-md overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-1 bg-blue-500/40 h-full group-hover:bg-blue-500 transition-colors" />
                                        <div className="flex items-center gap-2 mb-3">
                                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.15em]">AI Suggested Draft</span>
                                        </div>
                                        {editingId === msg.assetId ? (
                                            <div className="pt-1">
                                                <Textarea
                                                    value={editDraft}
                                                    onChange={(e) => setEditDraft(e.target.value)}
                                                    className="min-h-[140px] bg-zinc-900/50 border-white/10 text-white rounded-xl mb-4 font-medium leading-relaxed focus:border-blue-500/50"
                                                />
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] px-6 h-10 shadow-lg shadow-blue-600/20">SAVE</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-zinc-500 font-black uppercase tracking-widest text-[10px] h-10 px-4 hover:text-white">CANCEL</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm text-zinc-300 whitespace-pre-line leading-relaxed pb-8 pt-1 font-medium italic">
                                                    &ldquo;{getDraft(msg)}&rdquo;
                                                </p>
                                                <button
                                                    onClick={() => handleEditClick(msg)}
                                                    className="absolute bottom-3 right-4 text-[10px] font-black uppercase tracking-widest text-blue-400 hover:text-blue-300 transition-colors bg-white/5 px-2 py-1 rounded-md border border-white/5"
                                                >
                                                    Edit Draft
                                                </button>
                                            </>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {editingId !== msg.assetId && (
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleDismiss(msg.assetId)}
                                                className="h-14 w-14 rounded-2xl bg-white/5 border-white/10 text-zinc-500 hover:bg-rose-600/10 hover:text-rose-400 hover:border-rose-500/30 transition-all p-0 shrink-0 shadow-lg"
                                            >
                                                <X className="h-6 w-6" />
                                            </Button>
                                            <Button
                                                onClick={() => handleApprove(msg)}
                                                className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-xl shadow-blue-600/30 active:scale-95 transition-all border-none flex items-center justify-center gap-3 uppercase tracking-widest"
                                            >
                                                Send via WhatsApp <Send className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </motion.div>
                        );
                    })
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/5 border-dashed backdrop-blur-md mt-4"
                    >
                        <div className="mx-auto w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5 shadow-inner">
                            <CheckCircle2 className="h-10 w-10 text-zinc-700" />
                        </div>
                        <h3 className="text-xl font-black text-white mb-1 tracking-tight uppercase">All Caught Up!</h3>
                        <p className="text-zinc-500 text-xs font-bold max-w-[250px] mx-auto leading-relaxed uppercase tracking-wider">
                            You&apos;re all set. New follow-ups appear automatically based on service history.
                        </p>
                    </motion.div>
                )}
                </AnimatePresence>
            </div>

        </div>
    );
}
