"use client";

import { useState, useTransition } from "react";
import { Pencil, X } from "lucide-react";
import type { Category } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MoneyInput } from "@/components/MoneyInput";
import { formatBRL } from "@/lib/money";
import { saveBudget } from "@/server/actions/budgets";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Row {
  category: Category;
  limitCents: number;
  spentCents: number;
}

export function BudgetsView({ rows, month }: { rows: Row[]; month: string }) {
  const [editing, setEditing] = useState<Row | null>(null);
  const router = useRouter();

  return (
    <>
      <div className="flex flex-col gap-2">
        {rows.map((r) => {
          const pct =
            r.limitCents > 0
              ? Math.min(100, Math.round((r.spentCents / r.limitCents) * 100))
              : 0;
          const over = r.limitCents > 0 && r.spentCents > r.limitCents;
          const warn = !over && r.limitCents > 0 && pct >= 80;
          const barClass = over
            ? "bg-destructive"
            : warn
              ? "bg-amber-500"
              : "bg-primary";

          return (
            <Card key={r.category.id}>
              <CardContent className="flex flex-col gap-2 p-3">
                <div className="flex items-center gap-3">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ background: r.category.color }}
                  />
                  <span className="flex-1 font-medium">{r.category.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditing(r)}
                    aria-label="Editar limite"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {formatBRL(r.spentCents)}
                    {r.limitCents > 0 && (
                      <> / {formatBRL(r.limitCents)}</>
                    )}
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      over
                        ? "text-destructive"
                        : warn
                          ? "text-amber-600"
                          : "text-muted-foreground",
                    )}
                  >
                    {r.limitCents > 0 ? `${pct}%` : "sem limite"}
                  </span>
                </div>
                {r.limitCents > 0 && (
                  <Progress value={pct} indicatorClassName={barClass} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {editing && (
        <BudgetEditor
          row={editing}
          month={month}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function BudgetEditor({
  row,
  month,
  onClose,
  onSaved,
}: {
  row: Row;
  month: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [cents, setCents] = useState(row.limitCents);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Limite para {row.category.name}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Valor mensal</Label>
            <MoneyInput valueCents={cents} onChange={setCents} />
            <p className="mt-1 text-xs text-muted-foreground">
              Defina como 0 (zero) para remover o limite.
            </p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await saveBudget({
                    categoryId: row.category.id,
                    month,
                    limitCents: cents,
                  });
                  onSaved();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Erro ao salvar",
                  );
                }
              });
            }}
          >
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
