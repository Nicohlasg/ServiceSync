"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion as m } from "framer-motion";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackButton } from "@/components/ui/back-button";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Briefcase, Users, Receipt, Loader2, Star, Maximize2, X } from "lucide-react";

const RevenueChart = dynamic(() => import("@/components/analytics/RevenueChart"), {
  ssr: false,
  loading: () => (
    <div className="h-40 flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
    </div>
  ),
});

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const LAUNCH_YEAR = 2026;

export default function AnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [year, setYear] = useState(currentYear);
  const [expandedChart, setExpandedChart] = useState(false);
  const [chartView, setChartView] = useState<'month' | 'day'>('month');
  const [selectedChartMonth, setSelectedChartMonth] = useState(currentMonth);

  const yearOptions = Array.from(
    { length: Math.max(1, currentYear - LAUNCH_YEAR + 1) },
    (_, i) => LAUNCH_YEAR + i
  );

  const { data: summary, isLoading: summaryLoading } = (api as any).analytics.getSummary.useQuery(
    { year },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: monthlyData, isLoading: monthlyLoading } = (api as any).invoices.getMonthlyBreakdown.useQuery(
    { year },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: topServices = [], isLoading: servicesLoading } = (api as any).analytics.getTopServices.useQuery(
    { year },
    { staleTime: 2 * 60 * 1000 }
  );

  const { data: dailyData, isLoading: dailyLoading } = (api as any).invoices.getDailyBreakdown.useQuery(
    { year, month: selectedChartMonth },
    { staleTime: 5 * 60 * 1000, enabled: expandedChart && chartView === 'day' }
  );

  const months = (monthlyData?.months ?? []) as Array<{ month: number; revenueCents: number; invoiceCount: number }>;

  const chartData = months.map(m => ({
    label: MONTHS_SHORT[m.month - 1],
    revenue: m.revenueCents / 100,
    count: m.invoiceCount,
  }));

  const dailyChartData = ((dailyData ?? []) as Array<{ day: number; revenueCents: number; invoiceCount: number }>).map(d => ({
    label: String(d.day),
    revenue: d.revenueCents / 100,
    count: d.invoiceCount,
  }));

  const bestMonth = months.reduce<{ month: number; revenueCents: number; invoiceCount: number } | null>(
    (best, m) => (!best || m.revenueCents > best.revenueCents ? m : best),
    null
  );

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const currMonthData = months.find(m => m.month === currentMonth);
  const prevMonthData = months.find(m => m.month === prevMonth);
  const momPct = currMonthData && prevMonthData && prevMonthData.revenueCents > 0
    ? Math.round(((currMonthData.revenueCents - prevMonthData.revenueCents) / prevMonthData.revenueCents) * 100)
    : null;

  const showInsights = !monthlyLoading && (bestMonth?.revenueCents ?? 0) > 0;

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <BackButton href="/dashboard" />
          <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
        </div>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 h-9 bg-white/5 border-white/10 text-white font-black text-sm rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
            {yearOptions.map(y => (
              <SelectItem key={y} value={String(y)} className="font-black">{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Insight Cards — best month + MoM comparison */}
      {showInsights && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }} className="grid grid-cols-2 gap-3 px-1">
          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-4 w-4 text-amber-400" />
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Best Month</p>
              </div>
              <p className="text-lg font-black text-amber-400">{MONTHS_SHORT[bestMonth!.month - 1]}</p>
              <p className="text-xs font-black text-zinc-300 mt-0.5">{formatCurrency(bestMonth!.revenueCents / 100)}</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                {momPct !== null && momPct >= 0
                  ? <TrendingUp className="h-4 w-4 text-emerald-400" />
                  : <TrendingDown className="h-4 w-4 text-rose-400" />
                }
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">vs Last Month</p>
              </div>
              {momPct !== null ? (
                <>
                  <p className={`text-lg font-black ${momPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {momPct >= 0 ? '+' : ''}{momPct}%
                  </p>
                  <p className="text-xs font-black text-zinc-300 mt-0.5">
                    {MONTHS_SHORT[currentMonth - 1]} vs {MONTHS_SHORT[prevMonth - 1]}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-lg font-black text-zinc-400">—</p>
                  <p className="text-xs font-black text-zinc-500 mt-0.5">Not enough data</p>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stat Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 gap-4 px-1">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="grid grid-cols-2 gap-4 px-1">
          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Revenue {year}</p>
              </div>
              <p className="text-xl font-black text-emerald-400 tracking-tight">{formatCurrency((summary?.revenueCents ?? 0) / 100)}</p>
              <p className="text-xs text-zinc-400 font-bold mt-1">{summary?.paidCount ?? 0} paid invoices</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-blue-400" />
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Jobs Done</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">{summary?.jobsCompleted ?? 0}</p>
              <p className="text-xs text-zinc-400 font-bold mt-1">completed in {year}</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-400" />
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Clients</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">{summary?.totalClients ?? 0}</p>
              <p className="text-xs text-zinc-400 font-bold mt-1">total active</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-amber-400" />
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Avg Ticket</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">{formatCurrency((summary?.avgTicketCents ?? 0) / 100)}</p>
              <p className="text-xs text-zinc-400 font-bold mt-1">{summary?.pendingInvoices ?? 0} pending</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Monthly Revenue Chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="px-1">
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Monthly Revenue</p>
              <button
                onClick={() => setExpandedChart(true)}
                className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
              >
                <Maximize2 className="h-3.5 w-3.5 text-zinc-400" />
              </button>
            </div>
            {monthlyLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
              </div>
            ) : (
              <RevenueChart data={chartData} />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Expanded Chart Overlay */}
      <AnimatePresence>
        {expandedChart && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-zinc-950/90 z-[80] backdrop-blur-md"
              onClick={() => setExpandedChart(false)}
            />
            <m.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 20 }}
              transition={{ type: "tween", duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-x-4 top-12 bottom-12 z-[90] bg-zinc-950 border border-white/10 rounded-3xl flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Overlay header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <div>
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em]">Revenue Breakdown</p>
                  <p className="text-lg font-black text-white mt-0.5">{year}</p>
                </div>
                <button
                  onClick={() => setExpandedChart(false)}
                  className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all"
                >
                  <X className="h-4 w-4 text-zinc-400" />
                </button>
              </div>

              {/* View toggle */}
              <div className="px-5 pb-3 shrink-0">
                <div className="flex gap-1 bg-white/5 rounded-xl p-1">
                  <button
                    onClick={() => setChartView('month')}
                    className={`flex-1 h-8 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      chartView === 'month'
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    By Month
                  </button>
                  <button
                    onClick={() => setChartView('day')}
                    className={`flex-1 h-8 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                      chartView === 'day'
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    By Day
                  </button>
                </div>
              </div>

              {/* Month selector (day view only) */}
              {chartView === 'day' && (
                <div className="px-5 pb-3 shrink-0">
                  <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
                    {MONTHS_SHORT.map((label, i) => {
                      const monthNum = i + 1;
                      const hasData = months.some(m => m.month === monthNum);
                      return (
                        <button
                          key={monthNum}
                          onClick={() => setSelectedChartMonth(monthNum)}
                          className={`shrink-0 h-8 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                            selectedChartMonth === monthNum
                              ? 'bg-blue-600 text-white'
                              : hasData
                                ? 'bg-white/5 text-zinc-300 border border-white/10 hover:bg-white/10'
                                : 'bg-white/5 text-zinc-600 border border-white/5'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Chart area */}
              <div className="flex-1 min-h-0 px-5 pb-4">
                {chartView === 'month' ? (
                  monthlyLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
                    </div>
                  ) : (
                    <RevenueChart data={chartData} height={220} />
                  )
                ) : (
                  dailyLoading ? (
                    <div className="h-full flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
                    </div>
                  ) : dailyChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No paid invoices in {MONTHS_SHORT[selectedChartMonth - 1]}</p>
                    </div>
                  ) : (
                    <RevenueChart data={dailyChartData} height={220} />
                  )
                )}
              </div>

              {/* Summary row */}
              {chartView === 'month' && !monthlyLoading && (
                <div className="px-5 pb-5 grid grid-cols-3 gap-2 shrink-0 border-t border-white/5 pt-4">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total</p>
                    <p className="text-sm font-black text-emerald-400">{formatCurrency(months.reduce((s, m) => s + m.revenueCents, 0) / 100)}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Avg/Month</p>
                    <p className="text-sm font-black text-white">
                      {formatCurrency(months.length > 0 ? (months.reduce((s, m) => s + m.revenueCents, 0) / months.length) / 100 : 0)}
                    </p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Best</p>
                    <p className="text-sm font-black text-amber-400">{bestMonth ? MONTHS_SHORT[bestMonth.month - 1] : '—'}</p>
                  </div>
                </div>
              )}
              {chartView === 'day' && !dailyLoading && dailyChartData.length > 0 && (
                <div className="px-5 pb-5 grid grid-cols-3 gap-2 shrink-0 border-t border-white/5 pt-4">
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Month Total</p>
                    <p className="text-sm font-black text-emerald-400">{formatCurrency(dailyChartData.reduce((s, d) => s + d.revenue, 0))}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Active Days</p>
                    <p className="text-sm font-black text-white">{dailyChartData.filter(d => d.revenue > 0).length}</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-3 text-center">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Best Day</p>
                    <p className="text-sm font-black text-amber-400">
                      {dailyChartData.length > 0
                        ? `Day ${dailyChartData.reduce((best, d) => d.revenue > best.revenue ? d : best).label}`
                        : '—'}
                    </p>
                  </div>
                </div>
              )}
            </m.div>
          </>
        )}
      </AnimatePresence>

      {/* Top Services */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="px-1 space-y-3">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Top Services</p>
        {servicesLoading ? (
          <div className="h-20 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        ) : (topServices as Array<unknown>).length === 0 ? (
          <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/5 border-dashed">
            <p className="text-zinc-400 font-black uppercase tracking-widest text-[10px]">No completed jobs in {year}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(topServices as Array<{ name: string; count: number; revenueCents: number }>).map((svc, i) => {
              const maxCount = (topServices as Array<{ count: number }>)[0]?.count ?? 1;
              const pct = Math.round((svc.count / maxCount) * 100);
              return (
                <Card key={svc.name} variant="premium" className="rounded-2xl backdrop-blur-xl">
                  <CardContent className="p-4 relative z-10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-black text-zinc-500 w-4">#{i + 1}</span>
                        <p className="font-black text-white text-sm truncate max-w-[180px]">{svc.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-400 text-sm">{formatCurrency(svc.revenueCents / 100)}</p>
                        <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">{svc.count} job{svc.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
