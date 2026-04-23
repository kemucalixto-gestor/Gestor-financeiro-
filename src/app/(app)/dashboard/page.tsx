import Link from "next/link";
import { and, asc, desc, eq, gte, lte, sum } from "drizzle-orm";
import { Plus } from "lucide-react";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthlyChart } from "@/components/charts/MonthlyChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { formatBRL } from "@/lib/money";
import {
  currentMonthKey,
  formatDateLabel,
  formatMonthLabel,
  lastNMonths,
  monthBounds,
} from "@/lib/dates";

export default async function DashboardPage() {
  const user = await requireUser();
  const month = currentMonthKey();
  const { start, end } = monthBounds(month);

  const [monthTotals, latest, cats, perCategoryMonth, history] = await Promise.all([
    db
      .select({
        type: transactions.type,
        total: sum(transactions.amountCents),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.occurredOn, start),
          lte(transactions.occurredOn, end),
        ),
      )
      .groupBy(transactions.type),

    db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
      .orderBy(desc(transactions.occurredOn), desc(transactions.createdAt))
      .limit(5),

    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),

    db
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
      .groupBy(transactions.categoryId),

    db
      .select({
        occurredOn: transactions.occurredOn,
        type: transactions.type,
        amountCents: transactions.amountCents,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.occurredOn, monthBounds(lastNMonths(6)[0]).start),
        ),
      ),
  ]);

  const income =
    Number(monthTotals.find((t) => t.type === "income")?.total ?? 0);
  const expense =
    Number(monthTotals.find((t) => t.type === "expense")?.total ?? 0);
  const balance = income - expense;

  const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));

  const pieData = perCategoryMonth
    .map((row) => ({
      name: catMap[row.categoryId]?.name ?? "—",
      color: catMap[row.categoryId]?.color ?? "#64748b",
      value: Number(row.total ?? 0) / 100,
    }))
    .sort((a, b) => b.value - a.value);

  const sixMonths = lastNMonths(6);
  const totalsByMonth: Record<string, { income: number; expense: number }> = {};
  for (const m of sixMonths) totalsByMonth[m] = { income: 0, expense: 0 };
  for (const row of history) {
    const mk = row.occurredOn.slice(0, 7);
    if (!totalsByMonth[mk]) continue;
    if (row.type === "income") totalsByMonth[mk].income += row.amountCents;
    else totalsByMonth[mk].expense += row.amountCents;
  }
  const lineData = sixMonths.map((m) => ({
    month: m,
    income: totalsByMonth[m].income / 100,
    expense: totalsByMonth[m].expense / 100,
    balance: (totalsByMonth[m].income - totalsByMonth[m].expense) / 100,
  }));

  return (
    <>
      <TopBar title={`Olá${user.name ? ", " + user.name.split(" ")[0] : ""}`} subtitle={formatMonthLabel(month)} />
      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-1 p-4">
            <p className="text-xs uppercase text-muted-foreground">Saldo do mês</p>
            <p
              className={`text-3xl font-bold ${
                balance >= 0 ? "text-income" : "text-expense"
              }`}
            >
              {formatBRL(balance)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Receitas</p>
                <p className="font-semibold text-income">{formatBRL(income)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase text-muted-foreground">Despesas</p>
                <p className="font-semibold text-expense">{formatBRL(expense)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button asChild size="lg">
          <Link href="/transactions/new">
            <Plus className="h-4 w-4" /> Novo lançamento
          </Link>
        </Button>

        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">Últimos 6 meses</p>
            <MonthlyChart data={lineData} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-semibold">Despesas por categoria</p>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma despesa neste mês.
              </p>
            ) : (
              <CategoryPieChart data={pieData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Últimos lançamentos</p>
              <Link
                href="/transactions"
                className="text-xs font-medium text-primary"
              >
                ver todos
              </Link>
            </div>
            {latest.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Você ainda não registrou lançamentos.
              </p>
            ) : (
              <ul className="divide-y">
                {latest.map((t) => {
                  const c = catMap[t.categoryId];
                  return (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-full"
                        style={{ background: c?.color ?? "#64748b" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {t.description || c?.name || "Lançamento"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateLabel(t.occurredOn)} · {c?.name ?? "—"}
                        </p>
                      </div>
                      <span
                        className={
                          t.type === "income" ? "text-income" : "text-expense"
                        }
                      >
                        {t.type === "income" ? "+" : "−"}
                        {formatBRL(t.amountCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
