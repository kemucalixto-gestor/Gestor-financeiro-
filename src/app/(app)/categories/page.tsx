import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { TopBar } from "@/components/TopBar";
import { CategoriesManager } from "./categories-manager";

export default async function CategoriesPage() {
  const user = await requireUser();
  const list = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
    orderBy: [asc(categories.type), asc(categories.name)],
  });

  return (
    <>
      <TopBar title="Categorias" subtitle="Organize seus lançamentos" />
      <main className="flex-1 px-4 py-4">
        <CategoriesManager initial={list} />
      </main>
    </>
  );
}
