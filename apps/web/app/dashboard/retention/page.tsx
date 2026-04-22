"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Clock, Sparkles, CheckCircle2, ChevronRight, X, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { SkeletonCard, SkeletonLine } from "@/components/ui/skeleton";

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
            <div className="space-y-6 pt-4">
                <div className="flex items-center gap-2 px-2">
                    <SkeletonLine width="40px" className="h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <SkeletonLine width="55%" className="h-7" />
                        <SkeletonLine width="75%" className="h-4" />
                    </div>
                </div>
                <div className="px-2 space-y-4">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <p className="text-red-400 font-medium">Failed to load retention queue.</p>
                <Button variant="outline" onClick={() => refetch()} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 relative pb-24">
            {/* Header */}
            <div className="flex items-center gap-2 px-2">
                <Button variant="ghost" size="icon" onClick={() => push('/dashboard')} className="hover:bg-white/10 rounded-full text-white">
                    <ChevronRight className="h-6 w-6 rotate-180" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-white shadow-sm tracking-tight">Smart Follow-ups</h1>
                    <p className="text-sm text-indigo-300 font-medium">AI-drafted reminders to secure repeat jobs.</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="px-2 space-y-4">
                {queue.length > 0 ? (
                    queue.map((msg, idx: number) => {
                        const lastStr = msg.lastServiceDate
                            ? format(new Date(msg.lastServiceDate), "dd MMM yyyy")
                            : "Unknown";

                        return (
                        <motion.div
                            key={msg.assetId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className="shadow-xl rounded-3xl overflow-hidden relative">
                                {/* Status/Context Header */}
                                <div className="bg-gradient-to-r from-indigo-500/20 to-purple-600/20 p-4 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border backdrop-blur-sm ${msg.isOverdue ? "bg-rose-500/15 text-rose-200 border-rose-400/25" : "bg-blue-500/15 text-blue-200 border-blue-400/25"}`}>
                                            {msg.isOverdue ? "Overdue" : "Due Soon"} &middot; {msg.monthsPassed}mo
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-400 text-xs font-medium">
                                        <Clock className="h-3.5 w-3.5" />
                                        Last: {lastStr}
                                    </div>
                                </div>

                                <CardContent className="p-5 space-y-4">
                                    {/* Client Info */}
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-indigo-600 p-2 rounded-full text-white shadow-lg shadow-indigo-500/30">
                                            <User className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-lg leading-tight">{msg.clientName}</p>
                                            <p className="text-sm text-slate-400 font-medium">{msg.assetType}{msg.locationInHome ? ` — ${msg.locationInHome}` : ""}</p>
                                        </div>
                                    </div>

                                    {/* Draft Content */}
                                    <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 relative">
                                        <div className="absolute -top-3 left-4 bg-slate-800 px-2 flex items-center gap-1.5 border border-white/5 rounded-full shadow-sm">
                                            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                                            <span className="text-[10px] font-bold uppercase text-slate-300 tracking-wider">Draft</span>
                                        </div>
                                        {editingId === msg.assetId ? (
                                            <div className="pt-2">
                                                <Textarea
                                                    value={editDraft}
                                                    onChange={(e) => setEditDraft(e.target.value)}
                                                    className="min-h-[120px] bg-slate-900 border-white/10 text-white rounded-xl mb-3"
                                                />
                                                <div className="flex gap-2">
                                                    <Button size="sm" onClick={saveEdit} className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4">Save</Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-slate-400">Cancel</Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed pb-6 pt-1">
                                                    &ldquo;{getDraft(msg)}&rdquo;
                                                </p>
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    onClick={() => handleEditClick(msg)}
                                                    className="absolute bottom-2 right-2 text-indigo-400 font-medium h-auto p-0"
                                                >
                                                    Edit Draft
                                                </Button>
                                            </>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    {editingId !== msg.assetId && (
                                        <div className="flex gap-3 pt-2">
                                            <Button
                                                variant="outline"
                                                onClick={() => handleDismiss(msg.assetId)}
                                                className="h-12 w-12 rounded-2xl bg-white/5 border-white/10 text-slate-400 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all p-0 shrink-0"
                                            >
                                                <X className="h-5 w-5" />
                                            </Button>
                                            <Button
                                                onClick={() => handleApprove(msg)}
                                                className="flex-1 h-12 rounded-2xl bg-green-600 hover:bg-green-700 text-white font-bold text-base shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all border-0 flex items-center justify-center gap-2"
                                            >
                                                Send to WhatsApp <Send className="h-4 w-4" />
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
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-16 bg-slate-900/40 rounded-3xl border border-white/5 backdrop-blur-md mt-8"
                    >
                        <div className="mx-auto w-16 h-16 bg-indigo-500/20 text-indigo-400 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-8 w-8" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 tracking-tight">All Caught Up!</h3>
                        <p className="text-slate-400 text-sm max-w-[250px] mx-auto leading-relaxed">
                            You&apos;ve reviewed all pending follow-ups. We&apos;ll generate new drafts when clients hit their 3-month mark.
                        </p>
                    </motion.div>
                )}
            </div>

        </div>
    );
}
