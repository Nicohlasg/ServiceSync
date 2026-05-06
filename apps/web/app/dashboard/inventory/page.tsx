"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Package, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: '', label: 'All', emoji: '' },
  { value: 'refrigerant', label: 'Refrigerant', emoji: '🧊' },
  { value: 'chemical', label: 'Chemical', emoji: '🧪' },
  { value: 'filter', label: 'Filter', emoji: '🔲' },
  { value: 'part', label: 'Part', emoji: '🔧' },
  { value: 'tool', label: 'Tool', emoji: '🛠️' },
  { value: 'consumable', label: 'Consumable', emoji: '📦' },
  { value: 'other', label: 'Other', emoji: '📋' },
] as const;

const CATEGORY_EMOJIS: Record<string, string> = {
  refrigerant: '🧊',
  chemical: '🧪',
  filter: '🔲',
  part: '🔧',
  tool: '🛠️',
  consumable: '📦',
  other: '📋',
};

function getStockStatus(qty: number, minQty: number) {
  if (qty <= 0) return 'out';
  if (minQty > 0 && qty <= minQty) return 'low';
  if (minQty > 0 && qty <= minQty * 2) return 'warn';
  return 'ok';
}

export default function InventoryPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState('');

  const { data: items = [], isLoading } = api.inventory.list.useQuery(
    selectedCategory ? { category: selectedCategory as any } : {},
    { staleTime: 30_000 }
  );

  const { data: lowStock = [] } = api.inventory.getLowStock.useQuery(undefined, {
    staleTime: 60_000,
  });

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center justify-between px-1"
      >
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard" />
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight leading-none">Inventory</h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">
              {items.length} item{items.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <Link href="/dashboard/inventory/new">
          <Button className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-white flex items-center gap-2">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </Link>
      </motion.div>

      {/* Low Stock Alert Banner */}
      <AnimatePresence>
        {lowStock.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-1 flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/30"
          >
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-amber-400">
                {lowStock.length} item{lowStock.length > 1 ? 's' : ''} need restocking
              </p>
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest truncate">
                {(lowStock as any[]).slice(0, 2).map((i: any) => i.name).join(', ')}
                {lowStock.length > 2 ? ` +${lowStock.length - 2} more` : ''}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Filter Tabs */}
      <div className="overflow-x-auto pb-1 -mx-4 px-4">
        <div className="flex gap-2 w-max">
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex items-center gap-1.5 h-9 px-4 rounded-xl text-xs font-black uppercase tracking-wider border whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white text-zinc-950 border-white'
                    : 'bg-white/5 text-zinc-400 border-white/10 hover:bg-white/10'
                }`}
              >
                {cat.emoji && <span>{cat.emoji}</span>}
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Item List */}
      {isLoading ? (
        <div className="space-y-3 px-1">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Package className="h-8 w-8 text-zinc-600" />
          </div>
          <div className="text-center">
            <p className="font-black text-white text-lg">No items yet</p>
            <p className="text-zinc-500 text-sm mt-1">Track your parts and supplies here</p>
          </div>
          <Link href="/dashboard/inventory/new">
            <Button className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-white">
              Add First Item
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3 px-1">
          <AnimatePresence mode="popLayout">
            {(items as any[]).map((item: any, index: number) => {
              const qty = Number(item.quantity_on_hand);
              const minQty = Number(item.min_quantity);
              const status = getStockStatus(qty, minQty);

              const stockColors = {
                out: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
                low: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
                warn: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
                ok: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
              };

              const stockLabel = {
                out: 'Out of Stock',
                low: 'Low Stock',
                warn: 'Running Low',
                ok: '',
              };

              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => router.push(`/dashboard/inventory/${item.id}`)}
                >
                  <Card variant="premium" className="rounded-2xl backdrop-blur-xl cursor-pointer hover:border-white/20 active:scale-[0.99] transition-all">
                    <CardContent className="p-4 relative z-10">
                      <div className="flex items-center gap-3">
                        {/* Category emoji */}
                        <div className="h-12 w-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shrink-0">
                          {CATEGORY_EMOJIS[item.category] ?? '📋'}
                        </div>

                        {/* Name + category */}
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-white truncate">{item.name}</p>
                          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                            {item.category}
                          </p>
                          {minQty > 0 && (
                            <p className="text-[10px] text-zinc-600 mt-0.5">
                              Reorder at {minQty} {item.unit}
                            </p>
                          )}
                        </div>

                        {/* Stock level */}
                        <div className={`flex flex-col items-end gap-0.5 px-3 py-2 rounded-xl border ${stockColors[status]}`}>
                          <span className="text-2xl font-black leading-none">{qty}</span>
                          <span className="text-[10px] font-bold leading-none opacity-80">{item.unit}</span>
                          {status !== 'ok' && (
                            <span className="text-[9px] font-black uppercase tracking-widest leading-none mt-0.5">
                              {stockLabel[status]}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cost row */}
                      {Number(item.unit_cost_cents) > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                            Cost per {item.unit}
                          </span>
                          <span className="text-sm font-black text-zinc-300">
                            {formatCurrency(Number(item.unit_cost_cents) / 100)}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
