"use client";

import { useState, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Phone, MapPin, Wrench, History, Calendar, FileText, Pencil, Trash2, X } from "lucide-react";
import { SkeletonCard, SkeletonLine, SkeletonCircle } from "@/components/ui/skeleton";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";

function ClientDetails() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("id") ?? "";
  const { push } = useRouter();

  const { data: client, isLoading, isError, refetch } = api.clients.getById.useQuery(
    { clientId },
    { enabled: !!clientId },
  );

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", address: "", notes: "" });

  // Delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateMutation = api.clients.update.useMutation({
    onSuccess: () => {
      toast.success("Client updated");
      setEditing(false);
      refetch();
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
      notes: editForm.notes,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate({ clientId });
  };

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
        {/* Back + name header */}
        <div className="flex items-center gap-3">
          <SkeletonCircle size={40} />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="50%" className="h-7" />
            <SkeletonLine width="30%" className="h-4" />
          </div>
        </div>
        {/* Contact + details card */}
        <SkeletonCard />
        {/* History list */}
        <SkeletonCard />
      </div>
    );
  }

  const fullAddress = client.address || "No address provided";
  const bookings = client.bookings ?? [];

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
          <Button
            variant="ghost"
            size="icon"
            onClick={startEdit}
            className="rounded-full text-slate-300 hover:text-white hover:bg-white/10"
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            className="rounded-full text-slate-300 hover:text-red-400 hover:bg-red-500/10"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between"
        >
          <p className="text-red-300 text-sm font-semibold">Delete {client.name}? This cannot be undone.</p>
          <div className="flex gap-2 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              className="text-slate-300 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Edit Form */}
      {editing ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
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
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Phone</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Address</label>
                  <Input
                    value={editForm.address}
                    onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Notes</label>
                  <Textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="mt-1 min-h-[80px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setEditing(false)}
                  className="flex-1 h-12 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveEdit}
                  disabled={updateMutation.isPending}
                  className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        /* Profile Card (view mode) */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
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
                  <span>Jobs: <span className="font-bold text-white">{client.stats?.totalJobs ?? 0}</span> &middot; Revenue: <span className="font-bold text-white">{formatCurrency((client.stats?.totalRevenueCents ?? 0) / 100)}</span></span>
                </div>
              </div>

              {client.notes && (
                <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-400/25 text-amber-100 mt-4 backdrop-blur-sm">
                  <span className="font-bold block text-xs uppercase tracking-wider mb-1 text-amber-300">Notes</span>
                  {client.notes}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-6">
                <Button
                  className="w-full gap-2 rounded-xl h-12 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700"
                  onClick={() => window.open(`tel:${client.phone}`)}
                >
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

      {/* History Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4 px-2">
          <History className="h-5 w-5 text-slate-300" />
          <h3 className="font-bold text-white text-lg">Transaction History</h3>
        </div>

        <div className="space-y-3">
          {/* Invoices Section */}
          {(client.invoices ?? []).length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2">Invoices</p>
              {((client.invoices ?? []) as Array<{
                id: string;
                invoice_number?: string | null;
                status: string;
                paid_at?: string | null;
                created_at?: string | null;
                payment_method?: string | null;
                total_cents?: number | null;
                amount?: number | null;
              }>).map((inv, index) => {
                const isPaid = ['paid_cash', 'paid_qr'].includes(inv.status);
                const statusLabel = isPaid ? 'PAID' : inv.status === 'void' ? 'VOID' : inv.status?.toUpperCase() ?? 'PENDING';
                const statusVariant: "success" | "danger" | "warning" = isPaid ? "success" : inv.status === 'void' ? "danger" : "warning";

                return (
                  <motion.div
                    key={inv.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                  >
                    <Card className="group hover:bg-white/[0.07] transition-all rounded-2xl cursor-pointer">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="bg-emerald-500/10 border border-emerald-400/20 p-3 rounded-xl text-emerald-300 group-hover:bg-emerald-500/20 transition-colors backdrop-blur-sm">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm md:text-base">{inv.invoice_number ?? 'Invoice'}</p>
                            <p className="text-xs font-medium text-slate-400">
                              {inv.paid_at ? format(new Date(inv.paid_at), "dd MMM yyyy") : inv.created_at ? format(new Date(inv.created_at), "dd MMM yyyy") : "No date"}
                              {inv.payment_method && isPaid ? ` · ${inv.payment_method === 'cash' || inv.payment_method === 'mixed' ? 'Cash' : 'PayNow'}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold block text-white">{formatCurrency((inv.total_cents ?? inv.amount ?? 0) / 100)}</span>
                          <Badge variant={statusVariant} className="mt-1 text-[10px] h-5 px-1.5">{statusLabel}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </>
          )}

          {/* Jobs Section */}
          {bookings.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 px-2 mt-4">Jobs</p>
              {(bookings as Array<{
                id: string;
                status: string;
                service_type?: string | null;
                scheduled_date?: string | null;
                amount?: number | null;
              }>).map((item, index) => {
                const isPaid = item.status === "completed";
                const statusLabel = item.status === "completed" ? "COMPLETED" : item.status === "cancelled" ? "CANCELLED" : item.status?.toUpperCase() ?? "PENDING";
                const statusVariant: "success" | "danger" | "warning" = isPaid ? "success" : item.status === "cancelled" ? "danger" : "warning";

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.08 }}
                  >
                    <Card className="group hover:bg-white/[0.07] transition-all rounded-2xl cursor-pointer">
                      <CardContent className="p-4 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <div className="bg-white/[0.06] border border-white/10 p-3 rounded-xl text-slate-300 group-hover:bg-blue-500/15 group-hover:text-blue-200 group-hover:border-blue-400/25 transition-colors backdrop-blur-sm">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-sm md:text-base">{item.service_type ?? "Service"}</p>
                            <p className="text-xs font-medium text-slate-400">
                              {item.scheduled_date ? format(new Date(item.scheduled_date + "T00:00:00"), "dd MMM yyyy") : "No date"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-bold block text-white">{formatCurrency((item.amount ?? 0) / 100)}</span>
                          <Badge variant={statusVariant} className="mt-1 text-[10px] h-5 px-1.5">{statusLabel}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </>
          )}

          {bookings.length === 0 && (client.invoices ?? []).length === 0 && (
            <div className="text-center py-8 glass-card glass-inner-light rounded-2xl">
              <p className="text-slate-400 font-medium">No transaction history yet</p>
            </div>
          )}
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
