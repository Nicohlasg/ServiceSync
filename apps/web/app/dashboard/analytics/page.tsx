"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { motion } from "framer-motion";
import { TrendingUp, Briefcase, Users, Receipt, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function AnalyticsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

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

  const chartData = ((monthlyData?.months ?? []) as Array<{ month: number; revenueCents: number; invoiceCount: number }>).map(m => ({
    month: MONTHS_SHORT[m.month - 1],
    revenue: m.revenueCents / 100,
    count: m.invoiceCount,
  }));

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2].filter(y => y >= 2024);

  return (
    <div className="space-y-6 pt-4 pb-24 text-white">
      {/* Header */}
      <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between px-1">
        <h1 className="text-2xl font-black text-white tracking-tight">Analytics</h1>
        <div className="flex gap-2">
          {yearOptions.map(y => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`h-9 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                year === y
                  ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-600/25'
                  : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </motion.div>

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
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Revenue {year}</p>
              </div>
              <p className="text-xl font-black text-emerald-400 tracking-tight">{formatCurrency((summary?.revenueCents ?? 0) / 100)}</p>
              <p className="text-[9px] text-zinc-600 font-bold mt-1">{summary?.paidCount ?? 0} paid invoices</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Briefcase className="h-4 w-4 text-blue-400" />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Jobs Done</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">{summary?.jobsCompleted ?? 0}</p>
              <p className="text-[9px] text-zinc-600 font-bold mt-1">completed in {year}</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-purple-400" />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Clients</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">{summary?.totalClients ?? 0}</p>
              <p className="text-[9px] text-zinc-600 font-bold mt-1">total active</p>
            </CardContent>
          </Card>

          <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
            <CardContent className="p-4 relative z-10">
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-4 w-4 text-amber-400" />
                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Avg Ticket</p>
              </div>
              <p className="text-xl font-black text-white tracking-tight">{formatCurrency((summary?.avgTicketCents ?? 0) / 100)}</p>
              <p className="text-[9px] text-zinc-600 font-bold mt-1">{summary?.pendingInvoices ?? 0} pending</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Monthly Revenue Chart */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="px-1">
        <Card variant="premium" className="rounded-2xl backdrop-blur-xl">
          <CardContent className="p-5 relative z-10">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-4">Monthly Revenue</p>
            {monthlyLoading ? (
              <div className="h-40 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff', fontSize: 12, fontWeight: 700 }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Services */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="px-1 space-y-3">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] px-1">Top Services</p>
        {servicesLoading ? (
          <div className="h-20 rounded-2xl bg-white/5 border border-white/10 animate-pulse" />
        ) : (topServices as Array<unknown>).length === 0 ? (
          <div className="text-center py-10 bg-white/5 rounded-2xl border border-white/5 border-dashed">
            <p className="text-zinc-500 font-black uppercase tracking-widest text-[10px]">No completed jobs in {year}</p>
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
                        <span className="text-[9px] font-black text-zinc-600 w-4">#{i + 1}</span>
                        <p className="font-black text-white text-sm truncate max-w-[180px]">{svc.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-emerald-400 text-sm">{formatCurrency(svc.revenueCents / 100)}</p>
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{svc.count} job{svc.count !== 1 ? 's' : ''}</p>
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
