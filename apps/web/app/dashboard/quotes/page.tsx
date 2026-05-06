"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, FileText, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type StatusFilter = 'all' | 'draft' | 'sent' | 'accepted' | 'declined';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',
  sent: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  accepted: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  declined: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
};

export default function QuotesPage() {
  const { push } = useRouter();
  const [tab, setTab] = useState<StatusFilter>('all');

  const { data: quotes = [], isLoading } = api.quotes.list.useQuery(
    { status: tab === 'all' ? undefined : tab },
    { staleTime: 30_000 }
  );

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-black text-white tracking-tight">Quotes</h1>
        <Button
          onClick={() => push('/dashboard/quotes/new')}
          className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus className="h-4 w-4" /> New Quote
        </Button>
      </motion.div>

      {/* Status tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 px-1">
        {(['all', 'draft', 'sent', 'accepted', 'declined'] as StatusFilter[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap border transition-all ${
              tab === t
                ? 'bg-blue-600 text-white border-blue-500 shadow-xl shadow-blue-600/25 scale-105'
                : 'bg-white/5 text-zinc-400 border-white/5 hover:border-white/10 hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
        </div>
      ) : quotes.length === 0 ? (
        <div className="text-center py-20 bg-white/5 rounded-[2rem] border border-white/5 border-dashed">
          <FileText className="h-8 w-8 text-zinc-700 mx-auto mb-4" />
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">No quotes yet</p>
          <Button onClick={() => push('/dashboard/quotes/new')} className="mt-4 h-10 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-[10px]">
            Create First Quote
          </Button>
        </div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-3 px-1">
            {quotes.map((q: any, i: number) => (
              <motion.div key={q.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                <Card
                  variant="premium"
                  className="rounded-2xl backdrop-blur-xl cursor-pointer active:scale-[0.98] transition-all hover:border-blue-500/30 group"
                  onClick={() => push(`/dashboard/quotes/${q.id}`)}
                >
                  <CardContent className="p-4 flex items-center gap-4 relative z-10">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-black text-white text-sm tracking-tight">{q.quote_number}</p>
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border ${STATUS_COLORS[q.status] ?? STATUS_COLORS.draft}`}>
                          {q.status}
                        </span>
                      </div>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest truncate">
                        {(q.clients as any)?.name ?? 'No client'} · {format(new Date(q.created_at), 'd MMM yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-black text-white tracking-tight">{formatCurrency(q.total_cents / 100)}</span>
                      <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-white transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </AnimatePresence>
      )}
    </div>
  );
}
