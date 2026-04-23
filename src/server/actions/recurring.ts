"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { categories, recurringRules } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { generatePendingTransactions } from "@/lib/recurring";

const ruleSchema = z
  .object({
    id: z.string().optional(),
    type: z.enum(["income", "expense"]),
    categoryId: z.string().min(1),
    amountCents: z.number().int().positive(),
    description: z.string().max(200).default(""),
    frequency: z.enum(["monthly", "weekly"]),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endsOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .refine(
    (d) =>
      d.frequency === "monthly" ? d.dayOfMonth != null : d.dayOfWeek != null,
    { message: "Informe o dia da recorrência" },
  );

export async function saveRecurring(input: z.infer<typeof ruleSchema>) {
  const user = await requireUser();
  const data = ruleSchema.parse(input);

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, data.categoryId),
      eq(categories.userId, user.id),
    ),
  });
  if (!category) throw new Error("Categoria inválida");

  if (data.id) {
    await db
      .update(recurringRules)
      .set({
        type: data.type,
        categoryId: data.categoryId,
        amountCents: data.amountCents,
        description: data.description,
        frequency: data.frequency,
        dayOfMonth: data.dayOfMonth ?? null,
        dayOfWeek: data.dayOfWeek ?? null,
        startsOn: data.startsOn,
        endsOn: data.endsOn ?? null,
      })
      .where(
        and(eq(recurringRules.id, data.id), eq(recurringRules.userId, user.id)),
      );
  } else {
    await db.insert(recurringRules).values({
      userId: user.id,
      type: data.type,
      categoryId: data.categoryId,
      amountCents: data.amountCents,
      description: data.description,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      startsOn: data.startsOn,
      endsOn: data.endsOn ?? null,
    });
  }

  await generatePendingTransactions(user.id);

  revalidatePath("/recurring");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
}

export async function deleteRecurring(id: string) {
  const user = await requireUser();
  await db
    .delete(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)));
  revalidatePath("/recurring");
}
