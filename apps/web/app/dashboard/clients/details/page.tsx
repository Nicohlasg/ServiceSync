"use client";

import { useState, Suspense, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Phone, MapPin, Wrench, Calendar, FileText, Pencil,
  Trash2, X, ChevronDown, CheckCircle2, Clock, Search, Filter,
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

  const { data: client, isLoading, isError, refetch } = api.clients.getById.useQuery(
    { clientId },
    { enabled: !!clientId },
  );

  // ── Edit state ──
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", phone: "", address: "",
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
      lat: editForm.lat ?? undefined,
      lng: editForm.lng ?? undefined,
      notes: editForm.notes,
    });
  };

  // ── Loading / Error states ──
  if (isLoading || !client) {
    if (isError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
          <p className="text-red-400 font-medium">Failed to load client details.</p>
          <Button variant="outline" onClick={() => refetch()} className="border-red-500/30 text-red-400 hover:bg-red-500/10">
            Try Again
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-6 pt-4 pb-24">
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

  // ── Computed data ──
  const fullAddress = client.address || "No address provided";
  const bookings = (client.bookings ?? []) as BookingRow[];
  const invoices = (client.invoices ?? []) as InvoiceRow[];

  // Fix: count ALL non-cancelled jobs, not just "completed"
  const totalJobs = bookings.filter(b => b.status !== "cancelled").length;
  const totalRevenueCents = client.stats?.totalRevenueCents ?? 0;

  // ── Build unified, filtered, grouped transaction list ──
  const transactions = useMemo(() => {
    const rows: TransactionRow[] = [];

    if (txTab === "all" || txTab === "invoices") {
      invoices.forEach(inv => {
        rows.push({
          kind: "invoice",
          date: inv.paid_at ?? inv.created_at ?? new Date().toISOString(),
          data: inv,
        });
      });
    }
    if (txTab === "all" || txTab === "jobs") {
      bookings.forEach(b => {
        rows.push({
          kind: "job",
          date: b.scheduled_date ? b.scheduled_date + "T00:00:00" : new Date().toISOString(),
          data: b,
        });
      });
    }

    // Search filter
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
      // Date range
      const d = new Date(r.date);
      if (txDateFrom && d < new Date(txDateFrom + "T00:00:00")) return false;
      if (txDateTo && d > new Date(txDateTo + "T23:59:59")) return false;
      return true;
    });

    // Sort newest first
    filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Group by month
    const groups: Record<string, TransactionRow[]> = {};
    filtered.forEach(r => {
      let d = new Date(r.date);
      if (isNaN(d.getTime())) d = new Date();
      const monthKey = format(d, "MMMM yyyy");
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(r);
    });

    return groups;
  }, [invoices, bookings, txTab, txSearch, txDateFrom, txDateTo]);

  return (
    <div className="space-y-6 pt-4 pb-24">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard/clients" />
          <h1 className="text-xl font-bold text-white">Client Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={startEdit} className="rounded-full text-slate-300 hover:text-white hover:bg-white/10">
            <Pencil className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} className="rounded-full text-slate-300 hover:text-red-400 hover:bg-red-500/10">
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
          <p className="text-red-300 text-sm font-semibold">Delete {client.name}? This cannot be undone.</p>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} className="text-slate-300 hover:text-white">Cancel</Button>
            <Button size="sm" onClick={() => deleteMutation.mutate({ clientId })} disabled={deleteMutation.isPending} className="bg-red-600 hover:bg-red-700 text-white">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Edit Form */}
      {editing ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-t-4 border-t-amber-400/70 rounded-3xl overflow-hidden">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-white">Edit Client</h2>
                <Button variant="ghost" size="icon" onClick={() => setEditing(false)} className="text-slate-400 hover:text-white hover:bg-white/10">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Name</label>
                  <Input value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Phone</label>
                  <Input value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="mt-1" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Address</label>
                  <AddressAutocomplete
                    value={editForm.address}
                    onChange={(addr, lat, lng) => setEditForm(prev => ({ ...prev, address: addr, lat, lng }))}
                    placeholder="Search address..."
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Notes</label>
                  <Textarea value={editForm.notes} onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))} className="mt-1 min-h-[80px]" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setEditing(false)} className="flex-1 h-12 rounded-xl">Cancel</Button>
                <Button onClick={saveEdit} disabled={updateMutation.isPending} className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Profile Card (view mode) */
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
          <Card className="border-t-4 border-t-blue-500 rounded-3xl overflow-hidden">
            <CardContent className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-3xl font-bold text-white tracking-tight">{client.name}</h2>
                  <a href={`tel:${client.phone}`} className="inline-flex items-center gap-2 text-blue-300 mt-1 font-semibold hover:text-blue-200 hover:underline">
                    <Phone className="h-4 w-4" />
                    {client.phone}
                  </a>
                </div>
                <div className="h-16 w-16 rounded-2xl bg-blue-500/15 border border-blue-400/25 flex items-center justify-center text-blue-200 font-bold text-2xl shadow-inner backdrop-blur-sm">
                  {client.name.charAt(0)}
                </div>
              </div>

              <div className="space-y-4 text-sm text-slate-300 bg-white/[0.04] p-4 rounded-2xl border border-white/10">
                <div className="flex gap-3 items-start">
                  <MapPin className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="font-medium leading-relaxed">{fullAddress}</span>
                </div>
                <div className="flex gap-3 items-center">
                  <Wrench className="h-5 w-5 text-slate-400 shrink-0" />
                  <span>Jobs: <span className="font-bold text-white">{totalJobs}</span> &middot; Revenue: <span className="font-bold text-white">{formatCurrency(totalRevenueCents / 100)}</span></span>
                </div>
              </div>

              {client.notes && (
                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-400/25 text-amber-100 mt-4 backdrop-blur-sm">
                  <span className="font-bold block text-xs uppercase tracking-wider mb-1 text-amber-300">Notes</span>
                  {client.notes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button className="w-full gap-2 rounded-xl h-12 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700" onClick={() => window.open(`tel:${client.phone}`)}>
                  <Phone className="h-4 w-4" /> Call
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-emerald-300 border-emerald-400/30 bg-emerald-500/10 hover:bg-emerald-500/20 hover:text-emerald-200 rounded-xl h-12"
                  onClick={() => {
                    const phone = (client.phone ?? "").replace(/\D/g, "");
                    if (phone) window.open(`https://wa.me/${phone}`, "_blank");
                  }}
                >
                  WhatsApp
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Transaction History (redesigned) ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        {/* Tab row */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto no-scrollbar">
          {(["all", "invoices", "jobs"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setTxTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all ${
                txTab === tab
                  ? "bg-white text-slate-900 shadow-lg scale-105"
                  : "bg-slate-900/40 text-slate-300 border border-white/10 hover:bg-slate-900/60"
              }`}
            >
              {tab}
            </button>
          ))}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`ml-auto px-3 py-2 rounded-full text-xs font-bold flex items-center gap-1 transition-colors ${
              showFilters || txSearch || txDateFrom || txDateTo
                ? "bg-blue-500/30 text-blue-300"
                : "text-slate-400 border border-white/10 hover:text-slate-200"
            }`}
          >
            <Filter className="h-3.5 w-3.5" /> Filters
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
              className="overflow-hidden mb-4 space-y-2"
            >
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by invoice # or service type..."
                  className="pl-9 rounded-xl h-10 text-sm"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">From</p>
                  <Input type="date" className="rounded-xl h-10 text-sm w-full min-w-0 px-3" value={txDateFrom} onChange={(e) => setTxDateFrom(e.target.value)} />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">To</p>
                  <Input type="date" className="rounded-xl h-10 text-sm w-full min-w-0 px-3" value={txDateTo} onChange={(e) => setTxDateTo(e.target.value)} />
                </div>
              </div>
              {(txSearch || txDateFrom || txDateTo) && (
                <button
                  type="button"
                  onClick={() => { setTxSearch(""); setTxDateFrom(""); setTxDateTo(""); }}
                  className="text-xs text-red-400 font-semibold"
                >
                  Clear filters
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grouped list */}
        <div className="space-y-4">
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
                  >
                    {/* Month header */}
                    <button type="button" onClick={() => toggleMonth(month)} className="w-full flex items-center justify-between px-2 mb-2 group">
                      <div className="flex items-center gap-2">
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">{month}</h3>
                      </div>
                      <span className="text-xs text-slate-400 font-semibold">
                        {rows.length} item{rows.length !== 1 ? "s" : ""} · {formatCurrency(monthTotal)}
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden space-y-3"
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
                                  className="active:scale-[0.98] transition-all cursor-pointer hover:bg-white/[0.07] rounded-2xl group border-l-4 border-l-transparent hover:border-l-emerald-500"
                                  onClick={() => push(`/dashboard/invoices/${inv.id}`)}
                                >
                                  <CardContent className="p-4 flex justify-between items-center">
                                    <div className="flex items-center gap-4">
                                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shadow-inner border backdrop-blur-sm ${
                                        isPaid ? "bg-emerald-500/15 border-emerald-400/25 text-emerald-300"
                                          : inv.status === "void" ? "bg-red-500/15 border-red-400/25 text-red-300"
                                          : "bg-amber-500/15 border-amber-400/25 text-amber-300"
                                      }`}>
                                        {isPaid ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                                      </div>
                                      <div>
                                        <p className="font-bold text-white text-sm">{inv.invoice_number ?? "Invoice"}</p>
                                        <p className="text-xs font-medium text-slate-400">
                                          {inv.paid_at ? format(new Date(inv.paid_at), "dd MMM yyyy") : inv.created_at ? format(new Date(inv.created_at), "dd MMM yyyy") : "No date"}
                                          {inv.payment_method && isPaid ? ` · ${inv.payment_method === "cash" || inv.payment_method === "mixed" ? "Cash" : "PayNow"}` : ""}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <span className="font-bold block text-white">{formatCurrency((inv.total_cents ?? inv.amount ?? 0) / 100)}</span>
                                      <Badge variant={statusVariant} className="mt-1 text-[10px] h-5 px-1.5">{statusLabel}</Badge>
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
                                className="hover:bg-white/[0.07] transition-all rounded-2xl group border-l-4 border-l-transparent hover:border-l-blue-500"
                              >
                                <CardContent className="p-4 flex justify-between items-center">
                                  <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-xl flex items-center justify-center border bg-white/[0.06] border-white/10 text-slate-300 group-hover:bg-blue-500/15 group-hover:text-blue-200 group-hover:border-blue-400/25 transition-colors backdrop-blur-sm">
                                      <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-white text-sm">{job.service_type ?? "Service"}</p>
                                      <p className="text-xs font-medium text-slate-400">
                                        {job.scheduled_date ? format(new Date(job.scheduled_date + "T00:00:00"), "dd MMM yyyy") : "No date"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold block text-white">{formatCurrency((job.amount ?? 0) / 100)}</span>
                                    <Badge variant={jobVariant} className="mt-1 text-[10px] h-5 px-1.5">{jobLabel}</Badge>
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
              <div className="text-center py-8 glass-card glass-inner-light rounded-2xl">
                <p className="text-slate-400 font-medium">
                  {txSearch || txDateFrom || txDateTo ? "No transactions match your filters" : "No transaction history yet"}
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
        <div className="space-y-6 pt-4 pb-24">
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
