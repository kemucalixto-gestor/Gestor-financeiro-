import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accounts,
  categories,
  creditCards,
  goals,
  transactions,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { TransactionForm } from "@/components/TransactionForm";

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [tx, cats, accs, cards, gls] = await Promise.all([
    db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),
    db.query.accounts.findMany({
      where: and(eq(accounts.userId, user.id), eq(accounts.isActive, true)),
      orderBy: [asc(accounts.name)],
    }),
    db.query.creditCards.findMany({
      where: and(
        eq(creditCards.userId, user.id),
        eq(creditCards.isActive, true),
      ),
      orderBy: [asc(creditCards.name)],
    }),
    db.query.goals.findMany({
      where: and(eq(goals.userId, user.id), eq(goals.status, "active")),
      orderBy: [asc(goals.name)],
    }),
  ]);

  if (!tx) notFound();

  return (
    <>
      <TopBar title="Editar lançamento" />
      <main className="flex-1 px-4 py-4">
        <TransactionForm
          categories={cats}
          accounts={accs}
          creditCards={cards}
          goals={gls}
          initial={tx}
        />
      </main>
    </>
  );
}
