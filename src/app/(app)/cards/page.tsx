import { and, asc, eq, gte, lte, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { creditCards, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { CardsManager } from "./cards-manager";
import { currentMonthKey, monthBounds } from "@/lib/dates";

export default async function CardsPage() {
  const user = await requireUser();
  const list = await db.query.creditCards.findMany({
    where: eq(creditCards.userId, user.id),
    orderBy: [asc(creditCards.name)],
  });

  // Total atual do mês por cartão
  const { start, end } = monthBounds(currentMonthKey());
  const monthUsage = await db
    .select({
      cardId: transactions.creditCardId,
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
    .groupBy(transactions.creditCardId);

  const usageMap = Object.fromEntries(
    monthUsage
      .filter((r) => r.cardId)
      .map((r) => [r.cardId as string, Number(r.total ?? 0)]),
  );

  return (
    <>
      <TopBar title="Cartões de crédito" subtitle="Faturas e limites" />
      <main className="flex-1 px-4 py-4">
        <CardsManager initial={list} monthUsage={usageMap} />
      </main>
    </>
  );
}
