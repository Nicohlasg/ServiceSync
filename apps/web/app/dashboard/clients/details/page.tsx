"use client";

import { useState, Suspense, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, MapPin, Wrench, Calendar, FileText, Pencil,
  Trash2, X, ChevronDown, CheckCircle2, Clock, Search, Filter, ChevronRight, Loader2,
} from "lucide-react";
import { SkeletonCard, SkeletonLine, SkeletonCircle } from "@/components/ui/skeleton";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

// ---------------------------------------------------------------------------
// Types for the data shapes returned by the backend
// ---------------------------------------------------------------------------
type InvoiceRow = {
  id: string;
  invoice_number?: string | null;
  status: string;
  paid_at?: string | null;
  created_at?: string | null;
  payment_method?: string | null;
  total_cents?: number | null;
  amount?: number | null;
  booking_id?: string | null;
};

type BookingRow = {
  id: string;
  status: string;
  service_type?: string | null;
  scheduled_date?: string | null;
  amount?: number | null;
};

// A unified "transaction" row for the combined list
type TransactionRow =
  | { kind: "invoice"; date: string; data: InvoiceRow }
  | { kind: "job"; date: string; data: BookingRow };

// ---------------------------------------------------------------------------
function ClientDetails() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("id") ?? "";
  const { push } = useRouter();
  const utils = api.useUtils();

  const { data: client, isLoading, isFetching, isError, refetch } = api.clients.getById.useQuery(
    { clientId },
    {
      enabled: !!clientId,
      staleTime: 30 * 1000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    },
  );

  // ── Edit state ──
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", address: "", unitNumber: "",
    lat: null as number | null, lng: null as number | null,
    notes: "",
  });

  // ── Delete confirmation ──
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Transaction filter state ──
  const [txTab, setTxTab] = useState<"all" | "invoices" | "jobs">("all");
  const [txSearch, setTxSearch] = useState("");
  const [txDateFrom, setTxDateFrom] = useState("");
  const [txDateTo, setTxDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set());

  const toggleMonth = (m: string) => {
    setCollapsedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  // ── Transaction list — must be before any early returns (Rules of Hooks) ──
  const transactions = useMemo(() => {
    const safeInvoices = ((client as any)?.invoices ?? []) as InvoiceRow[];
    const safeBookings = ((client as any)?.bookings ?? []) as BookingRow[];
    const rows: TransactionRow[] = [];

    if (txTab === "all" || txTab === "invoices") {
      safeInvoices.forEach(inv => {
        rows.push({
          kind: "invoice",
          date: inv.paid_at ?? inv.created_at ?? new Date().toISOString(),
          data: inv,
        });
      });
    }
    if (txTab === "all" || txTab === "jobs") {
      const invoicedBookingIds = new Set(
        safeInvoices.map(inv => inv.booking_id).filter(Boolean)
      );
      safeBookings.forEach(b => {
        if (invoicedBookingIds.has(b.id)) return;
        rows.push({
          kind: "job",
          date: b.scheduled_date ? b.scheduled_date + "T00:00:00" : new Date().toISOString(),
          data: b,
        });
      });
    }

    const q = txSearch.toLowerCase().trim();
    const filtered = rows.filter(r => {
      if (q) {
        if (r.kind === "invoice") {
          const inv = r.data as InvoiceRow;
          if (!(inv.invoice_number ?? "").toLowerCase().includes(q) && !inv.id.toLowerCase().includes(q)) return false;
        } else {
          const job = r.data as BookingRow;
          if (!(job.service_type ?? "").toLowerCase().includes(q) && !job.id.toLowerCase().includes(q)) return false;
        }
      }
      const d = new Date(r.date);
      if (txDateFrom && d < new Date(txDateFrom + "T00:00:00")) return false;
      if (txDateTo && d > new Date(txDateTo + "T23:59:59")) return false;
      return true;
    });

    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const groups: Record<string, TransactionRow[]> = {};
    filtered.forEach(r => {
      let d = new Date(r.date);
      if (isNaN(d.getTime())) d = new Date();
      const monthKey = format(d, "MMMM yyyy");
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(r);
    });

    return groups;
  }, [client, txTab, txSearch, txDateFrom, txDateTo]);

  // ── Mutations ──
  const updateMutation = api.clients.update.useMutation({
    onSuccess: async () => {
      toast.success("Client updated");
      setEditing(false);
      // Invalidate the cached query so the UI refreshes instantly
      await utils.clients.getById.invalidate({ clientId });
    },
    onError: (err) => toast.error(err.message || "Failed to update client"),
  });

  const deleteMutation = api.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted");
      push("/dashboard/clients");
    },
    onError: (err) => toast.error(err.message || "Failed to delete client"),
  });

  const startEdit = () => {
    if (!client) return;
    setEditForm({
      name: client.name ?? "",
      phone: client.phone ?? "",
      address: client.address ?? "",
      unitNumber: (client as any).unit_number ?? "",
      lat: (client as any).lat ?? null,
      lng: (client as any).lng ?? null,
      notes: client.notes ?? "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateMutation.mutate({
      clientId,
      name: editForm.name || undefined,
      phone: editForm.phone || undefined,
      address: editForm.address || undefined,
      unitNumber: editForm.unitNumber || null,
      lat: editForm.lat ?? undefined,
      lng: editForm.lng ?? undefined,
      notes: editForm.notes,
    });
  };

  // Show error only when we're genuinely done loading and have no data.
  // Never show the error screen while a fetch is still in flight — this was
  // causing the "Something went wrong" flash on cold Supabase starts.
  if (isError && !isLoading && !isFetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-white">
        <p className="text-rose-400 font-bold uppercase tracking-widest text-xs">Failed to load client details.</p>
        <Button variant="outline" onClick={() => refetch()} className="border-white/10 bg-white/5 text-white hover:bg-white/10 rounded-xl font-black uppercase tracking-widest text-[10px]">
          Try Again
        </Button>
      </div>
    );
  }

  if (isLoading || isFetching || !client) {
    return (
      <div className="space-y-6 pt-4 pb-24 px-1">
        <div className="flex items-center gap-3">
          <SkeletonCircle size={40} />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="50%" className="h-7" />
            <SkeletonLine width="30%" className="h-4" />
          </div>
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // ── Computed data (after guard — client is non-null here) ──
  const unitNum = (client as any).unit_number;
  const fullAddress = [client.address, unitNum].filter(Boolean).join(', ') || "No address provided";
  const bookings = (client.bookings ?? []) as BookingRow[];
  const totalJobs = bookings.filter(b => b.status !== "cancelled").length;
  const totalRevenueCents = client.stats?.totalRevenueCents ?? 0;

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between px-1"
      >
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard/clients" />
          <h1 className="text-xl font-black text-white tracking-tight leading-none">Client Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={startEdit} className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-zinc-400 hover:text-white transition-all">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="h-10 w-10 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 transition-all">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {confirmDelete && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-rose-600/10 border border-rose-500/20 rounded-2xl p-5 mx-1 backdrop-blur-md">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
                <Trash2 className="h-5 w-5" />
                <p className="text-sm font-black uppercase tracking-tight">Permanently Delete?</p>
            </div>
            <p className="text-xs text-rose-200/80 font-medium mb-5 leading-relaxed">This will delete all history for <span className="font-bold text-white">{client.name}</span>. This action cannot be undone.</p>
            <div className="flex gap-3">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="flex-1 text-[10px] font-black text-zinc-500 hover:text-white uppercase tracking-widest h-11 bg-white/5 rounded-xl border border-white/5">CANCEL</Button>
                <Button size="sm" onClick={() => deleteMutation.mutate({ clientId })} disabled={deleteMutation.isPending} className="flex-1 text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest h-11 rounded-xl shadow-lg shadow-rose-600/20">
                {deleteMutation.isPending ? "DELETING..." : "DELETE FOREVER"}
                </Button>
            </div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Form */}
      {editing ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card variant="premium" className="rounded-[2.5rem] overflow-hidden backdrop-blur-2xl shadow-2xl">
            <CardContent className="p-7 space-y-5">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-black text-blue-400 uppercase tracking-[0.2em] relative z-10">Edit Profile</h2>
                <button onClick={() => setEditing(false)} className="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 hover:text-white transition-colors relative z-10">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 relative z-10">
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Client Name</Label>
                  <Input value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Phone Number</Label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="bg-white/5 border-white/10 text-white h-12 rounded-xl focus:border-blue-500/50 backdrop-blur-md font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1 flex items-center gap-1"><MapPin className="h-3 w-3 text-emerald-400" /> Address</Label>
                  <AddressAutocomplete
                    value={editForm.address}
                    onChange={(addr, lat, lng) => setEditForm(prev => ({ ...prev, address: addr, lat, lng }))}
                    placeholder="Search address..."
                    className="bg-white/5 border-white/10 text-white h-12 rounded-xl backdrop-blur-md"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Unit Number</Label>
                  <Input value={editForm.unitNumber} onChange={(e) => setEditForm(prev => ({ ...prev, unitNumber: e.target.value }))} placeholder="e.g. #01-345" className="bg-white/5 border-white/10 text-white h-12 rounded-xl backdrop-blur-md font-bold" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Private Notes</Label>
                  <Textarea value={editForm.notes} onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))} className="bg-white/5 border-white/10 text-white resize-none rounded-xl focus:border-blue-500/50 backdrop-blur-md font-medium" rows={3} />
                </div>
              </div>
              <div className="flex gap-4 pt-4 relative z-10">
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 h-14 rounded-2xl border-white/10 bg-white/5 text-zinc-500 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all active:scale-95">CANCEL</Button>
                <Button onClick={saveEdit} disabled={updateMutation.isPending} className="flex-1 h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                  {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "SAVE CHANGES"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Profile Card (view mode) */
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} className="px-1">
          <Card variant="premium" className="rounded-[2.5rem] overflow-hidden backdrop-blur-2xl shadow-2xl">
            <CardContent className="p-7">
              <div className="flex justify-between items-start mb-8 relative z-10">
                <div className="overflow-hidden pr-4">
                  <h2 className="text-4xl font-black text-white tracking-tighter leading-tight mb-2 truncate">{client.name}</h2>
                  <a href={`tel:${client.phone}`} className="inline-flex items-center gap-2 text-blue-400 font-black uppercase tracking-widest text-xs hover:text-blue-300 transition-colors group">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 group-hover:scale-110 transition-transform">
                        <Phone className="h-3.5 w-3.5" />
                    </div>
                    {client.phone}
                  </a>
                </div>
                <div className="h-20 w-20 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-500 font-black text-3xl shadow-inner backdrop-blur-sm shrink-0">
                  {client.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div className="space-y-5 relative z-10">
                <div className="bg-white/5 p-5 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner">
                    <div className="flex gap-4 items-start mb-4">
                    <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <span className="font-bold text-zinc-200 leading-snug text-sm pt-1">{fullAddress}</span>
                    </div>
                    <div className="flex gap-6 items-center border-t border-white/5 pt-4 mt-1">
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Total Jobs</p>
                            <p className="text-lg font-black text-white leading-none tabular-nums">{totalJobs}</p>
                        </div>
                        <div className="w-px h-8 bg-white/5" />
                        <div className="space-y-1">
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">LTV Revenue</p>
                            <p className="text-lg font-black text-emerald-400 leading-none tabular-nums">{formatCurrency(totalRevenueCents / 100)}</p>
                        </div>
                    </div>
                </div>

                {client.notes && (
                    <div className="bg-amber-500/5 p-4 rounded-2xl border border-amber-500/10 text-amber-200/80 text-xs font-medium leading-relaxed backdrop-blur-sm relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-1 bg-amber-500/30 h-full" />
                        <span className="font-black block text-[9px] uppercase tracking-widest mb-1.5 text-amber-400/80">PRIVATE NOTES</span>
                        &ldquo;{client.notes}&rdquo;
                    </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8 relative z-10">
                <Button className="h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-600/20 active:scale-95 transition-all border-none" onClick={() => window.open(`tel:${client.phone}`)}>
                  <Phone className="h-4 w-4 mr-2" /> CALL NOW
                </Button>
                <Button
                  variant="outline"
                  className="h-14 rounded-2xl bg-white/5 border-white/10 text-emerald-400 hover:bg-emerald-600/10 font-black uppercase tracking-widest text-[10px] shadow-xl active:scale-95 transition-all"
                  onClick={() => {
                    const phone = (client.phone ?? "").replace(/\D/g, "");
                    if (phone) window.open(`https://wa.me/${phone}`, "_blank");
                  }}
                >
                  WHATSAPP
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Transaction History ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="px-1 mt-4">
        {/* Tab row */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto no-scrollbar pb-1 px-1">
          {(["all", "invoices", "jobs"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setTxTab(tab)}
              className={`px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap transition-all border ${
                txTab === tab
                  ? "bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-600/25 scale-105 z-10"
                  : "bg-white/5 text-zinc-400 border-white/5 hover:border-white/10 hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`ml-auto h-10 w-10 rounded-full flex items-center justify-center border transition-all ${
              showFilters || txSearch || txDateFrom || txDateTo
                ? "bg-blue-600/20 border-blue-500/50 text-blue-400 shadow-lg"
                : "bg-white/5 border-white/10 text-zinc-500 hover:text-white"
            }`}
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        {/* Collapsible filters */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden mb-6 space-y-4 px-1"
            >
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-blue-400 transition-colors z-10" />
                <Input
                  placeholder="Search by invoice # or service..."
                  className="pl-11 rounded-xl h-11 text-sm bg-white/5 border-white/10 text-white placeholder:text-zinc-600 focus:border-blue-500/50 font-bold"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1">From</p>
                  <Input type="date" className="rounded-xl h-11 text-xs bg-white/5 border-white/10 text-white appearance-none px-3 font-bold" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[9px] text-zinc-500 font-black uppercase tracking-[0.2em] ml-1">To</p>
                  <Input type="date" className="rounded-xl h-11 text-xs bg-white/5 border-white/10 text-white appearance-none px-3 font-bold" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} />
                </div>
              </div>
              {(txSearch || txDateFrom || txDateTo) && (
                <button
                  type="button"
                  onClick={() => { setTxSearch(""); setTxDateFrom(""); setTxDateTo(""); }}
                  className="text-[10px] text-rose-400 font-black uppercase tracking-widest bg-rose-400/10 px-3 py-1.5 rounded-lg border border-rose-400/20 active:scale-95 transition-transform"
                >
                  Clear all filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grouped list */}
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {Object.keys(transactions).length > 0 ? (
              Object.entries(transactions).map(([month, rows], groupIdx) => {
                const isCollapsed = collapsedMonths.has(month);
                const monthTotal = rows.reduce((s, r) => {
                  if (r.kind === "invoice") {
                    const inv = r.data as InvoiceRow;
                    return s + (inv.total_cents ?? inv.amount ?? 0) / 100;
                  }
                  return s + ((r.data as BookingRow).amount ?? 0) / 100;
                }, 0);

                return (
                  <motion.div
                    key={month}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 + groupIdx * 0.04 }}
                    className="space-y-3"
                  >
                    {/* Month header */}
                    <button type="button" onClick={() => toggleMonth(month)} className="w-full flex items-center justify-between px-2 group py-1">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] group-hover:text-white transition-colors">{month}</h3>
                      </div>
                      <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                        {formatCurrency(monthTotal)}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-4 px-1"
                        >
                          {rows.map((r) => {
                            if (r.kind === "invoice") {
                              const inv = r.data as InvoiceRow;
                              const isPaid = ["paid_cash", "paid_qr"].includes(inv.status);
                              const statusLabel = isPaid ? "PAID" : inv.status === "void" ? "VOID" : inv.status?.toUpperCase() ?? "PENDING";
                              const statusVariant: "success" | "danger" | "warning" = isPaid ? "success" : inv.status === "void" ? "danger" : "warning";

                              return (
                                <Card
                                  key={`inv-${inv.id}`}
                                  variant="premium"
                                  className="active:scale-[0.98] transition-all cursor-pointer hover:border-blue-500/40 rounded-2xl group shadow-lg backdrop-blur-xl"
                                  onClick={() => push(`/dashboard/invoices/${inv.id}`)}
                                >
                                  <CardContent className="p-4 flex justify-between items-center relative z-10">
                                    <div className="flex items-center gap-4">
                                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-inner border backdrop-blur-sm ${
                                        isPaid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                          : inv.status === "void" ? "bg-rose-500/10 border-rose-400/20 text-rose-400"
                                          : "bg-amber-500/10 border-amber-400/20 text-amber-400"
                                      }`}>
                                        {isPaid ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                      </div>
                                      <div className="overflow-hidden">
                                        <p className="font-black text-white text-sm truncate tracking-tight">{inv.invoice_number ?? "Invoice"}</p>
                                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                                          {inv.paid_at ? format(new Date(inv.paid_at), "d MMM yyyy") : inv.created_at ? format(new Date(inv.created_at), "d MMM yyyy") : "No date"}
                                          {inv.payment_method && isPaid ? ` · ${inv.payment_method === "cash" || inv.payment_method === "mixed" ? "Cash" : "PayNow"}` : ""}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                      <div>
                                        <span className="font-black block text-white tracking-tight">{formatCurrency((inv.total_cents ?? inv.amount ?? 0) / 100)}</span>
                                        <Badge variant={statusVariant} className="mt-1 text-[9px] font-black uppercase tracking-widest h-5 px-1.5 rounded-md">{statusLabel}</Badge>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors" />
                                    </div>
                                  </CardContent>
                                </Card>
                              );
                            }

                            // Job row
                            const job = r.data as BookingRow;
                            const isComplete = job.status === "completed";
                            const jobLabel = job.status === "completed" ? "COMPLETED" : job.status === "cancelled" ? "CANCELLED" : job.status?.toUpperCase() ?? "PENDING";
                            const jobVariant: "success" | "danger" | "warning" = isComplete ? "success" : job.status === "cancelled" ? "danger" : "warning";

                            return (
                              <Card
                                key={`job-${job.id}`}
                                variant="premium"
                                className="transition-all rounded-2xl group border-l-4 border-l-transparent hover:border-l-blue-500 shadow-lg backdrop-blur-xl"
                              >
                                <CardContent className="p-4 flex justify-between items-center relative z-10">
                                  <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-xl flex items-center justify-center border bg-white/5 border-white/10 text-blue-400 shadow-inner group-hover:bg-blue-600/10 transition-colors backdrop-blur-sm">
                                      <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="overflow-hidden">
                                      <p className="font-black text-white text-sm truncate tracking-tight">{job.service_type ?? "Service"}</p>
                                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                                        {job.scheduled_date ? format(new Date(job.scheduled_date + "T00:00:00"), "d MMM yyyy") : "No date"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-black block text-white tracking-tight">{formatCurrency((job.amount ?? 0) / 100)}</span>
                                    <Badge variant={jobVariant} className="mt-1 text-[9px] font-black uppercase tracking-widest h-5 px-1.5 rounded-md">{jobLabel}</Badge>
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
              <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/5 border-dashed backdrop-blur-md">
                <div className="bg-white/5 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5">
                    <FileText className="h-8 w-8 text-zinc-700" />
                </div>
                <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">
                  {txSearch || txDateFrom || txDateTo ? "No matches found" : "No history yet"}
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default function ClientDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pt-4 pb-24 px-2">
          <div className="flex items-center gap-3">
            <SkeletonCircle size={40} />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="50%" className="h-7" />
              <SkeletonLine width="30%" className="h-4" />
            </div>
          </div>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <ClientDetails />
    </Suspense>
  );
}
