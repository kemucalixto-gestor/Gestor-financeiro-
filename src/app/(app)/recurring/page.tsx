import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, recurringRules } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { RecurringManager } from "./recurring-manager";

export default async function RecurringPage() {
  const user = await requireUser();
  const [rules, cats] = await Promise.all([
    db.query.recurringRules.findMany({
      where: eq(recurringRules.userId, user.id),
      orderBy: [asc(recurringRules.description)],
    }),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
      orderBy: [asc(categories.name)],
    }),
  ]);

  return (
    <>
      <TopBar title="Recorrências" subtitle="Salário, aluguel, assinaturas..." />
      <main className="flex-1 px-4 py-4">
        <RecurringManager initial={rules} categories={cats} />
      </main>
    </>
  );
}
