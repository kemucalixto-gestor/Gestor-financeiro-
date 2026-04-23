import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
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

  const [tx, cats] = await Promise.all([
    db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),
  ]);

  if (!tx) notFound();

  return (
    <>
      <TopBar title="Editar lançamento" />
      <main className="flex-1 px-4 py-4">
        <TransactionForm categories={cats} initial={tx} />
      </main>
    </>
  );
}
