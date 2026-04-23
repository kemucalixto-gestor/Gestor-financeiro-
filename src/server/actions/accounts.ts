"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import { accounts } from "@/db/schema";
import { requireUser } from "@/lib/session";

const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1).max(40),
  type: z
    .enum(["checking", "savings", "cash", "digital_wallet", "other"])
    .default("checking"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563eb"),
  initialBalanceCents: z.number().int().default(0),
});

export async function saveAccount(input: z.infer<typeof accountSchema>) {
  const user = await requireUser();
  const data = accountSchema.parse(input);
  if (data.id) {
    await db
      .update(accounts)
      .set({
        name: data.name,
        type: data.type,
        color: data.color,
        initialBalanceCents: data.initialBalanceCents,
      })
      .where(and(eq(accounts.id, data.id), eq(accounts.userId, user.id)));
  } else {
    await db.insert(accounts).values({
      userId: user.id,
      name: data.name,
      type: data.type,
      color: data.color,
      initialBalanceCents: data.initialBalanceCents,
    });
  }
  revalidatePath("/accounts");
  revalidatePath("/transactions/new");
  revalidatePath("/dashboard");
}

export async function deleteAccount(id: string) {
  const user = await requireUser();
  await db
    .delete(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)));
  revalidatePath("/accounts");
}
