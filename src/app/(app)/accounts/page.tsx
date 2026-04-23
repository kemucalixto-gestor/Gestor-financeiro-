import { and, asc, eq, sum } from "drizzle-orm";
import { db } from "@/db/client";
import { accounts, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { AccountsManager } from "./accounts-manager";

export default async function AccountsPage() {
  const user = await requireUser();
  const list = await db.query.accounts.findMany({
    where: eq(accounts.userId, user.id),
    orderBy: [asc(accounts.name)],
  });

  // Calcula saldo por conta: balance = initial + income - expense (ignora transfers de forma líquida)
  const balances: Record<string, number> = {};
  for (const a of list) balances[a.id] = a.initialBalanceCents;

  const incomeByAcc = await db
    .select({
      accountId: transactions.accountId,
      total: sum(transactions.amountCents),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), eq(transactions.type, "income")))
    .groupBy(transactions.accountId);
  for (const r of incomeByAcc) {
    if (r.accountId) balances[r.accountId] = (balances[r.accountId] ?? 0) + Number(r.total ?? 0);
  }

  const expenseByAcc = await db
    .select({
      accountId: transactions.accountId,
      total: sum(transactions.amountCents),
    })
    .from(transactions)
    .where(and(eq(transactions.userId, user.id), eq(transactions.type, "expense")))
    .groupBy(transactions.accountId);
  for (const r of expenseByAcc) {
    if (r.accountId) balances[r.accountId] = (balances[r.accountId] ?? 0) - Number(r.total ?? 0);
  }

  return (
    <>
      <TopBar title="Contas" subtitle="Conta corrente, poupança, dinheiro..." />
      <main className="flex-1 px-4 py-4">
        <AccountsManager initial={list} balances={balances} />
      </main>
    </>
  );
}
