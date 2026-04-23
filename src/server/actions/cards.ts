"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { creditCards } from "@/db/schema";
import { requireUser } from "@/lib/session";

const cardSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  brand: z
    .enum(["visa", "master", "elo", "amex", "hiper", "other"])
    .default("other"),
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  limitCents: z.number().int().nonnegative().default(0),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#111827"),
});

export async function saveCard(input: z.infer<typeof cardSchema>) {
  const user = await requireUser();
  const data = cardSchema.parse(input);
  if (data.id) {
    await db
      .update(creditCards)
      .set({
        name: data.name,
        brand: data.brand,
        closingDay: data.closingDay,
        dueDay: data.dueDay,
        limitCents: data.limitCents,
        color: data.color,
      })
      .where(
        and(eq(creditCards.id, data.id), eq(creditCards.userId, user.id)),
      );
  } else {
    await db.insert(creditCards).values({
      userId: user.id,
      name: data.name,
      brand: data.brand,
      closingDay: data.closingDay,
      dueDay: data.dueDay,
      limitCents: data.limitCents,
      color: data.color,
    });
  }
  revalidatePath("/cards");
  revalidatePath("/transactions/new");
}

export async function deleteCard(id: string) {
  const user = await requireUser();
  await db
    .delete(creditCards)
    .where(and(eq(creditCards.id, id), eq(creditCards.userId, user.id)));
  revalidatePath("/cards");
}
