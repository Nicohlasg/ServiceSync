"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface RevenueChartProps {
  data: Array<{ label: string; revenue: number; count: number }>;
  height?: number;
}

export default function RevenueChart({ data, height = 160 }: RevenueChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#a1a1aa', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#18181b',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
          }}
          formatter={(value: number) => [formatCurrency(value), 'Revenue']}
          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
        />
        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
