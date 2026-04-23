"use server";

import { and, asc, desc, eq, gte, ne } from "drizzle-orm";
import { subMonths } from "date-fns";
import { db } from "@/db/client";
import { categories, recurringRules, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";

export interface SubscriptionSuggestion {
  description: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  dayOfMonth: number;
  occurrencesFound: number;
  sampleDates: string[];
}

export async function detectSubscriptions(): Promise<SubscriptionSuggestion[]> {
  const user = await requireUser();
  const since = subMonths(new Date(), 4).toISOString().slice(0, 10);

  const [tx, cats, rules] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.type, "expense"),
          ne(transactions.type, "transfer"),
          gte(transactions.occurredOn, since),
        ),
      )
      .orderBy(desc(transactions.occurredOn)),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),
    db.query.recurringRules.findMany({
      where: eq(recurringRules.userId, user.id),
    }),
  ]);

  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  // Agrupa por (descrição normalizada + valor em centavos)
  type Bucket = {
    description: string;
    amountCents: number;
    categoryId: string;
    dates: string[];
    days: number[];
  };
  const buckets = new Map<string, Bucket>();

  for (const t of tx) {
    const key = `${(t.description || "").trim().toLowerCase()}|${t.amountCents}`;
    const day = Number(t.occurredOn.slice(8, 10));
    const existing = buckets.get(key);
    if (existing) {
      existing.dates.push(t.occurredOn);
      existing.days.push(day);
    } else {
      buckets.set(key, {
        description: t.description || catMap[t.categoryId] || "Assinatura",
        amountCents: t.amountCents,
        categoryId: t.categoryId,
        dates: [t.occurredOn],
        days: [day],
      });
    }
  }

  // Filtra buckets com 2+ ocorrências em meses diferentes, dia próximo (±3)
  const suggestions: SubscriptionSuggestion[] = [];
  for (const b of buckets.values()) {
    if (b.dates.length < 2) continue;
    const uniqueMonths = new Set(b.dates.map((d) => d.slice(0, 7)));
    if (uniqueMonths.size < 2) continue;

    const avgDay = Math.round(
      b.days.reduce((a, c) => a + c, 0) / b.days.length,
    );
    const maxDiff = Math.max(...b.days.map((d) => Math.abs(d - avgDay)));
    if (maxDiff > 5) continue;

    const description = b.description || "Assinatura";
    // Ignora se já existe recorrência igual (mesmo valor + categoria + dia próximo)
    const alreadyExists = rules.some(
      (r) =>
        r.type === "expense" &&
        r.categoryId === b.categoryId &&
        r.amountCents === b.amountCents &&
        r.frequency === "monthly" &&
        r.dayOfMonth != null &&
        Math.abs(r.dayOfMonth - avgDay) <= 3,
    );
    if (alreadyExists) continue;

    suggestions.push({
      description,
      categoryId: b.categoryId,
      categoryName: catMap[b.categoryId] ?? "",
      amountCents: b.amountCents,
      dayOfMonth: avgDay,
      occurrencesFound: b.dates.length,
      sampleDates: b.dates.slice(0, 3),
    });
  }

  suggestions.sort((a, b) => b.occurrencesFound - a.occurrencesFound);
  return suggestions.slice(0, 10);
}
