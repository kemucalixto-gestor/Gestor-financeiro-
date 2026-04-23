"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { budgets, categories } from "@/db/schema";
import { requireUser } from "@/lib/session";

const budgetSchema = z.object({
  categoryId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  limitCents: z.number().int().nonnegative(),
});

export async function saveBudget(input: z.infer<typeof budgetSchema>) {
  const user = await requireUser();
  const data = budgetSchema.parse(input);

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, data.categoryId),
      eq(categories.userId, user.id),
    ),
  });
  if (!category) throw new Error("Categoria inválida");

  const existing = await db.query.budgets.findFirst({
    where: and(
      eq(budgets.userId, user.id),
      eq(budgets.categoryId, data.categoryId),
      eq(budgets.month, data.month),
    ),
  });

  if (data.limitCents === 0) {
    if (existing) {
      await db.delete(budgets).where(eq(budgets.id, existing.id));
    }
  } else if (existing) {
    await db
      .update(budgets)
      .set({ limitCents: data.limitCents })
      .where(eq(budgets.id, existing.id));
  } else {
    await db.insert(budgets).values({
      userId: user.id,
      categoryId: data.categoryId,
      month: data.month,
      limitCents: data.limitCents,
    });
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
}
