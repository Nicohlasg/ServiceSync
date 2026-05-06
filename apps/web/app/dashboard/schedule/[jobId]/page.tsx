"use client";
import { useState, useRef, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, CheckSquare, Square, Trash2, Plus, Loader2,
  CheckCircle2, X, Receipt, Package, MessageCircle,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { openWhatsAppWithOnMyWay } from "@/lib/whatsapp-helpers";
import { SkeletonCard } from "@/components/ui/skeleton";
import Link from "next/link";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
function photoUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/job-photos/${path}`;
}

function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>();
  const { push } = useRouter();

  const { data, isLoading, isError, refetch } = api.jobs.getDetail.useQuery(
    { bookingId: jobId },
    { enabled: !!jobId, staleTime: 30_000 }
  );

  const [newItem, setNewItem] = useState("");
  const [expenseLabel, setExpenseLabel] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'parts' | 'fuel' | 'labour' | 'other'>('parts');
  const [uploadingType, setUploadingType] = useState<"before" | "after" | null>(null);
  const [stockItemId, setStockItemId] = useState('');
  const [stockQty, setStockQty] = useState('');
  const beforeInputRef = useRef<HTMLInputElement>(null);
  const afterInputRef = useRef<HTMLInputElement>(null);

  const completeJobMutation = api.jobs.completeJob.useMutation({
    onSuccess: () => { toast.success("Job marked as complete!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const addPhotoMutation = api.jobs.addPhoto.useMutation({
    onSuccess: () => { refetch(); setUploadingType(null); },
    onError: (err) => { toast.error(err.message); setUploadingType(null); },
  });

  const deletePhotoMutation = api.jobs.deletePhoto.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });

  const addItemMutation = api.jobs.addChecklistItem.useMutation({
    onSuccess: () => { refetch(); setNewItem(""); },
    onError: (err) => toast.error(err.message),
  });

  const toggleItemMutation = api.jobs.toggleChecklistItem.useMutation({
    onSuccess: () => refetch(),
  });

  const deleteItemMutation = api.jobs.deleteChecklistItem.useMutation({
    onSuccess: () => refetch(),
    onError: (err) => toast.error(err.message),
  });

  const { data: expenses = [], refetch: refetchExpenses } = api.expenses.listForBooking.useQuery(
    { bookingId: jobId },
    { enabled: !!jobId, staleTime: 30_000 }
  );

  const addExpenseMutation = api.expenses.add.useMutation({
    onSuccess: () => { refetchExpenses(); setExpenseLabel(''); setExpenseAmount(''); },
    onError: (err) => toast.error(err.message),
  });

  const deleteExpenseMutation = api.expenses.delete.useMutation({
    onSuccess: () => refetchExpenses(),
    onError: (err) => toast.error(err.message),
  });

  const { data: inventoryItems = [] } = api.inventory.list.useQuery({}, { staleTime: 60_000 });
  const { data: jobStockUsed = [], refetch: refetchStock } = api.inventory.transactionsForBooking.useQuery(
    { bookingId: jobId },
    { enabled: !!jobId, staleTime: 30_000 }
  );
  const stockOutMutation = api.inventory.stockOut.useMutation({
    onSuccess: (res) => {
      toast.success(`Stock recorded — ${res.newQuantity} remaining`);
      refetchStock();
      refetch();
      setStockItemId('');
      setStockQty('');
    },
    onError: (err) => toast.error(err.message),
  });

  async function handlePhotoUpload(file: File, photoType: "before" | "after") {
    setUploadingType(photoType);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not logged in"); return; }

      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/${jobId}/${photoType}_${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("job-photos")
        .upload(path, file, { cacheControl: "3600", upsert: true });

      if (uploadErr) { toast.error("Upload failed: " + uploadErr.message); return; }

      await addPhotoMutation.mutateAsync({ bookingId: jobId, storagePath: path, photoType });
    } catch {
      toast.error("Upload failed");
      setUploadingType(null);
    }
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-white">
        <p className="text-rose-400 font-black uppercase tracking-widest text-xs">Job not found</p>
        <Button
          variant="outline"
          onClick={() => push("/dashboard/schedule")}
          className="border-white/10 bg-white/5 text-white rounded-xl font-black uppercase tracking-widest text-[10px]"
        >
          Back to Schedule
        </Button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6 pt-4 pb-24 px-1">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const { booking, photos, checklist } = data;
  const client = (booking as any).clients;
  const isCompleted = (booking as any).status === "completed";
  const beforePhoto = photos.find((p) => p.photo_type === "before");
  const afterPhoto = photos.find((p) => p.photo_type === "after");
  const checkedCount = checklist.filter((i) => i.is_checked).length;
  const totalExpenseCents = expenses.reduce((s: number, e: any) => s + (e.amount_cents ?? 0), 0);
  const revenueAmount = (data?.booking as any)?.amount ?? 0;
  const profitCents = revenueAmount - totalExpenseCents;

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-1"
      >
        <BackButton href="/dashboard/schedule" />
        <div>
          <h1 className="text-xl font-black text-white tracking-tight leading-none">Job Report</h1>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
            {client?.name ?? "Client"}
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="px-1"
      >
        <Card variant="premium" className="rounded-2xl backdrop-blur-2xl">
          <CardContent className="p-5 relative z-10">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-lg tracking-tight truncate">
                  {(booking as any).service_type}
                </p>
                <p className="text-xs font-black text-blue-400 uppercase tracking-widest mt-1">
                  {client?.name}
                </p>
                {(booking as any).scheduled_date && (
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
                    {format(new Date((booking as any).scheduled_date + "T00:00:00"), "d MMM yyyy")}
                  </p>
                )}
              </div>
              <div
                className={`shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                  isCompleted
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                }`}
              >
                {isCompleted ? "Completed" : "Upcoming"}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* On My Way quick action */}
      {!isCompleted && client?.phone && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="px-1"
        >
          <Button
            className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 border border-indigo-400/30 shadow-lg shadow-indigo-500/20"
            onClick={() => openWhatsAppWithOnMyWay(
              client.phone,
              client.name ?? (booking as any).client_name,
              (booking as any).service_type,
              '~20 minutes',
            )}
          >
            <MessageCircle className="h-4 w-4" />
            On My Way
          </Button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-1 space-y-3"
      >
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Camera className="h-3.5 w-3.5 text-blue-400" /> Before &amp; After Photos
        </p>

        <input
          ref={beforeInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhotoUpload(f, "before");
            e.target.value = "";
          }}
        />
        <input
          ref={afterInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handlePhotoUpload(f, "after");
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-2 gap-4">
          {(["before", "after"] as const).map((type) => {
            const photo = type === "before" ? beforePhoto : afterPhoto;
            const inputRef = type === "before" ? beforeInputRef : afterInputRef;
            const isUploading = uploadingType === type;

            return (
              <div key={type} className="space-y-2">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">
                  {type} photo
                </p>
                {photo ? (
                  <div className="relative group rounded-2xl overflow-hidden aspect-square bg-white/5 border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl(photo.storage_path)}
                      alt={`${type} photo`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => deletePhotoMutation.mutate({ photoId: photo.id })}
                      className="absolute top-2 right-2 h-7 w-7 rounded-full bg-rose-600/80 border border-rose-500/30 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        if (inputRef.current) {
                          inputRef.current.setAttribute("capture", "environment");
                          inputRef.current.click();
                        }
                      }}
                      className="absolute bottom-2 right-2 h-7 w-7 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (inputRef.current) {
                        inputRef.current.setAttribute("capture", "environment");
                        inputRef.current.click();
                      }
                    }}
                    disabled={isUploading}
                    className="w-full aspect-square rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-blue-500/30 transition-all active:scale-95"
                  >
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
                    ) : (
                      <>
                        <Camera className="h-6 w-6 text-zinc-600" />
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">
                          Tap to upload
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-1 space-y-3"
      >
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" /> Checklist
            {checklist.length > 0 && (
              <span className="text-zinc-600 font-black">
                {checkedCount}/{checklist.length}
              </span>
            )}
          </p>
        </div>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {checklist.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
              >
                <Card variant="premium" className="rounded-xl backdrop-blur-xl">
                  <CardContent className="p-3 flex items-center gap-3 relative z-10">
                    <button
                      onClick={() =>
                        toggleItemMutation.mutate({ itemId: item.id, isChecked: !item.is_checked })
                      }
                      className="shrink-0 text-zinc-500 hover:text-blue-400 transition-colors"
                    >
                      {item.is_checked ? (
                        <CheckSquare className="h-5 w-5 text-emerald-400" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                    <span
                      className={`flex-1 text-sm font-bold ${
                        item.is_checked ? "line-through text-zinc-600" : "text-white"
                      }`}
                    >
                      {item.label}
                    </span>
                    <button
                      onClick={() => deleteItemMutation.mutate({ itemId: item.id })}
                      className="shrink-0 text-zinc-700 hover:text-rose-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Add checklist item..."
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newItem.trim()) {
                e.preventDefault();
                addItemMutation.mutate({ bookingId: jobId, label: newItem.trim() });
              }
            }}
            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
          />
          <Button
            onClick={() => {
              if (newItem.trim()) addItemMutation.mutate({ bookingId: jobId, label: newItem.trim() });
            }}
            disabled={!newItem.trim() || addItemMutation.isPending}
            className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 p-0"
          >
            {addItemMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </div>
      </motion.div>

      {/* Expenses Section */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="px-1 space-y-3">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Receipt className="h-3.5 w-3.5 text-blue-400" /> Job Expenses
          {expenses.length > 0 && (
            <span className={`ml-auto font-black text-xs ${profitCents >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              Profit: {formatCurrency(profitCents / 100)}
            </span>
          )}
        </p>

        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {(expenses as any[]).map((exp: any) => {
              const catColors: Record<string, string> = {
                parts: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                fuel: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                labour: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
                other: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
              };
              return (
                <motion.div key={exp.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card variant="premium" className="rounded-xl backdrop-blur-xl">
                    <CardContent className="p-3 flex items-center gap-3 relative z-10">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border shrink-0 ${catColors[exp.category] ?? catColors.other}`}>
                        {exp.category}
                      </span>
                      <span className="flex-1 text-sm font-bold text-white truncate">{exp.label}</span>
                      <span className="font-black text-white shrink-0">{formatCurrency(exp.amount_cents / 100)}</span>
                      <button onClick={() => deleteExpenseMutation.mutate({ expenseId: exp.id })} className="text-zinc-700 hover:text-rose-400 transition-colors shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="flex gap-2">
          <Select value={expenseCategory} onValueChange={(v) => setExpenseCategory(v as 'parts' | 'fuel' | 'labour' | 'other')}>
            <SelectTrigger className="h-12 w-28 shrink-0 bg-white/5 border-white/10 rounded-xl text-zinc-400 font-black text-[10px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
              <SelectItem value="parts">Parts</SelectItem>
              <SelectItem value="fuel">Fuel</SelectItem>
              <SelectItem value="labour">Labour</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          <Input
            placeholder="e.g. R32 gas refill"
            value={expenseLabel}
            onChange={e => setExpenseLabel(e.target.value)}
            className="flex-1 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
          />
          <div className="relative w-24 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">$</span>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder="0"
              value={expenseAmount}
              onChange={e => setExpenseAmount(e.target.value)}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold pl-6"
            />
          </div>
          <Button
            onClick={() => {
              if (!expenseLabel.trim() || !expenseAmount) return;
              addExpenseMutation.mutate({
                bookingId: jobId,
                label: expenseLabel.trim(),
                amountCents: Math.round(parseFloat(expenseAmount) * 100),
                category: expenseCategory,
              });
            }}
            disabled={!expenseLabel.trim() || !expenseAmount || addExpenseMutation.isPending}
            className="h-12 w-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shrink-0 p-0"
          >
            {addExpenseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>

        {expenses.length > 0 && (
          <div className="flex justify-between items-center bg-white/5 rounded-xl px-4 py-3 border border-white/10">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Costs</span>
            <span className="font-black text-rose-400">{formatCurrency(totalExpenseCents / 100)}</span>
          </div>
        )}
      </motion.div>

      {/* Stock Used on This Job */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="px-1 space-y-3">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-violet-400" /> Stock Used
        </p>

        {/* Previously recorded stock usage for this job */}
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {(jobStockUsed as any[]).map((tx: any) => {
              const invItem = tx.inventory_items as any;
              return (
                <motion.div key={tx.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                  <Card variant="premium" className="rounded-xl backdrop-blur-xl">
                    <CardContent className="p-3 flex items-center gap-3 relative z-10">
                      <span className="text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border text-violet-400 bg-violet-500/10 border-violet-500/20 shrink-0">
                        {invItem?.category ?? 'stock'}
                      </span>
                      <span className="flex-1 text-sm font-bold text-white truncate">{invItem?.name ?? 'Item'}</span>
                      <span className="font-black text-rose-400 shrink-0">−{Math.abs(Number(tx.quantity))} {invItem?.unit ?? ''}</span>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Record new stock usage */}
        <div className="flex gap-2">
          <Select value={stockItemId} onValueChange={setStockItemId}>
            <SelectTrigger className="flex-1 h-12 bg-white/5 border-white/10 rounded-xl text-zinc-300 font-bold text-sm">
              <SelectValue placeholder="Select item used..." />
            </SelectTrigger>
            <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
              {(inventoryItems as any[]).map((item: any) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} ({Number(item.quantity_on_hand)} {item.unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative w-24 shrink-0">
            <Input
              type="number"
              min={0.01}
              step={0.01}
              placeholder="Qty"
              value={stockQty}
              onChange={e => setStockQty(e.target.value)}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
            />
          </div>
          <Button
            onClick={() => {
              if (!stockItemId || !stockQty) return;
              stockOutMutation.mutate({
                itemId: stockItemId,
                quantity: parseFloat(stockQty),
                bookingId: jobId,
                createExpense: true,
              });
            }}
            disabled={!stockItemId || !stockQty || stockOutMutation.isPending}
            className="h-12 w-12 rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0 p-0"
          >
            {stockOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>

        {(inventoryItems as any[]).length === 0 && (
          <p className="text-[10px] text-zinc-600 text-center py-2">
            No inventory items — <Link href="/dashboard/inventory/new" className="text-violet-400 underline">add items</Link> to track stock usage
          </p>
        )}
      </motion.div>

      {!isCompleted && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-1"
        >
          <Button
            className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-base shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all border-none"
            onClick={() => completeJobMutation.mutate({ bookingId: jobId })}
            disabled={completeJobMutation.isPending}
          >
            {completeJobMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Marking...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-6 w-6 mr-2" /> Mark Job Complete
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}

export default function JobDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 pt-4 pb-24 px-1">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      }
    >
      <JobDetail />
    </Suspense>
  );
}
