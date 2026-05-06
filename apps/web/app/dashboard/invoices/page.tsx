"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, CheckCircle2, Clock, Download, Loader2, ChevronDown, Trash2, CheckSquare, Square, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Invoice } from "@/lib/types";
import { motion, AnimatePresence } from "framer-motion";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { api } from "@/lib/api";
import { SkeletonCard, SkeletonStat, SkeletonLine } from "@/components/ui/skeleton";
import { toast } from "sonner";

function downloadBase64File(base64: string, fileName: string, mimeType: string) {
    const binary = window.atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const blob = new Blob([bytes], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export default function InvoicesPage() {
    const { push } = useRouter();
    const today = new Date();
    const [filter, setFilter] = useState<"all" | "paid" | "pending">("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [clientFilter, setClientFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
    const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());
    const [archiveMonth, setArchiveMonth] = useState(String(today.getMonth() + 1));
    const [archiveYear, setArchiveYear] = useState(String(today.getFullYear()));
    const [archivesOpen, setArchivesOpen] = useState(false);

    // ── Multi-select state ──
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const selectMode = selectedIds.size > 0;
    const utils = api.useUtils();
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const justLongPressed = useRef(false);

    function startLongPress(id: string) {
        pressTimer.current = setTimeout(() => {
            justLongPressed.current = true;
            window.navigator?.vibrate?.(10);
            setSelectedIds(prev => { const next = new Set(prev); next.add(id); return next; });
        }, 500);
    }

    function cancelLongPress() {
        if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
    }

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = (ids: string[]) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const allSelected = ids.every(id => next.has(id));
            if (allSelected) { ids.forEach(id => next.delete(id)); }
            else { ids.forEach(id => next.add(id)); }
            return next;
        });
    };

    const bulkUpdateStatus = api.invoices.bulkUpdateStatus.useMutation({
        onSuccess: async (result) => {
            toast.success(`${result.updated} invoice${result.updated !== 1 ? 's' : ''} updated`);
            setSelectedIds(new Set());
            await utils.invoices.list.invalidate();
        },
        onError: (err) => toast.error(err.message || 'Bulk update failed'),
    });

    const bulkDelete = api.invoices.bulkDelete.useMutation({
        onSuccess: async (result) => {
            toast.success(`${result.deleted} invoice${result.deleted !== 1 ? 's' : ''} deleted${result.skipped > 0 ? ` (${result.skipped} skipped — only draft/pending/void can be deleted)` : ''}`);
            setSelectedIds(new Set());
            await utils.invoices.list.invalidate();
        },
        onError: (err) => toast.error(err.message || 'Bulk delete failed'),
    });

    const isBulkBusy = bulkUpdateStatus.isPending || bulkDelete.isPending;

    const toggleMonth = (month: string) => {
        setCollapsedMonths(prev => {
            const next = new Set(prev);
            if (next.has(month)) next.delete(month); else next.add(month);
            return next;
        });
    };

    const { data: invoicesData, isLoading, isError, refetch } = api.invoices.list.useQuery({ limit: 100 }, { staleTime: 30 * 1000 });
    const downloadMonthly = api.invoices.downloadMonthly.useMutation();
    const downloadYearly = api.invoices.downloadYearly.useMutation();
    const downloadAll = api.invoices.downloadAll.useMutation();

    const invoices: Invoice[] = (invoicesData?.invoices || []).map((inv) => {
        const client = inv.clients as unknown as { id?: string | null; name?: string | null } | null;
        return {
            id: inv.id,
            clientId: client?.id || '',
            clientName: client?.name || 'Unknown Client',
            amount: (inv.total_cents ? inv.total_cents / 100 : undefined) ?? inv.amount ?? 0,
            date: inv.created_at,
            status: ['paid_cash', 'paid_qr'].includes(inv.status) ? "paid"
                : inv.status === 'void' ? "void"
                : inv.status === 'draft' ? "draft"
                : "pending",
        };
    });

    const filteredInvoices = invoices.filter(inv => {
        const matchesSearch = inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
            inv.id.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filter === "all" ? true : inv.status === filter;
        // Advanced filters
        const matchesClient = clientFilter.trim() === "" ||
            inv.clientName.toLowerCase().includes(clientFilter.toLowerCase());
        const matchesFrom = dateFrom === "" || new Date(inv.date) >= new Date(dateFrom + "T00:00:00");
        const matchesTo = dateTo === "" || new Date(inv.date) <= new Date(dateTo + "T23:59:59");
        return matchesSearch && matchesStatus && matchesClient && matchesFrom && matchesTo;
    });

    // Sort by date desc
    filteredInvoices.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by Month
    const groupedInvoices: { [key: string]: typeof invoices } = {};
    filteredInvoices.forEach(inv => {
        const monthKey = format(new Date(inv.date), "MMMM yyyy");
        if (!groupedInvoices[monthKey]) groupedInvoices[monthKey] = [];
        groupedInvoices[monthKey].push(inv);
    });

    const totalPending = invoices.filter(i => i.status === "pending").reduce((acc, curr) => acc + curr.amount, 0);
    const totalPaid = invoices.filter(i => i.status === "paid").reduce((acc, curr) => acc + curr.amount, 0);
    const archiveYears = Array.from(
        new Set([
            today.getFullYear(),
            ...invoices.map((invoice) => new Date(invoice.date).getFullYear()),
        ]),
    ).sort((a, b) => b - a);
    const monthOptions = Array.from({ length: 12 }, (_, index) => {
        const monthNumber = index + 1;
        return {
            value: String(monthNumber),
            label: format(new Date(2000, index, 1), "MMMM"),
        };
    });

    async function handleDownloadMonthlyArchive() {
        try {
            const result = await downloadMonthly.mutateAsync({
                month: Number(archiveMonth),
                year: Number(archiveYear),
            });
            downloadBase64File(result.zipBase64, result.fileName, "application/zip");
            toast.success(`Downloaded ${result.fileCount} invoice PDF${result.fileCount === 1 ? "" : "s"}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to download monthly invoices");
        }
    }

    async function handleDownloadYearlyArchive() {
        try {
            const result = await downloadYearly.mutateAsync({ year: Number(archiveYear) });
            downloadBase64File(result.zipBase64, result.fileName, "application/zip");
            toast.success(`Downloaded ${result.fileCount} invoice PDF${result.fileCount === 1 ? "" : "s"}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to download yearly invoices");
        }
    }

    async function handleDownloadAllArchive() {
        try {
            const result = await downloadAll.mutateAsync();
            downloadBase64File(result.zipBase64, result.fileName, "application/zip");
            toast.success(`Downloaded ${result.fileCount} invoice PDF${result.fileCount === 1 ? "" : "s"}`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to download invoice archive");
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6 pt-4">
                <div className="flex items-center justify-between px-2">
                    <SkeletonLine width="40%" className="h-7" />
                    <SkeletonLine width="48px" className="h-12 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3 px-2">
                    <SkeletonStat />
                    <SkeletonStat />
                </div>
                <div className="flex gap-2 px-2">
                    <SkeletonLine width="50px" className="h-9 rounded-full" />
                    <SkeletonLine width="70px" className="h-9 rounded-full" />
                    <SkeletonLine width="50px" className="h-9 rounded-full" />
                </div>
                <div className="space-y-3 px-2">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="glass-card glass-inner-light rounded-2xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <SkeletonLine width="48px" className="h-12 rounded-xl" />
                                <div className="space-y-1.5">
                                    <SkeletonLine width="110px" className="h-4" />
                                    <SkeletonLine width="80px" className="h-3" />
                                </div>
                            </div>
                            <div className="space-y-1.5 text-right">
                                <SkeletonLine width="70px" className="h-5" />
                                <SkeletonLine width="50px" className="h-4 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <p className="text-red-400 font-medium">Failed to load invoices.</p>
                <Button variant="outline" onClick={() => refetch()} className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl font-bold uppercase tracking-widest text-[10px]">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 h-full flex flex-col text-white">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <h1 className="text-2xl font-black text-white tracking-tight leading-none">Invoices</h1>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/quotes">
                        <Button variant="outline" className="h-10 px-4 rounded-xl bg-white/5 border-white/10 text-zinc-400 hover:text-white font-black uppercase tracking-widest text-[10px] gap-2">
                            <FileText className="h-4 w-4" /> Quotes
                        </Button>
                    </Link>
                    <Link href="/dashboard/invoices/new">
                        <Button size="icon" className="rounded-full h-12 w-12 shadow-xl shadow-blue-600/30 bg-blue-600 hover:bg-blue-700 active:scale-90 transition-transform">
                            <Plus className="h-6 w-6" />
                        </Button>
                    </Link>
                </div>
            </motion.div>

            {/* Summary Cards */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-4"
            >
                <Card variant="premium" className="p-4 backdrop-blur-xl">
                    <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Pending</p>
                    <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(totalPending)}</p>
                </Card>
                <Card variant="premium" className="p-4 backdrop-blur-xl">
                    <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">Collected</p>
                    <p className="text-2xl font-black text-white tracking-tight">{formatCurrency(totalPaid)}</p>
                </Card>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 backdrop-blur-xl shadow-lg"
            >
                <button
                    type="button"
                    onClick={() => setArchivesOpen((open) => !open)}
                    className="flex w-full items-start justify-between gap-4 text-left group"
                    aria-expanded={archivesOpen}
                >
                    <div className="space-y-1">
                        <p className="text-white text-xs font-black uppercase tracking-widest">Download Archives</p>
                        <p className="text-sm text-zinc-400 font-medium leading-relaxed">
                            Export professional invoice PDFs for tax records.
                        </p>
                    </div>
                    <motion.div
                        animate={{ rotate: archivesOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1 rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-400 group-hover:text-white transition-colors shadow-inner"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </motion.div>
                </button>

                <AnimatePresence initial={false}>
                    {archivesOpen ? (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="space-y-4 overflow-hidden pt-2"
                        >
                            <div className="grid grid-cols-2 gap-3">
                                <Select value={archiveMonth} onValueChange={setArchiveMonth}>
                                    <SelectTrigger className="h-12 rounded-xl border-white/10 bg-white/5 text-white backdrop-blur-md font-bold text-xs uppercase tracking-widest">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-zinc-900 text-white backdrop-blur-2xl">
                                        {monthOptions.map((month) => (
                                            <SelectItem key={month.value} value={month.value} className="focus:bg-white/10 focus:text-white font-bold text-xs uppercase tracking-widest py-3">
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={archiveYear} onValueChange={setArchiveYear}>
                                    <SelectTrigger className="h-12 rounded-xl border-white/10 bg-white/5 text-white backdrop-blur-md font-bold text-xs uppercase tracking-widest">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/10 bg-zinc-900 text-white backdrop-blur-2xl">
                                        {archiveYears.map((year) => (
                                            <SelectItem key={year} value={String(year)} className="focus:bg-white/10 focus:text-white font-bold text-xs uppercase tracking-widest py-3">
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 gap-3">
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl border-white/10 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 font-black uppercase tracking-widest text-[10px]"
                                    disabled={downloadMonthly.isPending || downloadYearly.isPending || downloadAll.isPending}
                                    onClick={handleDownloadMonthlyArchive}
                                >
                                    {downloadMonthly.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                                    Month ZIP
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl border-white/10 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 font-black uppercase tracking-widest text-[10px]"
                                    disabled={downloadMonthly.isPending || downloadYearly.isPending || downloadAll.isPending}
                                    onClick={handleDownloadYearlyArchive}
                                >
                                    {downloadYearly.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                                    Year ZIP
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-12 rounded-xl border-white/10 bg-white/5 text-zinc-300 hover:text-white hover:bg-white/10 font-black uppercase tracking-widest text-[10px]"
                                    disabled={downloadMonthly.isPending || downloadYearly.isPending || downloadAll.isPending}
                                    onClick={handleDownloadAllArchive}
                                >
                                    {downloadAll.isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-2 h-3.5 w-3.5" />}
                                    Full History ZIP
                                </Button>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>

            {/* Search & Filter */}
            <div className="sticky top-0 z-20 bg-zinc-900/75 backdrop-blur-xl pb-3 pt-2 -mx-4 px-4 space-y-4 border-b border-white/10 shadow-2xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-500 group-focus-within:text-blue-400 transition-colors z-10" />
                    <Input
                        placeholder="Client name or ID..."
                        className="pl-12 h-14 rounded-2xl bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 pr-20 font-bold"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowAdvancedFilter(v => !v)}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 h-8 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                            showAdvancedFilter || clientFilter || dateFrom || dateTo
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                : 'bg-white/10 text-zinc-400 hover:text-white'
                        }`}
                    >
                        Filters
                    </button>
                </div>

                <AnimatePresence initial={false}>
                    {showAdvancedFilter && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden space-y-3 pb-2"
                        >
                            <Input
                                placeholder="Filter by client name..."
                                className="rounded-xl h-11 text-sm bg-white/5 border-white/10 font-bold text-white placeholder:text-zinc-700"
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                            />
                            <div className="flex gap-3">
                                <div className="space-y-1 flex-1">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1">From</p>
                                    <Input
                                        type="date"
                                        className="rounded-xl h-11 text-xs bg-white/5 border-white/10 text-white appearance-none px-3 font-bold"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1">To</p>
                                    <Input
                                        type="date"
                                        className="rounded-xl h-11 text-xs bg-white/5 border-white/10 text-white appearance-none px-3 font-bold"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </div>
                            </div>
                            {(clientFilter || dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={() => { setClientFilter(''); setDateFrom(''); setDateTo(''); }}
                                    className="text-[10px] text-rose-400 font-black uppercase tracking-widest bg-rose-400/10 px-3 py-1.5 rounded-lg border border-rose-400/20 active:scale-95 transition-transform"
                                >
                                    Clear all filters
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1.5 px-0.5">
                    {["all", "pending", "paid"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as typeof filter)}
                            className={`
                        px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all border
                        ${filter === f
                                    ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-600/25 scale-105 z-10"
                                    : "bg-white/5 text-zinc-400 border-white/5 hover:border-white/10 hover:text-white"}
                    `}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Invoice List */}
            <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-32 px-1">
                <AnimatePresence mode="popLayout">
                    {Object.keys(groupedInvoices).length > 0 ? (
                        Object.entries(groupedInvoices).map(([month, monthInvoices], groupIndex) => {
                            const isCollapsed = collapsedMonths.has(month);
                            const monthTotal = monthInvoices.reduce((s, i) => s + i.amount, 0);
                            return (
                                <motion.div
                                    key={month}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 + groupIndex * 0.05 }}
                                    className="space-y-3"
                                >
                                    {/* Collapsible month header */}
                                    <div className="flex items-center gap-3 px-3">
                                        {selectMode && (
                                            <button type="button" onClick={() => toggleSelectAll(monthInvoices.map(i => i.id))} className="text-zinc-500 hover:text-blue-400 transition-colors">
                                                {monthInvoices.every(i => selectedIds.has(i.id)) ? <CheckSquare className="h-5 w-5 text-blue-400" /> : <Square className="h-5 w-5" />}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => toggleMonth(month)}
                                            className="flex-1 flex items-center justify-between group py-1"
                                        >
                                            <div className="flex items-center gap-2">
                                                <ChevronDown className={`h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-all duration-200 ${
                                                    isCollapsed ? '-rotate-90' : ''
                                                }`} />
                                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">{month}</h3>
                                            </div>
                                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                                                {formatCurrency(monthTotal)}
                                            </span>
                                        </button>
                                    </div>

                                    <AnimatePresence initial={false}>
                                        {!isCollapsed && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden space-y-3"
                                            >
                                                {monthInvoices.map((invoice) => {
                                                    const isSelected = selectedIds.has(invoice.id);
                                                    return (
                                                    <Card
                                                        key={invoice.id}
                                                        variant="premium"
                                                        className={`active:scale-[0.98] transition-all cursor-pointer group rounded-2xl border ${
                                                            isSelected ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-600/10' : 'border-white/10 hover:border-blue-500/40'
                                                        }`}
                                                        onClick={() => {
                                                            if (justLongPressed.current) { justLongPressed.current = false; return; }
                                                            if (selectMode) { toggleSelect(invoice.id); } else { push(`/dashboard/invoices/${invoice.id}`); }
                                                        }}
                                                        onPointerDown={() => startLongPress(invoice.id)}
                                                        onPointerUp={cancelLongPress}
                                                        onPointerLeave={cancelLongPress}
                                                        onPointerCancel={cancelLongPress}
                                                    >
                                                        <CardContent className="p-4 flex items-center justify-between relative z-10">
                                                            <div className="flex items-center gap-4">
                                                                {selectMode ? (
                                                                    <div className="h-12 w-12 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 text-blue-400">
                                                                        {isSelected ? <CheckSquare className="h-6 w-6" /> : <Square className="h-6 w-6 text-zinc-600" />}
                                                                    </div>
                                                                ) : (
                                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner border backdrop-blur-sm ${invoice.status === "paid" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : invoice.status === "void" ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"}`}>
                                                                    {invoice.status === "paid" ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                                                                </div>
                                                                )}
                                                                <div className="overflow-hidden">
                                                                    <h3 className="font-black text-white text-base truncate leading-tight group-hover:text-blue-400 transition-colors">{invoice.clientName}</h3>
                                                                    <div className="flex items-center text-[10px] text-zinc-500 gap-2 font-bold uppercase tracking-wider mt-1">
                                                                        <span>#{invoice.id.slice(0, 6).toUpperCase()}</span>
                                                                        <span className="opacity-30">•</span>
                                                                        <span className="text-zinc-400">{format(new Date(invoice.date), "d MMM")}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex items-center gap-3">
                                                                <div>
                                                                    <p className="font-black text-white text-lg tracking-tight">{formatCurrency(invoice.amount)}</p>
                                                                    <Badge
                                                                        variant={invoice.status === "paid" ? "success" : invoice.status === "void" ? "danger" : "warning"}
                                                                        className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-md"
                                                                    >
                                                                        {invoice.status}
                                                                    </Badge>
                                                                </div>
                                                                <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors group-hover:translate-x-0.5" />
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            );
                        })
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-16 text-zinc-500 bg-white/5 rounded-3xl mt-4 border border-white/5 border-dashed backdrop-blur-md"
                        >
                            <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5 shadow-inner">
                                <FileText className="h-10 w-10 opacity-20" />
                            </div>
                            <p className="font-black text-lg text-zinc-300 tracking-tight uppercase">No records found</p>
                            <p className="text-sm font-medium opacity-70 mt-1">Ready to start earning? Create your first invoice.</p>
                            <Button
                                size="lg"
                                className="mt-8 h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs px-8 rounded-xl shadow-xl shadow-blue-600/20 active:scale-95 transition-transform"
                                onClick={() => push("/dashboard/invoices/new")}
                            >
                                <Plus className="h-4 w-4 mr-2 stroke-[3px]" /> New Invoice
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating Bulk Action Bar */}
            <AnimatePresence>
                {selectMode && (
                    <motion.div
                        initial={{ y: 100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 100, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed bottom-28 left-4 right-4 z-50 max-w-md mx-auto"
                    >
                        <div className="bg-zinc-900/95 border border-white/15 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-5 space-y-4 backdrop-blur-3xl">
                            <div className="flex items-center justify-between px-1">
                                <p className="text-sm font-black text-white uppercase tracking-widest">
                                    <span className="text-blue-400">{selectedIds.size}</span> selected
                                </p>
                                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-[0.2em] transition-colors">
                                    Deselect
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                <Button
                                    size="lg"
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] h-12 rounded-xl shadow-lg shadow-emerald-600/20 px-2"
                                    disabled={isBulkBusy}
                                    onClick={() => bulkUpdateStatus.mutate({ invoiceIds: Array.from(selectedIds), status: 'paid_cash' })}
                                >
                                    {bulkUpdateStatus.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                                    Cash
                                </Button>
                                <Button
                                    size="lg"
                                    className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[9px] h-12 rounded-xl shadow-lg shadow-blue-600/20 px-2"
                                    disabled={isBulkBusy}
                                    onClick={() => bulkUpdateStatus.mutate({ invoiceIds: Array.from(selectedIds), status: 'paid_qr' })}
                                >
                                    {bulkUpdateStatus.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                                    PayNow
                                </Button>
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="border-white/10 bg-white/5 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 font-black uppercase tracking-widest text-[9px] h-12 rounded-xl px-2"
                                    disabled={isBulkBusy}
                                    onClick={() => bulkDelete.mutate({ invoiceIds: Array.from(selectedIds) })}
                                >
                                    {bulkDelete.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1 h-3.5 w-3.5" />}
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
