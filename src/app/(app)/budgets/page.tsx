import { and, asc, eq, gte, lte, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { budgets, categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { BudgetsView } from "./budgets-view";
import {
  currentMonthKey,
  formatMonthLabel,
  lastNMonths,
  monthBounds,
} from "@/lib/dates";
import { MonthSelect } from "@/components/MonthSelect";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: raw } = await searchParams;
  const month = raw ?? currentMonthKey();
  const { start, end } = monthBounds(month);

  const expenseCategories = await db.query.categories.findMany({
    where: and(eq(categories.userId, user.id), eq(categories.type, "expense")),
    orderBy: [asc(categories.name)],
  });

  const monthBudgets = await db.query.budgets.findMany({
    where: and(eq(budgets.userId, user.id), eq(budgets.month, month)),
  });

  const spent = await db
    .select({
      categoryId: transactions.categoryId,
      total: sum(transactions.amountCents),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, user.id),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    )
    .groupBy(transactions.categoryId);

  const spentMap = Object.fromEntries(
    spent.map((r) => [r.categoryId, Number(r.total ?? 0)]),
  );
  const budgetMap = Object.fromEntries(
    monthBudgets.map((b) => [b.categoryId, b.limitCents]),
  );

  const rows = expenseCategories.map((c) => ({
    category: c,
    limitCents: budgetMap[c.id] ?? 0,
    spentCents: spentMap[c.id] ?? 0,
  }));

  return (
    <>
      <TopBar title="Orçamentos" subtitle={formatMonthLabel(month)} />
      <main className="flex-1 px-4 py-4">
        <div className="mb-3">
          <MonthSelect value={month} options={lastNMonths(12)} />
        </div>
        <BudgetsView rows={rows} month={month} />
      </main>
    </>
  );
}
