import { and, eq, gte, lte, sum } from "drizzle-orm";
import { parseISO, differenceInCalendarDays, endOfMonth } from "date-fns";
import { db } from "@/db/client";
import { recurringRules, transactions } from "@/db/schema";
import { monthBounds, currentMonthKey } from "./dates";
import { nextOccurrence } from "./recurring";

export interface MonthForecast {
  monthIncome: number;
  monthExpense: number;
  recurringIncomePending: number;
  recurringExpensePending: number;
  projectedExpenseExtra: number;
  projectedBalance: number;
  daysRemaining: number;
  daysElapsed: number;
}

export async function forecastMonth(
  userId: string,
  reference = new Date(),
): Promise<MonthForecast> {
  const month = currentMonthKey(reference);
  const { start, end } = monthBounds(month);
  const today = reference.toISOString().slice(0, 10);

  // Totais do mês atual até hoje
  const monthly = await db
    .select({ type: transactions.type, total: sum(transactions.amountCents) })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    )
    .groupBy(transactions.type);

  const monthIncome = Number(monthly.find((m) => m.type === "income")?.total ?? 0);
  const monthExpense = Number(monthly.find((m) => m.type === "expense")?.total ?? 0);

  // Recorrências pendentes até o fim do mês
  const rules = await db.query.recurringRules.findMany({
    where: eq(recurringRules.userId, userId),
  });
  let recurringIncomePending = 0;
  let recurringExpensePending = 0;
  const todayDate = parseISO(today);
  const endDate = parseISO(end);
  for (const r of rules) {
    if (r.endsOn && r.endsOn < today) continue;
    let cursor = nextOccurrence(
      { frequency: r.frequency, dayOfMonth: r.dayOfMonth, dayOfWeek: r.dayOfWeek, startsOn: r.startsOn },
      todayDate,
    );
    while (cursor <= endDate) {
      if (r.type === "income") recurringIncomePending += r.amountCents;
      else recurringExpensePending += r.amountCents;
      // advance
      if (r.frequency === "monthly") {
        const next = new Date(cursor);
        next.setMonth(next.getMonth() + 1);
        cursor = next;
      } else {
        const next = new Date(cursor);
        next.setDate(next.getDate() + 7);
        cursor = next;
      }
    }
  }

  const lastDay = endOfMonth(reference);
  const daysRemaining = Math.max(0, differenceInCalendarDays(lastDay, reference));
  const daysElapsed = Math.max(1, differenceInCalendarDays(reference, parseISO(start)) + 1);

  // Projeção de gasto não-recorrente: média diária do mês × dias restantes
  const recurringExpenseThisMonth = await db
    .select({ total: sum(transactions.amountCents) })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end),
      ),
    );
  const _recurringExpenseTotal = Number(recurringExpenseThisMonth[0]?.total ?? 0);
  const nonRecurringDaily = Math.max(0, monthExpense / daysElapsed);
  const projectedExpenseExtra = Math.round(nonRecurringDaily * daysRemaining);

  const projectedBalance =
    monthIncome + recurringIncomePending - monthExpense - recurringExpensePending - projectedExpenseExtra;

  return {
    monthIncome,
    monthExpense,
    recurringIncomePending,
    recurringExpensePending,
    projectedExpenseExtra,
    projectedBalance,
    daysRemaining,
    daysElapsed,
  };
}
