import Link from "next/link";
import { and, asc, desc, eq, gte, like, lte, or } from "drizzle-orm";
import { Download, Plus } from "lucide-react";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { TransactionsList } from "./transactions-list";
import { MonthSelect } from "@/components/MonthSelect";
import { TransactionsFilter } from "./transactions-filter";
import {
  currentMonthKey,
  formatMonthLabel,
  lastNMonths,
  monthBounds,
} from "@/lib/dates";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    q?: string;
    type?: string;
    category?: string;
  }>;
}) {
  const user = await requireUser();
  const { month: rawMonth, q, type, category } = await searchParams;
  const month = rawMonth ?? currentMonthKey();
  const { start, end } = monthBounds(month);

  const where = [
    eq(transactions.userId, user.id),
    gte(transactions.occurredOn, start),
    lte(transactions.occurredOn, end),
  ];
  if (type === "income" || type === "expense" || type === "transfer") {
    where.push(eq(transactions.type, type));
  }
  if (category) {
    where.push(eq(transactions.categoryId, category));
  }
  if (q && q.trim()) {
    const pat = `%${q.trim()}%`;
    const orExpr = or(
      like(transactions.description, pat),
      like(transactions.tagsJson, pat),
    );
    if (orExpr) where.push(orExpr);
  }

  const [tx, cats] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(...where))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt)),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),
  ]);

  const options = lastNMonths(12);

  const exportParams = new URLSearchParams({ month });
  if (type) exportParams.set("type", type);
  if (category) exportParams.set("category", category);

  return (
    <>
      <TopBar title="Lançamentos" subtitle={formatMonthLabel(month)} />
      <main className="flex-1 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <MonthSelect value={month} options={options} />
          <Button asChild size="icon" variant="outline" aria-label="Exportar CSV">
            <a href={`/api/export/transactions?${exportParams.toString()}`}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
          <Button asChild>
            <Link href="/transactions/new" aria-label="Novo lançamento">
              <Plus className="h-4 w-4" />
              Novo
            </Link>
          </Button>
        </div>

        <TransactionsFilter
          categories={cats}
          currentQ={q ?? ""}
          currentType={type ?? ""}
          currentCategory={category ?? ""}
          month={month}
        />

        <div className="mt-3">
          <TransactionsList items={tx} categories={cats} />
        </div>
      </main>
    </>
  );
}
