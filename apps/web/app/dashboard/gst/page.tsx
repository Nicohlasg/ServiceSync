"use client";
import { useState } from "react";
import { format, differenceInDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronDown, ChevronUp, Download, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { SkeletonCard } from "@/components/ui/skeleton";

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LAUNCH_YEAR = 2026;
const QUARTER_LABELS = ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Oct–Dec)'];

// IRAS quarterly filing deadlines: one month after quarter end
const FILING_DEADLINES = [
  { month: 4, day: 30 },  // Q1 → Apr 30
  { month: 7, day: 31 },  // Q2 → Jul 31
  { month: 10, day: 31 }, // Q3 → Oct 31
  { month: 1, day: 31 },  // Q4 → Jan 31 next year
];

function getFilingDeadline(year: number, quarter: number): Date {
  const { month, day } = FILING_DEADLINES[quarter - 1];
  const deadlineYear = quarter === 4 ? year + 1 : year;
  return new Date(deadlineYear, month - 1, day);
}

function getCurrentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3);
}

function exportCSV(transactions: any[], year: number, quarter: number) {
  const headers = ['Invoice #', 'Date', 'Total (SGD)', 'Taxable Amount (excl. GST)', 'GST Collected (9%)'];
  const rows = transactions.map(t => [
    t.invoice_number ?? '',
    format(new Date(t.created_at), 'd MMM yyyy'),
    (t.total_cents / 100).toFixed(2),
    ((t.total_cents - (t.tax_cents ?? 0)) / 100).toFixed(2),
    ((t.tax_cents ?? 0) / 100).toFixed(2),
  ]);
  const totals = transactions.reduce(
    (acc, t) => ({
      total: acc.total + t.total_cents,
      tax: acc.tax + (t.tax_cents ?? 0),
    }),
    { total: 0, tax: 0 }
  );
  rows.push(['TOTAL', '', (totals.total / 100).toFixed(2), ((totals.total - totals.tax) / 100).toFixed(2), (totals.tax / 100).toFixed(2)]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GST-Q${quarter}-${year}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GSTPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [showTransactions, setShowTransactions] = useState(false);

  const yearOptions = Array.from(
    { length: Math.max(1, currentYear - LAUNCH_YEAR + 1) },
    (_, i) => LAUNCH_YEAR + i
  );

  const { data: summary, isLoading: summaryLoading } = (api as any).gst.getQuarterlySummary.useQuery(
    { year, quarter },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: transactions = [] } = (api as any).gst.getTransactions.useQuery(
    { year, quarter },
    { staleTime: 2 * 60 * 1000 }
  );

  const deadline = getFilingDeadline(year, quarter);
  const today = new Date();
  const daysUntilDeadline = differenceInDays(deadline, today);
  const isPastDeadline = daysUntilDeadline < 0;
  const currentQ = getCurrentQuarter();
  // Only show deadline for closed quarters in current/past years
  const isQuarterClosed = year < currentYear || (year === currentYear && quarter < currentQ);

  const totalRevenueCents: number = summary?.totalRevenueCents ?? 0;
  const taxableRevenueCents: number = summary?.taxableRevenueCents ?? 0;
  const outputTaxCents: number = summary?.outputTaxCents ?? 0;
  const totalExpensesCents: number = summary?.totalExpensesCents ?? 0;
  const invoiceCount: number = summary?.invoiceCount ?? 0;
  const monthlyBreakdown: any[] = summary?.monthlyBreakdown ?? [];

  return (
    <div className="space-y-5 pt-4 pb-28 px-4 text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard" />
          <div>
            <h1 className="text-2xl font-black text-white">GST / Tax</h1>
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Quarterly IRAS Filing Reports</p>
          </div>
        </div>
        <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); }}>
          <SelectTrigger className="w-24 h-9 bg-white/5 border-white/10 text-white font-black text-sm rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)} className="font-black">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Quarter selector tabs */}
      <div className="grid grid-cols-4 gap-1.5 bg-white/5 p-1.5 rounded-2xl border border-white/10">
        {[1, 2, 3, 4].map(q => (
          <button
            key={q}
            onClick={() => setQuarter(q)}
            className={`py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
              quarter === q
                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/30'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Q{q}
          </button>
        ))}
      </div>

      {/* Filing deadline chip — only for closed quarters */}
      {isQuarterClosed && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${
            isPastDeadline
              ? 'bg-rose-500/10 border-rose-500/20'
              : daysUntilDeadline <= 14
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20'
          }`}>
            {isPastDeadline
              ? <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              : daysUntilDeadline <= 14
                ? <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                : <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            }
            <div>
              <p className={`text-xs font-black ${
                isPastDeadline ? 'text-rose-400' : daysUntilDeadline <= 14 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {isPastDeadline
                  ? `Filing was due ${format(deadline, 'd MMM yyyy')}`
                  : `Due ${format(deadline, 'd MMM yyyy')} · ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? 's' : ''} left`
                }
              </p>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">IRAS Quarterly GST Return</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary stat cards */}
      {summaryLoading ? (
        <div className="space-y-3">
          <SkeletonCard />
          <div className="grid grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Hero revenue card */}
          <Card variant="premium" className="rounded-2xl">
            <CardContent className="p-5 relative z-10">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Revenue</p>
                  <p className="text-3xl font-black text-white tabular-nums">{formatCurrency(totalRevenueCents / 100)}</p>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1.5">
                    {invoiceCount} paid invoice{invoiceCount !== 1 ? 's' : ''} · {QUARTER_LABELS[quarter - 1]} {year}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2×2 stat grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card variant="premium" className="rounded-2xl">
              <CardContent className="p-4 relative z-10">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Taxable Sales</p>
                <p className="text-xl font-black text-white tabular-nums">{formatCurrency(taxableRevenueCents / 100)}</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Excl. GST · Box 1</p>
              </CardContent>
            </Card>

            <Card variant="premium" className="rounded-2xl">
              <CardContent className="p-4 relative z-10">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Output Tax</p>
                <p className="text-xl font-black text-emerald-400 tabular-nums">{formatCurrency(outputTaxCents / 100)}</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">GST Collected · Box 6</p>
              </CardContent>
            </Card>

            <Card variant="premium" className="rounded-2xl">
              <CardContent className="p-4 relative z-10">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Expenses</p>
                <p className="text-xl font-black text-rose-400 tabular-nums">{formatCurrency(totalExpensesCents / 100)}</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">Claimable Input Tax</p>
              </CardContent>
            </Card>

            <Card variant="premium" className="rounded-2xl">
              <CardContent className="p-4 relative z-10">
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">Net GST Payable</p>
                <p className="text-xl font-black text-amber-400 tabular-nums">{formatCurrency(outputTaxCents / 100)}</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-1">To IRAS this quarter</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      )}

      {/* Monthly breakdown table */}
      {!summaryLoading && monthlyBreakdown.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3">Monthly Breakdown</p>
          <Card variant="premium" className="rounded-2xl overflow-hidden">
            <CardContent className="p-0 relative z-10">
              <div className="grid grid-cols-4 px-4 py-2.5 border-b border-white/5">
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Month</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Revenue</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">GST</p>
                <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Inv.</p>
              </div>
              {monthlyBreakdown.map((row: any, i: number) => (
                <div
                  key={row.month}
                  className={`grid grid-cols-4 px-4 py-3 ${i < monthlyBreakdown.length - 1 ? 'border-b border-white/5' : ''}`}
                >
                  <p className="text-sm font-black text-white">{MONTHS_SHORT[row.month - 1]}</p>
                  <p className="text-sm font-black text-zinc-300 tabular-nums text-right">
                    {row.revenueCents > 0 ? formatCurrency(row.revenueCents / 100) : <span className="text-zinc-700">—</span>}
                  </p>
                  <p className="text-sm font-black text-emerald-400 tabular-nums text-right">
                    {row.taxCents > 0 ? formatCurrency(row.taxCents / 100) : <span className="text-zinc-700">—</span>}
                  </p>
                  <p className="text-sm font-black text-zinc-500 tabular-nums text-right">{row.invoiceCount}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Transactions accordion */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <button
          onClick={() => setShowTransactions(v => !v)}
          className="w-full flex items-center justify-between py-2"
        >
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">
            Transactions ({invoiceCount})
          </p>
          {showTransactions
            ? <ChevronUp className="h-4 w-4 text-zinc-500" />
            : <ChevronDown className="h-4 w-4 text-zinc-500" />
          }
        </button>
        <AnimatePresence>
          {showTransactions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {(transactions as any[]).length === 0 ? (
                <p className="text-zinc-600 text-sm font-black text-center py-8">No paid invoices in {QUARTER_LABELS[quarter - 1]} {year}</p>
              ) : (
                <Card variant="premium" className="rounded-2xl mt-2 overflow-hidden">
                  <CardContent className="p-0 relative z-10">
                    <div className="grid grid-cols-3 px-4 py-2.5 border-b border-white/5">
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest col-span-2">Invoice</p>
                      <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest text-right">Total</p>
                    </div>
                    {(transactions as any[]).map((t: any, i: number) => (
                      <div
                        key={t.id}
                        className={`grid grid-cols-3 items-center px-4 py-3 ${i < (transactions as any[]).length - 1 ? 'border-b border-white/5' : ''}`}
                      >
                        <div className="col-span-2 min-w-0">
                          <p className="text-xs font-black text-white">{t.invoice_number ?? 'INV'}</p>
                          <p className="text-[10px] font-black text-zinc-600 mt-0.5">
                            {format(new Date(t.created_at), 'd MMM yyyy')}
                            {(t.tax_cents ?? 0) > 0 && (
                              <span className="text-emerald-500/80 ml-1.5">+{formatCurrency((t.tax_cents ?? 0) / 100)} GST</span>
                            )}
                          </p>
                        </div>
                        <p className="text-xs font-black text-white tabular-nums text-right">
                          {formatCurrency(t.total_cents / 100)}
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Export CSV + IRAS note */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
        <Button
          onClick={() => exportCSV(transactions as any[], year, quarter)}
          disabled={(transactions as any[]).length === 0}
          className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-black uppercase tracking-widest text-[11px] border border-violet-400/30 shadow-lg shadow-violet-500/20"
        >
          <Download className="h-4 w-4 mr-2" />
          Export CSV for IRAS
        </Button>
        <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-center leading-relaxed">
          GST registration required when turnover exceeds S$1,000,000 / year
        </p>
      </motion.div>
    </div>
  );
}
