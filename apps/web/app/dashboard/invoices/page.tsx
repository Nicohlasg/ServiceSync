"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, CheckCircle2, Clock, Download, Loader2, ChevronDown, Trash2, CheckSquare, Square } from "lucide-react";
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

    const { data: invoicesData, isLoading, isError, refetch } = api.invoices.list.useQuery({ limit: 100 });
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
                <div className="flex items-center justify-between">
                    <SkeletonLine width="40%" className="h-7" />
                    <SkeletonLine width="48px" className="h-12 rounded-full" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <SkeletonStat />
                    <SkeletonStat />
                </div>
                {/* Filter pills */}
                <div className="flex gap-2">
                    <SkeletonLine width="50px" className="h-9 rounded-full" />
                    <SkeletonLine width="70px" className="h-9 rounded-full" />
                    <SkeletonLine width="50px" className="h-9 rounded-full" />
                </div>
                {/* Invoice row skeletons */}
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
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
                <p className="text-red-400 font-medium">Failed to load invoices.</p>
                <Button variant="outline" onClick={() => refetch()} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 pt-4 h-full flex flex-col">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between"
            >
                <h1 className="text-2xl font-bold text-white drop-shadow-md">Invoices</h1>
                <Link href="/dashboard/invoices/new">
                    <Button size="icon" className="rounded-full h-12 w-12 shadow-lg shadow-blue-500/30">
                        <Plus className="h-6 w-6" />
                    </Button>
                </Link>
            </motion.div>

            {/* Summary Cards */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="grid grid-cols-2 gap-3"
            >
                {/* 60/30/10: neutral dark-glass base with semantic accent text only */}
                <div className="glass-card glass-inner-light p-4">
                    <p className="text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">Pending</p>
                    <p className="text-2xl font-extrabold text-white drop-shadow-sm">{formatCurrency(totalPending)}</p>
                </div>
                <div className="glass-card glass-inner-light p-4">
                    <p className="text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">Collected</p>
                    <p className="text-2xl font-extrabold text-white drop-shadow-sm">{formatCurrency(totalPaid)}</p>
                </div>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="glass-card glass-inner-light p-4 space-y-4"
            >
                <button
                    type="button"
                    onClick={() => setArchivesOpen((open) => !open)}
                    className="flex w-full items-start justify-between gap-4 text-left"
                    aria-expanded={archivesOpen}
                >
                    <div className="space-y-1">
                        <p className="text-white text-sm font-bold uppercase tracking-wider">Download Archives</p>
                        <p className="text-sm text-slate-300">
                            Export professional invoice PDFs for tax records by month, year, or all time.
                        </p>
                    </div>
                    <motion.div
                        animate={{ rotate: archivesOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-1 rounded-full border border-white/10 bg-slate-950/35 p-2 text-slate-300"
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
                            className="space-y-4 overflow-hidden"
                        >
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <Select value={archiveMonth} onValueChange={setArchiveMonth}>
                                    <SelectTrigger className="h-12 rounded-2xl border-white/15 bg-slate-950/55 text-white backdrop-blur-xl">
                                        <SelectValue placeholder="Month" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/15 bg-slate-950/85 text-white backdrop-blur-2xl">
                                        {monthOptions.map((month) => (
                                            <SelectItem key={month.value} value={month.value} className="focus:bg-white/10 focus:text-white">
                                                {month.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <Select value={archiveYear} onValueChange={setArchiveYear}>
                                    <SelectTrigger className="h-12 rounded-2xl border-white/15 bg-slate-950/55 text-white backdrop-blur-xl">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent className="border-white/15 bg-slate-950/85 text-white backdrop-blur-2xl">
                                        {archiveYears.map((year) => (
                                            <SelectItem key={year} value={String(year)} className="focus:bg-white/10 focus:text-white">
                                                {year}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <Button
                                    variant="outline"
                                    className="border-white/15 text-slate-200 hover:bg-white/10 hover:text-white"
                                    disabled={downloadMonthly.isPending || downloadYearly.isPending || downloadAll.isPending}
                                    onClick={handleDownloadMonthlyArchive}
                                >
                                    {downloadMonthly.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Month ZIP
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-white/15 text-slate-200 hover:bg-white/10 hover:text-white"
                                    disabled={downloadMonthly.isPending || downloadYearly.isPending || downloadAll.isPending}
                                    onClick={handleDownloadYearlyArchive}
                                >
                                    {downloadYearly.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Year ZIP
                                </Button>
                                <Button
                                    variant="outline"
                                    className="border-white/15 text-slate-200 hover:bg-white/10 hover:text-white"
                                    disabled={downloadMonthly.isPending || downloadYearly.isPending || downloadAll.isPending}
                                    onClick={handleDownloadAllArchive}
                                >
                                    {downloadAll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    All Invoices
                                </Button>
                            </div>
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </motion.div>

            {/* Search & Filter */}
            <div className="sticky top-0 z-10 bg-transparent pb-2 pt-2 -mx-4 px-4 space-y-3">
                <div className="relative group">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-300 z-10" />
                    <Input
                        placeholder="Search by name or invoice ID..."
                        className="pl-12 rounded-2xl pr-12"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={() => setShowAdvancedFilter(v => !v)}
                        className={`absolute right-3 top-2.5 h-7 px-2 rounded-lg text-xs font-bold transition-colors ${
                            showAdvancedFilter || clientFilter || dateFrom || dateTo
                                ? 'bg-blue-500/30 text-blue-300'
                                : 'text-slate-400 hover:text-slate-200'
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
                            className="overflow-hidden space-y-2"
                        >
                            <Input
                                placeholder="Filter by client name..."
                                className="rounded-xl h-10 text-sm"
                                value={clientFilter}
                                onChange={(e) => setClientFilter(e.target.value)}
                            />
                            <div className="flex flex-col sm:flex-row gap-2">
                                <div className="space-y-1 flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">From</p>
                                    <Input
                                        type="date"
                                        className="rounded-xl h-10 text-sm w-full min-w-0 max-w-full appearance-none px-3"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1 flex-1 min-w-0">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">To</p>
                                    <Input
                                        type="date"
                                        className="rounded-xl h-10 text-sm w-full min-w-0 max-w-full appearance-none px-3"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                    />
                                </div>
                            </div>
                            {(clientFilter || dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={() => { setClientFilter(''); setDateFrom(''); setDateTo(''); }}
                                    className="text-xs text-red-400 font-semibold"
                                >
                                    Clear advanced filters
                                </button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {["all", "pending", "paid"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as typeof filter)}
                            className={`
                        px-4 py-2 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all
                        ${filter === f
                                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25 scale-105"
                                    : "bg-slate-900/40 text-slate-300 border border-white/10 hover:bg-slate-900/60"}
                    `}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Invoice List */}
            <div className="space-y-4 flex-1 overflow-y-auto no-scrollbar pb-20">
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
                                >
                                    {/* Collapsible month header */}
                                    <div className="flex items-center gap-2 px-2 mb-2">
                                        {selectMode && (
                                            <button type="button" onClick={() => toggleSelectAll(monthInvoices.map(i => i.id))} className="text-slate-400 hover:text-blue-400 transition-colors">
                                                {monthInvoices.every(i => selectedIds.has(i.id)) ? <CheckSquare className="h-4 w-4 text-blue-400" /> : <Square className="h-4 w-4" />}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => toggleMonth(month)}
                                            className="flex-1 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-2">
                                                <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                                                    isCollapsed ? '-rotate-90' : ''
                                                }`} />
                                                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{month}</h3>
                                            </div>
                                            <span className="text-xs text-slate-400 font-semibold">
                                                {monthInvoices.length} invoice{monthInvoices.length !== 1 ? 's' : ''} · {formatCurrency(monthTotal)}
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
                                                        className={`active:scale-[0.98] transition-all cursor-pointer hover:bg-white/[0.07] rounded-2xl group border-l-4 ${
                                                            isSelected ? 'border-l-blue-500 bg-blue-500/10' : 'border-l-transparent hover:border-l-blue-500'
                                                        }`}
                                                        onClick={() => selectMode ? toggleSelect(invoice.id) : push(`/dashboard/invoices/${invoice.id}`)}
                                                        onContextMenu={(e) => { e.preventDefault(); toggleSelect(invoice.id); }}
                                                    >
                                                        <CardContent className="p-4 flex items-center justify-between">
                                                            <div className="flex items-center gap-4">
                                                                {selectMode ? (
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); toggleSelect(invoice.id); }} className="h-12 w-12 rounded-xl flex items-center justify-center border border-white/15 text-slate-300 hover:text-white transition-colors">
                                                                        {isSelected ? <CheckSquare className="h-6 w-6 text-blue-400" /> : <Square className="h-6 w-6" />}
                                                                    </button>
                                                                ) : (
                                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-inner border backdrop-blur-sm ${invoice.status === "paid" ? "bg-emerald-500/15 border-emerald-400/25 text-emerald-300" : invoice.status === "void" ? "bg-red-500/15 border-red-400/25 text-red-300" : "bg-amber-500/15 border-amber-400/25 text-amber-300"}`}>
                                                                    {invoice.status === "paid" ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                                                                </div>
                                                                )}
                                                                <div>
                                                                    <h3 className="font-bold text-white text-base">{invoice.clientName}</h3>
                                                                    <div className="flex items-center text-xs text-slate-300 gap-2 font-medium">
                                                                        <span>#{invoice.id.slice(0, 6).toUpperCase()}</span>
                                                                        <span>•</span>
                                                                        <span>{format(new Date(invoice.date), "d MMM")}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-white text-lg">{formatCurrency(invoice.amount)}</p>
                                                                <Badge
                                                                    variant={invoice.status === "paid" ? "success" : invoice.status === "void" ? "danger" : "warning"}
                                                                    className="mt-1 text-[10px] uppercase tracking-wide"
                                                                >
                                                                    {invoice.status}
                                                                </Badge>
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
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center py-12 text-slate-400 glass-card glass-inner-light rounded-3xl mt-4"
                        >
                            <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
                            <p className="font-medium text-lg text-slate-200">No invoices found.</p>
                            <p className="text-sm opacity-70">Create a new invoice to get started.</p>
                            <Button
                                variant="link"
                                className="text-blue-400 mt-2 font-bold hover:text-blue-300"
                                onClick={() => push("/dashboard/invoices/new")}
                            >
                                Create Invoice
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Floating Bulk Action Bar */}
            <AnimatePresence>
                {selectMode && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
                    >
                        <div className="bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl shadow-black/40 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-white">
                                    {selectedIds.size} selected
                                </p>
                                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-white font-semibold">
                                    Clear
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                    disabled={isBulkBusy}
                                    onClick={() => bulkUpdateStatus.mutate({ invoiceIds: Array.from(selectedIds), status: 'paid_cash' })}
                                >
                                    {bulkUpdateStatus.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                    Mark Paid
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/15"
                                    disabled={isBulkBusy}
                                    onClick={() => bulkDelete.mutate({ invoiceIds: Array.from(selectedIds) })}
                                >
                                    {bulkDelete.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
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
