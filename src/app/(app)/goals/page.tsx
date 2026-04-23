import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { goals } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { GoalsManager } from "./goals-manager";

export default async function GoalsPage() {
  const user = await requireUser();
  const list = await db.query.goals.findMany({
    where: eq(goals.userId, user.id),
    orderBy: [asc(goals.name)],
  });

  return (
    <>
      <TopBar title="Metas" subtitle="Junte dinheiro para seus objetivos" />
      <main className="flex-1 px-4 py-4">
        <GoalsManager initial={list} />
      </main>
    </>
  );
}
