"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatBRLCompact } from "@/lib/money";

interface Slice {
  name: string;
  color: string;
  value: number;
}

export function CategoryPieChart({ data }: { data: Slice[] }) {
  const total = data.reduce((acc, d) => acc + d.value, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatBRLCompact(value * 100)}
              contentStyle={{ fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {data.slice(0, 6).map((d) => (
          <li key={d.name} className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ background: d.color }}
            />
            <span className="flex-1">{d.name}</span>
            <span className="text-muted-foreground">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}%
            </span>
            <span className="w-20 text-right tabular-nums">
              {formatBRLCompact(d.value * 100)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
