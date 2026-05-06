"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { Plus, Trash2, Loader2, X } from "lucide-react";

interface LineItem { description: string; amountDisplay: string; }
interface ClientOption { id: string; name: string; phone: string; }

function displayToCents(s: string) { return Math.round(parseFloat(s || '0') * 100) || 0; }

function NewQuote() {
  const { push } = useRouter();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([{ description: '', amountDisplay: '' }]);
  const [taxDisplay, setTaxDisplay] = useState('');
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('clients').select('id, name, phone').eq('provider_id', user.id).eq('is_deleted', false).order('name');
      if (data) setClients(data);
    }
    load();
  }, []);

  const createMutation = api.quotes.create.useMutation({
    onSuccess: (data: any) => { push(`/dashboard/quotes/${data.id}`); },
    onError: (err: any) => toast.error(err.message || 'Failed to create quote'),
  });

  const taxCents = displayToCents(taxDisplay);
  const subtotal = lineItems.reduce((s, i) => s + displayToCents(i.amountDisplay), 0);
  const total = subtotal + taxCents;

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));
  const selectedClient = clients.find(c => c.id === clientId);

  function updateItem(idx: number, field: keyof LineItem, value: string) {
    setLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function handleSubmit() {
    const validItems = lineItems.filter(i => i.description.trim());
    if (validItems.length === 0) { toast.error('Add at least one line item'); return; }
    createMutation.mutate({
      clientId: clientId || undefined,
      lineItems: validItems.map(i => ({ description: i.description.trim(), amountCents: displayToCents(i.amountDisplay) })),
      taxCents,
      notes: notes.trim(),
      validUntil: validUntil || undefined,
    });
  }

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 px-1">
        <BackButton href="/dashboard/quotes" />
        <h1 className="text-2xl font-black tracking-tight">New Quote</h1>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card variant="premium" className="rounded-3xl backdrop-blur-2xl shadow-2xl">
          <CardContent className="p-6 space-y-6 relative z-10">

            {/* Client */}
            <div className="space-y-1.5 relative">
              <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Client (optional)</Label>
              <div className="relative">
                <Input
                  value={selectedClient ? selectedClient.name : clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setClientId(''); setClientDropdownOpen(true); }}
                  onFocus={() => setClientDropdownOpen(true)}
                  placeholder="Search client..."
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold pr-10"
                />
                {(clientId || clientSearch) && (
                  <button onClick={() => { setClientId(''); setClientSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {clientDropdownOpen && filteredClients.length > 0 && !clientId && (
                <div className="absolute z-50 mt-1 w-full bg-zinc-950/95 border border-white/10 rounded-2xl overflow-hidden shadow-2xl backdrop-blur-3xl">
                  {filteredClients.slice(0, 6).map(c => (
                    <button key={c.id} onClick={() => { setClientId(c.id); setClientSearch(''); setClientDropdownOpen(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-white/10 transition-colors border-b border-white/5 last:border-0">
                      <p className="font-black text-white text-sm">{c.name}</p>
                      <p className="text-[10px] text-zinc-500 font-bold">{c.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="space-y-3">
              <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Line Items</Label>
              {lineItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    placeholder={`Item ${idx + 1}`}
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="flex-1 h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold"
                  />
                  <div className="relative w-28 shrink-0">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">$</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.01}
                      placeholder="0.00"
                      value={item.amountDisplay}
                      onChange={e => updateItem(idx, 'amountDisplay', e.target.value)}
                      className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold pl-7"
                    />
                  </div>
                  {lineItems.length > 1 && (
                    <button onClick={() => setLineItems(prev => prev.filter((_, i) => i !== idx))} className="text-zinc-600 hover:text-rose-400 transition-colors shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setLineItems(prev => [...prev, { description: '', amountDisplay: '' }])}
                className="w-full h-10 rounded-xl border border-dashed border-white/10 text-zinc-500 hover:text-blue-400 hover:border-blue-500/30 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>

            {/* GST / Tax */}
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">GST / Tax (optional)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 font-bold text-sm">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  placeholder="0.00"
                  value={taxDisplay}
                  onChange={e => setTaxDisplay(e.target.value)}
                  className="h-12 bg-white/5 border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-bold pl-7"
                />
              </div>
            </div>

            {/* Valid until */}
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Valid Until (optional)</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={e => setValidUntil(e.target.value)}
                className="h-12 bg-white/5 border-white/10 text-white rounded-xl appearance-none px-3 font-bold"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-zinc-400 text-[10px] font-black uppercase tracking-widest ml-1">Notes (optional)</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional details..."
                rows={3}
                className="w-full bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 rounded-xl font-medium text-sm px-4 py-3 resize-none focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Total */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-zinc-400">Subtotal</span>
                <span className="font-black text-white">{formatCurrency(subtotal / 100)}</span>
              </div>
              {taxCents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-zinc-400">GST</span>
                  <span className="font-black text-white">{formatCurrency(taxCents / 100)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-white/10 pt-2">
                <span className="font-black text-white uppercase tracking-widest text-xs">Total</span>
                <span className="font-black text-xl text-emerald-400">{formatCurrency(total / 100)}</span>
              </div>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className="w-full h-16 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-base shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all border-none"
            >
              {createMutation.isPending ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Creating...</> : 'Create Quote'}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function NewQuotePage() {
  return <Suspense fallback={<div className="space-y-6 pt-4 pb-24 px-1"><SkeletonCard /><SkeletonCard /></div>}><NewQuote /></Suspense>;
}
