import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, categories, creditCards } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { StatementImporter } from "./statement-importer";

export default async function ImportStatementPage() {
  const user = await requireUser();
  const [cats, accs, cards] = await Promise.all([
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
  ]);

  return (
    <>
      <TopBar
        title="Importar extrato"
        subtitle="Mande um print e a IA extrai tudo"
      />
      <main className="flex-1 px-4 py-4">
        <StatementImporter categories={cats} accounts={accs} creditCards={cards} />
      </main>
    </>
  );
}
