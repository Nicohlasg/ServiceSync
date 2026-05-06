"use client";
import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import { SkeletonCard } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Loader2, MessageCircle, FileText, X } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
  sent: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  accepted: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  declined: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
};

function QuoteDetail() {
  const { quoteId } = useParams<{ quoteId: string }>();
  const { push } = useRouter();
  const utils = api.useUtils();

  const { data: quote, isLoading, isError } = api.quotes.getById.useQuery(
    { quoteId },
    { enabled: !!quoteId, staleTime: 30_000 }
  );

  const updateStatusMutation = api.quotes.updateStatus.useMutation({
    onSuccess: () => { toast.success('Status updated'); utils.quotes.getById.invalidate({ quoteId }); },
    onError: (err: any) => toast.error(err.message),
  });

  const convertMutation = api.quotes.convertToInvoice.useMutation({
    onSuccess: (data: any) => { toast.success('Invoice created!'); push(`/dashboard/invoices/${data.invoiceId}`); },
    onError: (err: any) => toast.error(err.message || 'Failed to convert'),
  });

  const deleteMutation = api.quotes.delete.useMutation({
    onSuccess: () => { toast.success('Quote deleted'); push('/dashboard/quotes'); },
    onError: (err: any) => toast.error(err.message),
  });

  if (isError) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4 text-white">
      <p className="text-rose-400 font-black uppercase tracking-widest text-xs">Quote not found</p>
      <Button variant="outline" onClick={() => push('/dashboard/quotes')} className="border-white/10 bg-white/5 text-white rounded-xl font-black uppercase tracking-widest text-[10px]">Back</Button>
    </div>
  );

  if (isLoading || !quote) return (
    <div className="space-y-6 pt-4 pb-24 px-1"><SkeletonCard /><SkeletonCard /></div>
  );

  const q = quote as any;
  const client = q.clients;
  const lineItems: Array<{ description: string; amountCents: number }> = q.line_items ?? [];
  const isAccepted = q.status === 'accepted';

  function handleWhatsApp() {
    const phone = client?.phone?.replace(/\D/g, '') ?? '';
    if (!phone) { toast.error('No client phone on file'); return; }
    const items = lineItems.map(i => `• ${i.description}: $${(i.amountCents / 100).toFixed(2)}`).join('\n');
    let msg = `Hi ${client?.name ?? 'there'}! 👋\n\nHere's your quote:\n\n📋 *${q.quote_number}*\n\n${items}`;
    if (q.tax_cents > 0) msg += `\n• GST: $${(q.tax_cents / 100).toFixed(2)}`;
    msg += `\n${'─'.repeat(20)}\n*Total: $${(q.total_cents / 100).toFixed(2)}*`;
    if (q.valid_until) msg += `\n\nValid until: ${format(new Date(q.valid_until + 'T00:00:00'), 'd MMM yyyy')}`;
    msg += `\n\nLet me know if you'd like to proceed! 🔧`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    if (q.status === 'draft') updateStatusMutation.mutate({ quoteId, status: 'sent' });
  }

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard/quotes" />
          <div>
            <h1 className="text-xl font-black text-white tracking-tight leading-none">{q.quote_number}</h1>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">{client?.name ?? 'No client'}</p>
          </div>
        </div>
        <button onClick={() => deleteMutation.mutate({ quoteId })} disabled={deleteMutation.isPending} className="h-10 w-10 rounded-xl bg-rose-600/10 border border-rose-500/20 text-rose-400 hover:text-rose-300 flex items-center justify-center transition-all">
          {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
        </button>
      </motion.div>

      {/* Quote card */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="px-1">
        <Card variant="premium" className="rounded-2xl backdrop-blur-2xl">
          <CardContent className="p-5 space-y-4 relative z-10">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border ${STATUS_COLORS[q.status] ?? STATUS_COLORS.draft}`}>
                {q.status}
              </span>
              <Select value={q.status} onValueChange={v => updateStatusMutation.mutate({ quoteId, status: v as any })}>
                <SelectTrigger className="h-9 w-32 bg-white/5 border-white/10 rounded-xl text-zinc-400 font-black text-[10px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              {lineItems.map((item, i) => (
                <div key={i} className="flex justify-between items-start gap-4">
                  <span className="text-sm font-bold text-zinc-200 flex-1">{item.description}</span>
                  <span className="font-black text-white shrink-0">{formatCurrency(item.amountCents / 100)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-zinc-400">Subtotal</span>
                <span className="font-black text-white">{formatCurrency(q.subtotal_cents / 100)}</span>
              </div>
              {q.tax_cents > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-bold text-zinc-400">GST</span>
                  <span className="font-black text-white">{formatCurrency(q.tax_cents / 100)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="font-black text-white uppercase tracking-widest text-xs">Total</span>
                <span className="font-black text-xl text-emerald-400">{formatCurrency(q.total_cents / 100)}</span>
              </div>
            </div>

            {q.valid_until && (
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Valid until: {format(new Date(q.valid_until + 'T00:00:00'), 'd MMM yyyy')}
              </p>
            )}
            {q.notes && (
              <div className="bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 text-amber-200/80 text-xs font-medium">
                {q.notes}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Actions */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="px-1 space-y-3">
        {!isAccepted && (
          <Button
            onClick={handleWhatsApp}
            className="w-full h-14 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all border-none"
          >
            <MessageCircle className="h-5 w-5" /> Send to Client via WhatsApp
          </Button>
        )}

        {!isAccepted && (
          <Button
            onClick={() => convertMutation.mutate({ quoteId })}
            disabled={convertMutation.isPending}
            className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs gap-3 shadow-xl shadow-blue-600/20 active:scale-[0.98] transition-all border-none"
          >
            {convertMutation.isPending
              ? <><Loader2 className="h-5 w-5 animate-spin mr-2" />Converting...</>
              : <><FileText className="h-5 w-5" /> Convert to Invoice</>}
          </Button>
        )}

        {isAccepted && (
          <div className="text-center py-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
            <p className="text-emerald-400 font-black uppercase tracking-widest text-xs">Quote accepted &amp; converted to invoice</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function QuoteDetailPage() {
  return <Suspense fallback={<div className="space-y-6 pt-4 pb-24 px-1"><SkeletonCard /><SkeletonCard /></div>}><QuoteDetail /></Suspense>;
}
