"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  Edit2, Package, MessageCircle, ChevronDown, ChevronUp,
  Loader2, Plus, Minus, AlignLeft
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  refrigerant: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  chemical: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  filter: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
  part: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  tool: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  consumable: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
  other: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
};

const CATEGORIES = [
  { value: 'chemical', label: 'Chemical' },
  { value: 'part', label: 'Parts & Tools' },
  { value: 'other', label: 'Others' },
] as const;

function getStockStatus(qty: number, minQty: number) {
  if (qty <= 0) return 'out';
  if (minQty > 0 && qty <= minQty) return 'low';
  if (minQty > 0 && qty <= minQty * 2) return 'warn';
  return 'ok';
}

const STOCK_COLORS = {
  out: 'text-rose-400',
  low: 'text-amber-400',
  warn: 'text-yellow-400',
  ok: 'text-emerald-400',
};

const STOCK_LABELS = {
  out: 'Out of Stock',
  low: 'Low Stock',
  warn: 'Running Low',
  ok: 'In Stock',
};

const STOCK_BADGE_COLORS = {
  out: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  low: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  warn: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  ok: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
};

export default function InventoryItemPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const router = useRouter();

  // Active action form: 'stockIn' | 'stockOut' | 'adjust' | 'edit' | null
  const [activeForm, setActiveForm] = useState<'stockIn' | 'stockOut' | 'adjust' | 'edit' | null>(null);

  // Stock In form state
  const [stockInQty, setStockInQty] = useState('');
  const [stockInCost, setStockInCost] = useState('');
  const [stockInNotes, setStockInNotes] = useState('');

  // Stock Out form state
  const [stockOutQty, setStockOutQty] = useState('');
  const [stockOutNotes, setStockOutNotes] = useState('');

  // Adjust form state
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Edit form state
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editMinQty, setEditMinQty] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editSupplierContact, setEditSupplierContact] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // History collapsed
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const { data, isLoading, isError, refetch } = api.inventory.getById.useQuery(
    { itemId },
    { enabled: !!itemId, staleTime: 30_000 }
  );

  const stockInMutation = api.inventory.stockIn.useMutation({
    onSuccess: (res) => {
      const item = data?.item as any;
      toast.success(`Stock added — now have ${res.newQuantity} ${item?.unit ?? ''}`);
      refetch();
      setActiveForm(null);
      setStockInQty(''); setStockInCost(''); setStockInNotes('');
    },
    onError: (err) => toast.error(err.message),
  });

  const stockOutMutation = api.inventory.stockOut.useMutation({
    onSuccess: (res) => {
      const item = data?.item as any;
      toast.success(`${stockOutQty} ${item?.unit ?? ''} recorded as used`);
      refetch();
      setActiveForm(null);
      setStockOutQty(''); setStockOutNotes('');
    },
    onError: (err) => toast.error(err.message),
  });

  const adjustMutation = api.inventory.adjust.useMutation({
    onSuccess: () => {
      toast.success('Stock count saved');
      refetch();
      setActiveForm(null);
      setAdjustQty(''); setAdjustNotes('');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.inventory.update.useMutation({
    onSuccess: () => {
      toast.success('Item updated');
      refetch();
      setActiveForm(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = api.inventory.archive.useMutation({
    onSuccess: () => {
      toast.success('Item archived');
      router.push('/dashboard/inventory');
    },
    onError: (err) => toast.error(err.message),
  });

  const openEdit = () => {
    const item = data?.item as any;
    if (!item) return;
    setEditName(item.name ?? '');
    setEditCategory(item.category ?? '');
    setEditUnit(item.unit ?? '');
    setEditMinQty(String(item.min_quantity ?? 0));
    setEditCost(String((item.unit_cost_cents ?? 0) / 100));
    setEditSupplierName(item.supplier_name ?? '');
    setEditSupplierContact(item.supplier_contact ?? '');
    setEditNotes(item.notes ?? '');
    setActiveForm('edit');
  };

  const openAdjust = () => {
    const item = data?.item as any;
    if (!item) return;
    setAdjustQty(String(item.quantity_on_hand ?? 0));
    setActiveForm('adjust');
  };

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-white">
        <p className="text-rose-400 font-black uppercase tracking-widest text-xs">Item not found</p>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/inventory')}
          className="border-white/10 bg-white/5 text-white rounded-xl font-black uppercase tracking-widest text-[10px]"
        >
          Back to Inventory
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

  const item = data.item as any;
  const transactions = data.transactions as any[];
  const qty = Number(item.quantity_on_hand);
  const minQty = Number(item.min_quantity);
  const status = getStockStatus(qty, minQty);
  const catColor = CATEGORY_COLORS[item.category] ?? CATEGORY_COLORS.other;
  const visibleTxns = historyExpanded ? transactions : transactions.slice(0, 5);

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-1"
      >
        <BackButton href="/dashboard/inventory" />
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-white tracking-tight leading-none truncate">{item.name}</h1>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${catColor}`}>
            {item.category}
          </span>
        </div>
        <button
          onClick={openEdit}
          className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
        >
          <Edit2 className="h-4 w-4" />
        </button>
      </motion.div>

      {/* Hero stock display */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="px-1"
      >
        <Card variant="premium" className="rounded-2xl backdrop-blur-2xl">
          <CardContent className="p-6 relative z-10 flex flex-col items-center gap-2">
            <span className={`text-6xl font-black leading-none ${STOCK_COLORS[status]}`}>{qty}</span>
            <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">{item.unit}</span>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${STOCK_BADGE_COLORS[status]}`}>
              {STOCK_LABELS[status]}
            </span>
            {minQty > 0 && (
              <p className="text-xs text-zinc-500 mt-1">
                Reorder at {minQty} {item.unit}
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-1 space-y-3"
      >
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setActiveForm(activeForm === 'stockIn' ? null : 'stockIn')}
            className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Stock
          </Button>
          <Button
            onClick={() => setActiveForm(activeForm === 'stockOut' ? null : 'stockOut')}
            className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-white"
          >
            <Minus className="h-4 w-4 mr-2" /> Record Usage
          </Button>
        </div>
        <button
          onClick={openAdjust}
          className="w-full text-xs font-black text-zinc-400 uppercase tracking-widest py-2 hover:text-white transition-colors"
        >
          Adjust Count
        </button>

        {/* Stock In Form */}
        <AnimatePresence>
          {activeForm === 'stockIn' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
                <CardContent className="p-4 relative z-10 space-y-3">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Add Stock</p>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder={`Quantity (${item.unit})`}
                    value={stockInQty}
                    onChange={(e) => setStockInQty(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">$</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder={`Cost per unit (optional, current: ${formatCurrency((item.unit_cost_cents ?? 0) / 100)})`}
                      value={stockInCost}
                      onChange={(e) => setStockInCost(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-xl font-bold pl-7 text-sm"
                    />
                  </div>
                  <Input
                    placeholder="Notes (optional)"
                    value={stockInNotes}
                    onChange={(e) => setStockInNotes(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (!stockInQty) return;
                        stockInMutation.mutate({
                          itemId,
                          quantity: parseFloat(stockInQty),
                          unitCostCents: stockInCost ? Math.round(parseFloat(stockInCost) * 100) : undefined,
                          notes: stockInNotes.trim() || undefined,
                        });
                      }}
                      disabled={!stockInQty || stockInMutation.isPending}
                      className="flex-1 h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-white"
                    >
                      {stockInMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Add Stock'}
                    </Button>
                    <Button
                      onClick={() => setActiveForm(null)}
                      variant="outline"
                      className="h-12 px-4 rounded-xl border-white/10 bg-white/5 text-zinc-400 font-black"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stock Out Form */}
        <AnimatePresence>
          {activeForm === 'stockOut' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
                <CardContent className="p-4 relative z-10 space-y-3">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Record Usage</p>
                  <p className="text-sm font-black text-zinc-400">How many used?</p>
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    placeholder={`Quantity (${item.unit})`}
                    value={stockOutQty}
                    onChange={(e) => setStockOutQty(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                  />
                  <Input
                    placeholder="Notes (optional) — e.g. Job at Clementi"
                    value={stockOutNotes}
                    onChange={(e) => setStockOutNotes(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (!stockOutQty) return;
                        stockOutMutation.mutate({
                          itemId,
                          quantity: parseFloat(stockOutQty),
                          notes: stockOutNotes.trim() || undefined,
                        });
                      }}
                      disabled={!stockOutQty || stockOutMutation.isPending}
                      className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-white"
                    >
                      {stockOutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm Usage'}
                    </Button>
                    <Button
                      onClick={() => setActiveForm(null)}
                      variant="outline"
                      className="h-12 px-4 rounded-xl border-white/10 bg-white/5 text-zinc-400 font-black"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Adjust Form */}
        <AnimatePresence>
          {activeForm === 'adjust' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
                <CardContent className="p-4 relative z-10 space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Adjust Count</p>
                  <p className="text-sm font-black text-zinc-400">Actual count on hand:</p>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={adjustQty}
                      onChange={(e) => setAdjustQty(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold flex-1"
                    />
                    <span className="text-sm font-black text-zinc-400 uppercase shrink-0">{item.unit}</span>
                  </div>
                  <Input
                    placeholder="Notes (optional) — e.g. Stock count 6 May"
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (adjustQty === '') return;
                        adjustMutation.mutate({
                          itemId,
                          newQuantity: parseFloat(adjustQty),
                          notes: adjustNotes.trim() || undefined,
                        });
                      }}
                      disabled={adjustQty === '' || adjustMutation.isPending}
                      className="flex-1 h-12 rounded-xl bg-zinc-700 hover:bg-zinc-600 font-black text-white"
                    >
                      {adjustMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Count'}
                    </Button>
                    <Button
                      onClick={() => setActiveForm(null)}
                      variant="outline"
                      className="h-12 px-4 rounded-xl border-white/10 bg-white/5 text-zinc-400 font-black"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Item details card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="px-1"
      >
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Item Details</p>

            <div className="space-y-2 divide-y divide-white/5">
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-black text-zinc-500 uppercase tracking-wider">Category</span>
                <span className="text-sm font-bold text-white capitalize">{item.category}</span>
              </div>
              {Number(item.unit_cost_cents) > 0 && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-black text-zinc-500 uppercase tracking-wider">Cost / {item.unit}</span>
                  <span className="text-sm font-bold text-white">{formatCurrency(Number(item.unit_cost_cents) / 100)}</span>
                </div>
              )}
              {item.supplier_name && (
                <div className="flex items-center justify-between py-2">
                  <span className="text-xs font-black text-zinc-500 uppercase tracking-wider">Supplier</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{item.supplier_name}</span>
                    {item.supplier_contact && (
                      <a
                        href={`https://wa.me/${item.supplier_contact.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/20 transition-all"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
              {item.notes && (
                <div className="py-2">
                  <p className="text-xs font-black text-zinc-500 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm font-medium text-zinc-300">{item.notes}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Details Form */}
      <AnimatePresence>
        {activeForm === 'edit' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="px-1"
          >
            <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
              <CardContent className="p-5 relative z-10 space-y-4">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Edit Details</p>

                <div className="space-y-2">
                  <p className="text-xs font-black text-zinc-500">Name</p>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-zinc-500">Category</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setEditCategory(cat.value)}
                        className={`h-12 rounded-xl border flex items-center justify-center transition-all text-[10px] font-black uppercase tracking-wider px-1 ${
                          editCategory === cat.value
                            ? 'bg-white/15 border-white/30 text-white'
                            : 'bg-white/5 border-white/10 text-zinc-400'
                        }`}
                      >
                        <span className="text-center leading-tight">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-zinc-500">Unit</p>
                  <Input
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    placeholder="e.g. piece, kg, litre..."
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-xl font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-xs font-black text-zinc-500">Reorder at</p>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editMinQty}
                      onChange={(e) => setEditMinQty(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black text-zinc-500">Cost ($)</p>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white rounded-xl font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-zinc-500">Supplier Name</p>
                  <Input
                    value={editSupplierName}
                    onChange={(e) => setEditSupplierName(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                    placeholder="Supplier name"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-zinc-500">Supplier Phone</p>
                  <Input
                    type="tel"
                    value={editSupplierContact}
                    onChange={(e) => setEditSupplierContact(e.target.value)}
                    className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                    placeholder="Phone number"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-black text-zinc-500">Notes</p>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold p-3 text-sm resize-none outline-none focus:border-blue-500/50 transition-colors"
                    placeholder="Notes..."
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      updateMutation.mutate({
                        itemId,
                        name: editName.trim() || undefined,
                        category: editCategory as any || undefined,
                        unit: editUnit || undefined,
                        minQuantity: parseFloat(editMinQty) || 0,
                        unitCostCents: Math.round((parseFloat(editCost) || 0) * 100),
                        supplierName: editSupplierName.trim() || undefined,
                        supplierContact: editSupplierContact.trim() || undefined,
                        notes: editNotes.trim() || undefined,
                      });
                    }}
                    disabled={updateMutation.isPending}
                    className="flex-1 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-white"
                  >
                    {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                  </Button>
                  <Button
                    onClick={() => setActiveForm(null)}
                    variant="outline"
                    className="h-12 px-4 rounded-xl border-white/10 bg-white/5 text-zinc-400 font-black"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction History */}
      {transactions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="px-1 space-y-3"
        >
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <AlignLeft className="h-3.5 w-3.5 text-zinc-500" /> Stock History
            </p>
            {transactions.length > 5 && (
              <button
                onClick={() => setHistoryExpanded(!historyExpanded)}
                className="text-[10px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1 hover:text-white transition-colors"
              >
                {historyExpanded ? 'Less' : `+${transactions.length - 5} more`}
                {historyExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>

          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {visibleTxns.map((tx: any, i: number) => {
                const txQty = Number(tx.quantity);
                const isIn = txQty > 0;
                const isAdj = tx.type === 'adjustment';

                const txColor = isAdj
                  ? 'text-blue-400'
                  : tx.type === 'waste'
                  ? 'text-rose-400'
                  : isIn
                  ? 'text-emerald-400'
                  : 'text-rose-400';

                const txLabel = isAdj
                  ? `~ ${txQty > 0 ? '+' : ''}${txQty} ${item.unit}`
                  : tx.type === 'waste'
                  ? `waste ${Math.abs(txQty)} ${item.unit}`
                  : isIn
                  ? `+${txQty} ${item.unit}`
                  : `-${Math.abs(txQty)} ${item.unit}`;

                return (
                  <motion.div
                    key={tx.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <Card variant="premium" className="rounded-xl backdrop-blur-xl">
                      <CardContent className="p-3 relative z-10 flex items-center gap-3">
                        <span className="text-[10px] font-black text-zinc-600 w-12 shrink-0">
                          {format(new Date(tx.created_at), 'd MMM')}
                        </span>
                        <span className={`font-black text-sm shrink-0 ${txColor}`}>{txLabel}</span>
                        {tx.notes && (
                          <span className="flex-1 text-xs text-zinc-500 truncate">{tx.notes}</span>
                        )}
                        {Number(tx.unit_cost_cents) > 0 && (
                          <span className="text-xs font-bold text-zinc-600 shrink-0 ml-auto">
                            {formatCurrency((Number(tx.unit_cost_cents) * Math.abs(txQty)) / 100)}
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Archive button */}
      {item.status !== 'archived' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="px-1 pt-4 border-t border-white/5"
        >
          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3 px-1">Danger Zone</p>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(`Archive "${item.name}"? You can restore it later.`)) {
                archiveMutation.mutate({ itemId, archived: true });
              }
            }}
            disabled={archiveMutation.isPending}
            className="w-full h-12 rounded-xl border-rose-500/20 bg-rose-500/5 text-rose-400 hover:bg-rose-500/10 font-black uppercase tracking-wider text-xs"
          >
            {archiveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Package className="h-4 w-4 mr-2" /> Archive Item
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
