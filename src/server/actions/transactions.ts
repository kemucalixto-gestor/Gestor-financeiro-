"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import {
  accounts,
  categories,
  creditCards,
  goals,
  recurringRules,
  transactions,
} from "@/db/schema";
import { requireUser } from "@/lib/session";
import { stringifyTags } from "@/lib/tags";

const recurringOptionSchema = z
  .object({
    frequency: z.enum(["monthly", "weekly"]),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  })
  .refine(
    (d) =>
      d.frequency === "monthly" ? d.dayOfMonth != null : d.dayOfWeek != null,
    { message: "Informe o dia da recorrência" },
  );

const transactionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["income", "expense"]),
  amountCents: z.number().int().positive("Valor deve ser maior que zero"),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  description: z.string().max(200).default(""),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  attachmentUrl: z.string().url().max(500).nullable().optional(),
  accountId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
  goalId: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  installmentTotal: z.number().int().min(1).max(48).nullable().optional(),
  createRecurring: recurringOptionSchema.nullable().optional(),
});

function addMonthsISO(iso: string, months: number): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d.toISOString().slice(0, 10);
}

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

  if (data.accountId) {
    const a = await db.query.accounts.findFirst({
      where: and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)),
    });
    if (!a) throw new Error("Conta inválida");
  }
  if (data.creditCardId) {
    const c = await db.query.creditCards.findFirst({
      where: and(
        eq(creditCards.id, data.creditCardId),
        eq(creditCards.userId, user.id),
      ),
    });
    if (!c) throw new Error("Cartão inválido");
  }
  if (data.goalId) {
    const g = await db.query.goals.findFirst({
      where: and(eq(goals.id, data.goalId), eq(goals.userId, user.id)),
    });
    if (!g) throw new Error("Meta inválida");
  }

  const tagsJson = stringifyTags(data.tags ?? undefined);

  const installments = data.installmentTotal ?? 1;

  if (data.id) {
    await db
      .update(transactions)
      .set({
        type: data.type,
        amountCents: data.amountCents,
        categoryId: data.categoryId,
        accountId: data.accountId ?? null,
        creditCardId: data.creditCardId ?? null,
        goalId: data.goalId ?? null,
        description: data.description,
        occurredOn: data.occurredOn,
        attachmentUrl: data.attachmentUrl ?? null,
        tagsJson,
      })
      .where(
        and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
      );
  } else if (installments <= 1) {
    await db.insert(transactions).values({
      userId: user.id,
      type: data.type,
      amountCents: data.amountCents,
      categoryId: data.categoryId,
      accountId: data.accountId ?? null,
      creditCardId: data.creditCardId ?? null,
      goalId: data.goalId ?? null,
      description: data.description,
      occurredOn: data.occurredOn,
      attachmentUrl: data.attachmentUrl ?? null,
      tagsJson,
    });
  } else {
    // Parcelamento: divide valor em N meses
    const groupId = crypto.randomUUID();
    const baseDesc = data.description || category.name;
    const per = Math.floor(data.amountCents / installments);
    const remainder = data.amountCents - per * installments;
    for (let i = 0; i < installments; i++) {
      const amount = per + (i === 0 ? remainder : 0);
      await db.insert(transactions).values({
        userId: user.id,
        type: data.type,
        amountCents: amount,
        categoryId: data.categoryId,
        accountId: data.accountId ?? null,
        creditCardId: data.creditCardId ?? null,
        goalId: data.goalId ?? null,
        description: `${baseDesc} (${i + 1}/${installments})`,
        occurredOn: addMonthsISO(data.occurredOn, i),
        attachmentUrl: i === 0 ? (data.attachmentUrl ?? null) : null,
        tagsJson,
        installmentGroupId: groupId,
        installmentNumber: i + 1,
        installmentTotal: installments,
      });
    }
  }

  if (data.goalId && data.type === "income") {
    await db
      .update(goals)
      .set({ currentCents: sql`${goals.currentCents} + ${data.amountCents}` })
      .where(eq(goals.id, data.goalId));
  }

  if (!data.id && data.createRecurring) {
    await db.insert(recurringRules).values({
      userId: user.id,
      categoryId: data.categoryId,
      accountId: data.accountId ?? null,
      type: data.type,
      amountCents: data.amountCents,
      description: data.description || category.name,
      frequency: data.createRecurring.frequency,
      dayOfMonth: data.createRecurring.dayOfMonth ?? null,
      dayOfWeek: data.createRecurring.dayOfWeek ?? null,
      startsOn: data.occurredOn,
      endsOn: null,
      lastGeneratedOn: data.occurredOn,
    });
    revalidatePath("/recurring");
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  revalidatePath("/goals");
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

const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amountCents: z.number().int().positive(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(200).default(""),
});

export async function createTransfer(
  input: z.infer<typeof transferSchema>,
) {
  const user = await requireUser();
  const data = transferSchema.parse(input);
  if (data.fromAccountId === data.toAccountId) {
    throw new Error("As contas de origem e destino precisam ser diferentes");
  }

  const [from, to] = await Promise.all([
    db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, data.fromAccountId),
        eq(accounts.userId, user.id),
      ),
    }),
    db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, data.toAccountId),
        eq(accounts.userId, user.id),
      ),
    }),
  ]);
  if (!from || !to) throw new Error("Conta inválida");

  const cats = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
  });
  const fallbackCat = cats[0];
  if (!fallbackCat) throw new Error("Crie uma categoria antes");

  const pairId = crypto.randomUUID();
  const label = data.description || `Transferência ${from.name} → ${to.name}`;

  await db.insert(transactions).values([
    {
      userId: user.id,
      type: "transfer",
      amountCents: data.amountCents,
      categoryId: fallbackCat.id,
      accountId: data.fromAccountId,
      description: label,
      occurredOn: data.occurredOn,
      transferPairId: pairId,
    },
    {
      userId: user.id,
      type: "transfer",
      amountCents: data.amountCents,
      categoryId: fallbackCat.id,
      accountId: data.toAccountId,
      description: label,
      occurredOn: data.occurredOn,
      transferPairId: pairId,
    },
  ]);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
}
