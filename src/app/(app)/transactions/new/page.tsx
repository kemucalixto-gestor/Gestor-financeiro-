import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { TransactionForm } from "@/components/TransactionForm";

export default async function NewTransactionPage() {
  const user = await requireUser();
  const cats = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
    orderBy: [asc(categories.name)],
  });

  return (
    <>
      <TopBar title="Novo lançamento" />
      <main className="flex-1 px-4 py-4">
        <TransactionForm categories={cats} />
      </main>
    </>
  );
}
