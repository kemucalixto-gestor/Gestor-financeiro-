"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";

const upsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  icon: z.string().max(40).default("circle"),
});

export async function saveCategory(input: z.infer<typeof upsertSchema>) {
  const user = await requireUser();
  const data = upsertSchema.parse(input);

  if (data.id) {
    await db
      .update(categories)
      .set({
        name: data.name,
        type: data.type,
        color: data.color,
        icon: data.icon,
      })
      .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)));
  } else {
    await db.insert(categories).values({
      userId: user.id,
      name: data.name,
      type: data.type,
      color: data.color,
      icon: data.icon,
    });
  }
  revalidatePath("/categories");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
}

export async function deleteCategory(id: string) {
  const user = await requireUser();
  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)));
  revalidatePath("/categories");
}
