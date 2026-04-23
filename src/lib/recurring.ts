import { addDays, addMonths, format, isAfter, parseISO } from "date-fns";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { recurringRules, transactions } from "@/db/schema";

function toISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function clampDayOfMonth(year: number, month: number, day: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Math.min(day, daysInMonth);
}

export function nextOccurrence(
  rule: {
    frequency: "monthly" | "weekly";
    dayOfMonth: number | null;
    dayOfWeek: number | null;
    startsOn: string;
  },
  from: Date,
): Date {
  if (rule.frequency === "monthly") {
    const day = rule.dayOfMonth ?? parseISO(rule.startsOn).getDate();
    const year = from.getFullYear();
    const monthIdx = from.getMonth();
    const clamped = clampDayOfMonth(year, monthIdx + 1, day);
    const candidate = new Date(year, monthIdx, clamped);
    if (isAfter(candidate, from) || +candidate === +from) return candidate;
    const nextMonthDate = addMonths(candidate, 1);
    const ny = nextMonthDate.getFullYear();
    const nm = nextMonthDate.getMonth();
    const nClamped = clampDayOfMonth(ny, nm + 1, day);
    return new Date(ny, nm, nClamped);
  }
  const targetDow = rule.dayOfWeek ?? parseISO(rule.startsOn).getDay();
  const diff = (targetDow - from.getDay() + 7) % 7 || 7;
  return addDays(from, diff);
}

export async function generatePendingTransactions(
  userId: string,
  today: Date = new Date(),
): Promise<number> {
  const rules = await db.query.recurringRules.findMany({
    where: eq(recurringRules.userId, userId),
  });

  const todayISO = toISO(today);
  let created = 0;

  for (const rule of rules) {
    if (rule.endsOn && rule.endsOn < todayISO) continue;

    let cursor: Date;
    if (rule.lastGeneratedOn) {
      if (rule.frequency === "monthly") {
        cursor = addMonths(parseISO(rule.lastGeneratedOn), 1);
        const day = rule.dayOfMonth ?? parseISO(rule.startsOn).getDate();
        const y = cursor.getFullYear();
        const m = cursor.getMonth();
        cursor = new Date(y, m, clampDayOfMonth(y, m + 1, day));
      } else {
        cursor = addDays(parseISO(rule.lastGeneratedOn), 7);
      }
    } else {
      cursor = parseISO(rule.startsOn);
    }

    while (toISO(cursor) <= todayISO) {
      if (rule.endsOn && toISO(cursor) > rule.endsOn) break;
      const occurredOn = toISO(cursor);

      await db.insert(transactions).values({
        userId,
        categoryId: rule.categoryId,
        type: rule.type,
        amountCents: rule.amountCents,
        description: rule.description,
        occurredOn,
        recurringRuleId: rule.id,
      });
      created++;

      await db
        .update(recurringRules)
        .set({ lastGeneratedOn: occurredOn })
        .where(eq(recurringRules.id, rule.id));

      if (rule.frequency === "monthly") {
        const nextMonth = addMonths(cursor, 1);
        const day = rule.dayOfMonth ?? parseISO(rule.startsOn).getDate();
        const y = nextMonth.getFullYear();
        const m = nextMonth.getMonth();
        cursor = new Date(y, m, clampDayOfMonth(y, m + 1, day));
      } else {
        cursor = addDays(cursor, 7);
      }
    }
  }

  return created;
}
