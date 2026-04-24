import Link from "next/link";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  isNotNull,
  lte,
  ne,
  sum,
} from "drizzle-orm";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  FileImage,
  Minus,
  PiggyBank,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { db } from "@/db/client";
import {
  accounts,
  budgets,
  categories,
  goals,
  recurringRules,
  transactions,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MonthlyChart } from "@/components/charts/MonthlyChart";
import { CategoryPieChart } from "@/components/charts/CategoryPieChart";
import { ForecastCard } from "@/components/ForecastCard";
import { forecastMonth } from "@/lib/forecast";
import { nextOccurrence } from "@/lib/recurring";
import { formatBRL } from "@/lib/money";
import {
  currentMonthKey,
  formatDateLabel,
  formatMonthLabel,
  lastNMonths,
  monthBounds,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

function greeting(name?: string | null) {
  const hour = new Date().getHours();
  const base =
    hour < 6 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const first = name?.split(" ")[0];
  return first ? `${base}, ${first}` : base;
}

export default async function DashboardPage() {
  const user = await requireUser();
  const month = currentMonthKey();
  const { start, end } = monthBounds(month);

  const sixMonths = lastNMonths(6);
  const prevMonth = sixMonths[sixMonths.length - 2];
  const { start: prevStart, end: prevEnd } = monthBounds(prevMonth);

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const sevenDaysLater = format(addDays(today, 7), "yyyy-MM-dd");

  const [
    monthTotals,
    prevMonthTotals,
    latest,
    cats,
    perCategoryMonth,
    history,
    forecast,
    allAccounts,
    accountFlow,
    monthBudgets,
    budgetSpend,
    activeGoals,
    rules,
  ] = await Promise.all([
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
          ne(transactions.type, "transfer"),
        ),
      )
      .groupBy(transactions.type),

    db
      .select({
        type: transactions.type,
        total: sum(transactions.amountCents),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          gte(transactions.occurredOn, prevStart),
          lte(transactions.occurredOn, prevEnd),
          ne(transactions.type, "transfer"),
        ),
      )
      .groupBy(transactions.type),

    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          ne(transactions.type, "transfer"),
        ),
      )
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
          ne(transactions.type, "transfer"),
          gte(transactions.occurredOn, monthBounds(sixMonths[0]).start),
        ),
      ),

    forecastMonth(user.id),

    db.query.accounts.findMany({
      where: and(eq(accounts.userId, user.id), eq(accounts.isActive, true)),
    }),

    db
      .select({
        accountId: transactions.accountId,
        type: transactions.type,
        total: sum(transactions.amountCents),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          isNotNull(transactions.accountId),
        ),
      )
      .groupBy(transactions.accountId, transactions.type),

    db.query.budgets.findMany({
      where: and(eq(budgets.userId, user.id), eq(budgets.month, month)),
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

    db.query.goals.findMany({
      where: and(eq(goals.userId, user.id), eq(goals.status, "active")),
      orderBy: [asc(goals.name)],
    }),

    db.query.recurringRules.findMany({
      where: eq(recurringRules.userId, user.id),
    }),
  ]);

  const income = Number(monthTotals.find((t) => t.type === "income")?.total ?? 0);
  const expense = Number(monthTotals.find((t) => t.type === "expense")?.total ?? 0);
  const balance = income - expense;

  const prevIncome = Number(prevMonthTotals.find((t) => t.type === "income")?.total ?? 0);
  const prevExpense = Number(prevMonthTotals.find((t) => t.type === "expense")?.total ?? 0);
  const expenseDelta = prevExpense > 0
    ? Math.round(((expense - prevExpense) / prevExpense) * 100)
    : null;
  const incomeDelta = prevIncome > 0
    ? Math.round(((income - prevIncome) / prevIncome) * 100)
    : null;

  // Net worth: soma dos saldos das contas ativas
  const balanceByAccount: Record<string, number> = {};
  for (const a of allAccounts) balanceByAccount[a.id] = a.initialBalanceCents;
  for (const f of accountFlow) {
    if (!f.accountId) continue;
    const v = Number(f.total ?? 0);
    if (f.type === "income") balanceByAccount[f.accountId] = (balanceByAccount[f.accountId] ?? 0) + v;
    else if (f.type === "expense") balanceByAccount[f.accountId] = (balanceByAccount[f.accountId] ?? 0) - v;
  }
  const netWorth = Object.values(balanceByAccount).reduce((a, b) => a + b, 0);

  const catMap = Object.fromEntries(cats.map((c) => [c.id, c]));

  const pieData = perCategoryMonth
    .map((row) => ({
      name: catMap[row.categoryId]?.name ?? "—",
      color: catMap[row.categoryId]?.color ?? "#64748b",
      value: Number(row.total ?? 0) / 100,
    }))
    .sort((a, b) => b.value - a.value);

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

  // Orçamentos em alerta (≥80%)
  const spendMap = Object.fromEntries(
    budgetSpend.map((r) => [r.categoryId, Number(r.total ?? 0)]),
  );
  const budgetAlerts = monthBudgets
    .map((b) => {
      const spent = spendMap[b.categoryId] ?? 0;
      const pct = b.limitCents > 0 ? Math.round((spent / b.limitCents) * 100) : 0;
      return {
        ...b,
        category: catMap[b.categoryId],
        spent,
        pct,
      };
    })
    .filter((b) => b.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  // Próximos vencimentos (recorrências nos próximos 7 dias)
  const upcoming: Array<{
    rule: typeof rules[number];
    date: string;
    daysUntil: number;
  }> = [];
  for (const r of rules) {
    if (r.endsOn && r.endsOn < todayISO) continue;
    const next = nextOccurrence(
      {
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth,
        dayOfWeek: r.dayOfWeek,
        startsOn: r.startsOn,
      },
      today,
    );
    const dateISO = format(next, "yyyy-MM-dd");
    if (dateISO <= sevenDaysLater) {
      upcoming.push({
        rule: r,
        date: dateISO,
        daysUntil: differenceInCalendarDays(next, today),
      });
    }
  }
  upcoming.sort((a, b) => (a.date < b.date ? -1 : 1));

  const hasAccounts = allAccounts.length > 0;

  return (
    <>
      <TopBar
        title={greeting(user.name)}
        subtitle={formatMonthLabel(month)}
      />
      <main className="flex-1 px-4 py-4 flex flex-col gap-4">
        {hasAccounts && (
          <Card>
            <CardContent className="flex flex-col gap-1 p-4">
              <p className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">
                <PiggyBank className="h-3.5 w-3.5" />
                Saldo total das contas
              </p>
              <p className={cn(
                "text-3xl font-bold",
                netWorth >= 0 ? "text-foreground" : "text-expense",
              )}>
                {formatBRL(netWorth)}
              </p>
              <p className="text-xs text-muted-foreground">
                {allAccounts.length} conta{allAccounts.length > 1 ? "s" : ""}
                {" · "}
                <Link href="/accounts" className="text-primary">
                  ver detalhes
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase text-muted-foreground">
                  Saldo do mês
                </p>
                <p className={cn(
                  "text-2xl font-bold",
                  balance >= 0 ? "text-income" : "text-expense",
                )}>
                  {formatBRL(balance)}
                </p>
              </div>
              {expenseDelta !== null && (
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">
                    Despesas vs mês passado
                  </p>
                  <p
                    className={cn(
                      "flex items-center justify-end gap-0.5 text-sm font-semibold",
                      expenseDelta > 0 ? "text-expense" : expenseDelta < 0 ? "text-income" : "text-muted-foreground",
                    )}
                  >
                    {expenseDelta > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : expenseDelta < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {Math.abs(expenseDelta)}%
                  </p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <p className="flex items-center gap-1 text-[11px] uppercase text-muted-foreground">
                  <ArrowDownRight className="h-3 w-3 text-income" />
                  Receitas
                </p>
                <p className="font-semibold text-income">{formatBRL(income)}</p>
                {incomeDelta !== null && (
                  <p className="text-[10px] text-muted-foreground">
                    {incomeDelta > 0 ? "+" : ""}
                    {incomeDelta}% vs mês passado
                  </p>
                )}
              </div>
              <div>
                <p className="flex items-center gap-1 text-[11px] uppercase text-muted-foreground">
                  <ArrowUpRight className="h-3 w-3 text-expense" />
                  Despesas
                </p>
                <p className="font-semibold text-expense">{formatBRL(expense)}</p>
                {expenseDelta !== null && (
                  <p className="text-[10px] text-muted-foreground">
                    {expenseDelta > 0 ? "+" : ""}
                    {expenseDelta}% vs mês passado
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-2">
          <Button asChild size="lg" className="h-14">
            <Link href="/transactions/new">
              <Plus className="h-5 w-5" />
              Novo lançamento
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-14">
            <Link href="/transactions/import">
              <FileImage className="h-5 w-5" />
              Importar extrato
            </Link>
          </Button>
        </div>

        <ForecastCard forecast={forecast} />

        {budgetAlerts.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Orçamentos em alerta</p>
                <Link
                  href="/budgets"
                  className="text-xs font-medium text-primary"
                >
                  ver todos
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {budgetAlerts.map((b) => {
                  const over = b.pct >= 100;
                  return (
                    <div key={b.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: b.category?.color ?? "#64748b" }}
                        />
                        <span className="flex-1 font-medium">
                          {b.category?.name ?? "—"}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            over ? "text-destructive" : "text-amber-600",
                          )}
                        >
                          {b.pct}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, b.pct)}
                        indicatorClassName={over ? "bg-destructive" : "bg-amber-500"}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {formatBRL(b.spent)} de {formatBRL(b.limitCents)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {activeGoals.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Target className="h-4 w-4" />
                  Metas ativas
                </p>
                <Link
                  href="/goals"
                  className="text-xs font-medium text-primary"
                >
                  ver todas
                </Link>
              </div>
              <div className="flex flex-col gap-3">
                {activeGoals.slice(0, 3).map((g) => {
                  const pct =
                    g.targetCents > 0
                      ? Math.min(
                          100,
                          Math.round((g.currentCents / g.targetCents) * 100),
                        )
                      : 0;
                  return (
                    <div key={g.id} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: g.color }}
                        />
                        <span className="flex-1 truncate font-medium">
                          {g.name}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                      <Progress value={pct} indicatorClassName="bg-primary" />
                      <p className="text-[11px] text-muted-foreground">
                        {formatBRL(g.currentCents)} de {formatBRL(g.targetCents)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {upcoming.length > 0 && (
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <CalendarClock className="h-4 w-4" />
                  Próximos 7 dias
                </p>
                <Link
                  href="/recurring"
                  className="text-xs font-medium text-primary"
                >
                  recorrências
                </Link>
              </div>
              <ul className="divide-y">
                {upcoming.slice(0, 5).map((u, i) => {
                  const cat = catMap[u.rule.categoryId];
                  const label =
                    u.daysUntil === 0
                      ? "hoje"
                      : u.daysUntil === 1
                        ? "amanhã"
                        : `em ${u.daysUntil} dias`;
                  return (
                    <li
                      key={i}
                      className="flex items-center gap-3 py-2 text-sm"
                    >
                      <span
                        className="h-8 w-8 shrink-0 rounded-full"
                        style={{ background: cat?.color ?? "#64748b" }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">
                          {u.rule.description || cat?.name || "Recorrência"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(u.date), "dd 'de' MMM", {
                            locale: ptBR,
                          })}
                          {" · "}
                          {label}
                        </p>
                      </div>
                      <span
                        className={
                          u.rule.type === "income" ? "text-income" : "text-expense"
                        }
                      >
                        {u.rule.type === "income" ? "+" : "−"}
                        {formatBRL(u.rule.amountCents)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        )}

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
