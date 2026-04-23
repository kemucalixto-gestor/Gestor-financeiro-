"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { goals } from "@/db/schema";
import { requireUser } from "@/lib/session";

const goalSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  targetCents: z.number().int().positive(),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#22c55e"),
  status: z.enum(["active", "completed", "cancelled"]).default("active"),
});

export async function saveGoal(input: z.infer<typeof goalSchema>) {
  const user = await requireUser();
  const data = goalSchema.parse(input);
  if (data.id) {
    await db
      .update(goals)
      .set({
        name: data.name,
        targetCents: data.targetCents,
        targetDate: data.targetDate ?? null,
        color: data.color,
        status: data.status,
      })
      .where(and(eq(goals.id, data.id), eq(goals.userId, user.id)));
  } else {
    await db.insert(goals).values({
      userId: user.id,
      name: data.name,
      targetCents: data.targetCents,
      targetDate: data.targetDate ?? null,
      color: data.color,
    });
  }
  revalidatePath("/goals");
  revalidatePath("/transactions/new");
}

export async function deleteGoal(id: string) {
  const user = await requireUser();
  await db
    .delete(goals)
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)));
  revalidatePath("/goals");
}
