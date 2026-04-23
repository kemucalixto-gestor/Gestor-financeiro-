"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMonthLabel } from "@/lib/dates";
import { formatBRLCompact } from "@/lib/money";

interface Point {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

export function MonthlyChart({ data }: { data: Point[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.month).slice(0, 3),
  }));

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formatted} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatBRLCompact(Number(v) * 100)}
          />
          <Tooltip
            formatter={(value: number) => formatBRLCompact(value * 100)}
            contentStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#16a34a"
            strokeWidth={2}
            dot={false}
            name="Receita"
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="Despesa"
          />
          <Line
            type="monotone"
            dataKey="balance"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            name="Saldo"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
