"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
import { Paperclip, Pencil, Trash2 } from "lucide-react";
import type { Category, Transaction } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";
import { formatDateLabel } from "@/lib/dates";
import { deleteTransaction } from "@/server/actions/transactions";
import { useRouter } from "next/navigation";

export function TransactionsList({
  items,
  categories,
}: {
  items: Transaction[];
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.id, c])),
    [categories],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of items) {
      const list = map.get(t.occurredOn) ?? [];
      list.push(t);
      map.set(t.occurredOn, list);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0,
    );
  }, [items]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of items) {
      if (t.type === "income") income += t.amountCents;
      else expense += t.amountCents;
    }
    return { income, expense, balance: income - expense };
  }, [items]);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
          <p>Nenhum lançamento neste mês.</p>
          <Button asChild variant="outline">
            <Link href="/transactions/new">Adicionar o primeiro</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-3 gap-3 p-4 text-center">
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Receitas</p>
            <p className="text-sm font-semibold text-income">
              {formatBRL(totals.income)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Despesas</p>
            <p className="text-sm font-semibold text-expense">
              {formatBRL(totals.expense)}
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Saldo</p>
            <p
              className={`text-sm font-semibold ${
                totals.balance >= 0 ? "text-income" : "text-expense"
              }`}
            >
              {formatBRL(totals.balance)}
            </p>
          </div>
        </CardContent>
      </Card>

      {grouped.map(([date, txs]) => (
        <section key={date} className="flex flex-col gap-2">
          <h3 className="px-1 text-xs font-semibold uppercase text-muted-foreground">
            {formatDateLabel(date)}
          </h3>
          {txs.map((t) => {
            const cat = categoryMap[t.categoryId];
            return (
              <Card key={t.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <span
                    className="h-10 w-10 shrink-0 rounded-full"
                    style={{ background: cat?.color ?? "#64748b" }}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0">
                    <p className="flex items-center gap-1.5 truncate font-medium">
                      {t.description || cat?.name || "Lançamento"}
                      {t.attachmentUrl && (
                        <a
                          href={t.attachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Ver comprovante"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0 text-primary" />
                        </a>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {cat?.name ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`font-semibold ${
                        t.type === "income" ? "text-income" : "text-expense"
                      }`}
                    >
                      {t.type === "income" ? "+" : "−"}
                      {formatBRL(t.amountCents)}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                  >
                    <Link href={`/transactions/${t.id}/edit`}>
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    disabled={pending}
                    onClick={() => {
                      if (!confirm("Excluir este lançamento?")) return;
                      startTransition(async () => {
                        await deleteTransaction(t.id);
                        router.refresh();
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}
