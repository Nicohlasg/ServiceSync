"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, CheckCircle2, Clock, Download, Loader2, ChevronDown } from "lucide-react";
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
    const [archiveMonth, setArchiveMonth] = useState(String(today.getMonth() + 1));
    const [archiveYear, setArchiveYear] = useState(String(today.getFullYear()));
    const [archivesOpen, setArchivesOpen] = useState(false);

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
        const matchesFilter = filter === "all" ? true : inv.status === filter;
        return matchesSearch && matchesFilter;
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
                <div className="space-y-3">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
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
                        placeholder="Search invoice..."
                        className="pl-12 rounded-2xl"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {["all", "pending", "paid"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f as typeof filter)}
                            className={`
                        px-4 py-2 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all
                        ${filter === f
                                    ? "bg-white text-slate-900 shadow-lg scale-105"
                                    : "bg-slate-900/40 text-slate-300 border border-white/10 hover:bg-slate-900/60"}
                    `}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Invoice List */}
            <div className="space-y-6 flex-1 overflow-y-auto no-scrollbar pb-20">
                <AnimatePresence mode="popLayout">
                    {Object.keys(groupedInvoices).length > 0 ? (
                        Object.entries(groupedInvoices).map(([month, monthInvoices], groupIndex) => (
                            <motion.div
                                key={month}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 + groupIndex * 0.1 }}
                            >
                                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">{month}</h3>
                                <div className="space-y-3">
                                    {monthInvoices.map((invoice) => (
                                        <Card
                                            key={invoice.id}
                                            className="active:scale-[0.98] transition-all cursor-pointer hover:bg-white/[0.07] rounded-2xl group border-l-4 border-l-transparent hover:border-l-blue-500"
                                            onClick={() => push(`/dashboard/invoices/${invoice.id}`)}
                                        >
                                            <CardContent className="p-4 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className={`
                                            h-12 w-12 rounded-xl flex items-center justify-center shadow-inner border backdrop-blur-sm
                                            ${invoice.status === "paid"
                                                                ? "bg-emerald-500/15 border-emerald-400/25 text-emerald-300"
                                                                : invoice.status === "void"
                                                                    ? "bg-red-500/15 border-red-400/25 text-red-300"
                                                                    : "bg-amber-500/15 border-amber-400/25 text-amber-300"}
                                        `}>
                                                        {invoice.status === "paid" ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                                                    </div>
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
                                                        variant={invoice.status === "paid" ? "success" : invoice.status === "void" ? "destructive" : "warning"}
                                                        className="mt-1 text-[10px] uppercase tracking-wide"
                                                    >
                                                        {invoice.status}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </motion.div>
                        ))
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
        </div>
    );
}
