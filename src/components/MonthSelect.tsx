"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { formatMonthLabel } from "@/lib/dates";

export function MonthSelect({
  value,
  options,
}: {
  value: string;
  options: string[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <select
      className="h-10 flex-1 rounded-md border bg-background px-3 text-sm"
      value={value}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        next.set("month", e.target.value);
        router.push(`?${next.toString()}`);
      }}
    >
      {options.map((m) => (
        <option key={m} value={m}>
          {formatMonthLabel(m)}
        </option>
      ))}
    </select>
  );
}
