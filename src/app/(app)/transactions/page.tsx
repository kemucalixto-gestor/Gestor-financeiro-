import Link from "next/link";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { TransactionsList } from "./transactions-list";
import { MonthSelect } from "@/components/MonthSelect";
import { currentMonthKey, formatMonthLabel, lastNMonths, monthBounds } from "@/lib/dates";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: rawMonth } = await searchParams;
  const month = rawMonth ?? currentMonthKey();
  const { start, end } = monthBounds(month);

  const [tx, cats] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.occurredOn, start),
          lte(transactions.occurredOn, end),
        ),
      )
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt)),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),
  ]);

  const options = lastNMonths(12);

  return (
    <>
      <TopBar title="Lançamentos" subtitle={formatMonthLabel(month)} />
      <main className="flex-1 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <MonthSelect value={month} options={options} />
          <Button asChild>
            <Link href="/transactions/new" aria-label="Novo lançamento">
              <Plus className="h-4 w-4" />
              Novo
            </Link>
          </Button>
        </div>
        <TransactionsList items={tx} categories={cats} />
      </main>
    </>
  );
}
