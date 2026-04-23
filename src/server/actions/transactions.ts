"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";

const transactionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["income", "expense"]),
  amountCents: z.number().int().positive("Valor deve ser maior que zero"),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  description: z.string().max(200).default(""),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  attachmentUrl: z
    .string()
    .url()
    .max(500)
    .nullable()
    .optional(),
});

export async function saveTransaction(
  input: z.infer<typeof transactionSchema>,
) {
  const user = await requireUser();
  const data = transactionSchema.parse(input);

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, data.categoryId),
      eq(categories.userId, user.id),
    ),
  });
  if (!category) throw new Error("Categoria inválida");
  if (category.type !== data.type) {
    throw new Error("O tipo da categoria não bate com o da transação");
  }

  if (data.id) {
    await db
      .update(transactions)
      .set({
        type: data.type,
        amountCents: data.amountCents,
        categoryId: data.categoryId,
        description: data.description,
        occurredOn: data.occurredOn,
        attachmentUrl: data.attachmentUrl ?? null,
      })
      .where(
        and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
      );
  } else {
    await db.insert(transactions).values({
      userId: user.id,
      type: data.type,
      amountCents: data.amountCents,
      categoryId: data.categoryId,
      description: data.description,
      occurredOn: data.occurredOn,
      attachmentUrl: data.attachmentUrl ?? null,
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}

export async function deleteTransaction(id: string) {
  const user = await requireUser();
  await db
    .delete(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
}
