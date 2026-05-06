"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: 'chemical', label: 'Chemical' },
  { value: 'part', label: 'Parts & Tools' },
  { value: 'other', label: 'Others' },
] as const;

export default function NewInventoryItemPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [unit, setUnit] = useState('');
  const [qty, setQty] = useState('');
  const [minQty, setMinQty] = useState('0');
  const [maxQty, setMaxQty] = useState('');
  const [costDollars, setCostDollars] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [showSupplier, setShowSupplier] = useState(false);

  const createMutation = api.inventory.create.useMutation({
    onSuccess: () => {
      toast.success('Item saved!');
      router.push('/dashboard/inventory');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    if (!name.trim()) { toast.error('Item name is required'); return; }
    if (!category) { toast.error('Please select a category'); return; }
    if (!unit.trim()) { toast.error('Please enter a unit of measurement'); return; }

    createMutation.mutate({
      name: name.trim(),
      category: category as any,
      unit,
      quantityOnHand: parseFloat(qty) || 0,
      minQuantity: parseFloat(minQty) || 0,
      maxQuantity: maxQty.trim() ? parseFloat(maxQty) : undefined,
      unitCostCents: Math.round((parseFloat(costDollars) || 0) * 100),
      supplierName: supplierName.trim() || undefined,
      supplierContact: supplierPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-1"
      >
        <BackButton href="/dashboard/inventory" />
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight leading-none">Add Inventory Item</h1>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
            New stock entry
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="space-y-6 px-1"
      >
        {/* 1. Item Name */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Item Name</p>
            <Input
              placeholder="e.g. R32 Refrigerant Gas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold text-lg"
            />
          </CardContent>
        </Card>

        {/* 2. Category */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Category</p>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const isActive = category === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`h-14 rounded-2xl border flex items-center justify-center transition-all active:scale-[0.97] ${
                      isActive
                        ? 'bg-white/15 border-white/30 text-white'
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-[11px] font-black uppercase tracking-wider text-center px-2 leading-tight">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 3. Unit of measurement */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Measured in</p>
            <Input
              placeholder="e.g. piece, kg, litre, bottle..."
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-500 rounded-xl font-bold text-base"
            />
          </CardContent>
        </Card>

        {/* 4. Current stock on hand */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Current Stock on Hand</p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold text-lg flex-1"
              />
              {unit && (
                <span className="text-sm font-black text-zinc-400 uppercase tracking-wider shrink-0">{unit}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 5. Reorder reminder */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Reorder Reminder</p>
            <p className="text-sm font-black text-zinc-400">Alert me when below:</p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                className="h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold text-lg flex-1"
              />
              {unit && (
                <span className="text-sm font-black text-zinc-400 uppercase tracking-wider shrink-0">{unit}</span>
              )}
            </div>
            <p className="text-xs text-zinc-600">Leave at 0 to disable reminders</p>
          </CardContent>
        </Card>

        {/* 5b. Full stock level */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Full Stock Level <span className="text-zinc-600">(Optional)</span></p>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="e.g. 20"
                value={maxQty}
                onChange={(e) => setMaxQty(e.target.value)}
                className="h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold text-lg flex-1"
              />
              {unit && (
                <span className="text-sm font-black text-zinc-400 uppercase tracking-wider shrink-0">{unit}</span>
              )}
            </div>
            <p className="text-xs text-zinc-600">When set, the stock bar fills to this amount — makes your dashboard levels accurate</p>
          </CardContent>
        </Card>

        {/* 6. Cost per unit */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              Cost per {unit || 'unit'}
            </p>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-black text-lg">$</span>
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="0.00"
                value={costDollars}
                onChange={(e) => setCostDollars(e.target.value)}
                className="h-14 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold text-lg pl-8"
              />
            </div>
          </CardContent>
        </Card>

        {/* 7. Supplier details (collapsible) */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <button
              onClick={() => setShowSupplier(!showSupplier)}
              className="w-full flex items-center justify-between"
            >
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
                Supplier Info <span className="text-zinc-600">(Optional)</span>
              </p>
              {showSupplier ? (
                <ChevronUp className="h-4 w-4 text-zinc-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-zinc-500" />
              )}
            </button>

            <AnimatePresence>
              {showSupplier && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden space-y-3"
                >
                  <div className="space-y-2">
                    <p className="text-xs font-black text-zinc-500">Supplier Name</p>
                    <Input
                      placeholder="e.g. Cold Gas Supply Pte Ltd"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-black text-zinc-500">Supplier Phone</p>
                    <Input
                      type="tel"
                      placeholder="e.g. 6123 4567"
                      value={supplierPhone}
                      onChange={(e) => setSupplierPhone(e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* 8. Notes */}
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10 space-y-3">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
              Notes <span className="text-zinc-600">(Optional)</span>
            </p>
            <textarea
              placeholder="e.g. Store in cool dry place"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold p-3 text-sm resize-none outline-none focus:border-blue-500/50 transition-colors"
            />
          </CardContent>
        </Card>

        {/* Save button */}
        <Button
          onClick={handleSave}
          disabled={createMutation.isPending}
          className="w-full h-16 bg-blue-600 hover:bg-blue-700 font-black text-white rounded-2xl uppercase tracking-wider text-base shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all"
        >
          {createMutation.isPending ? 'Saving...' : 'Save Item'}
        </Button>
      </motion.div>
    </div>
  );
}
