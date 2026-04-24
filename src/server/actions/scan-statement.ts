"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db/client";
import {
  accounts,
  categories,
  creditCards,
  transactions,
} from "@/db/schema";
import { requireUser } from "@/lib/session";

const itemSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount_cents: z.number().int().positive(),
  description: z.string().max(200).default(""),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
});

const responseSchema = z.object({
  items: z.array(itemSchema).default([]),
  error: z.string().nullable().optional(),
});

export interface StatementItem {
  type: "income" | "expense";
  amountCents: number;
  description: string;
  occurredOn: string;
  categoryId: string;
  categoryName: string;
}

export type ScanStatementResult =
  | { ok: true; items: StatementItem[] }
  | { ok: false; error: string };

export async function scanStatement(
  formData: FormData,
): Promise<ScanStatementResult> {
  const user = await requireUser();
  const file = formData.get("image");
  if (!(file instanceof File)) return { ok: false, error: "Arquivo ausente" };
  if (file.size === 0) return { ok: false, error: "Arquivo vazio" };
  if (file.size > 9 * 1024 * 1024) {
    return { ok: false, error: "Imagem maior que 9MB — tente uma menor" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Envie uma imagem do extrato" };
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return { ok: false, error: "GOOGLE_API_KEY não configurada" };

  const cats = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
  });
  const expenseCats = cats.filter((c) => c.type === "expense").map((c) => c.name);
  const incomeCats = cats.filter((c) => c.type === "income").map((c) => c.name);

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Você analisa screenshots de extratos bancários, faturas de cartão, comprovantes e telas de apps de banco brasileiros (Nubank, Itaú, Bradesco, Inter, C6, etc).

Retorne APENAS um JSON no formato:
{
  "items": [
    {
      "type": "expense" | "income",
      "amount_cents": <valor em centavos, inteiro>,
      "description": "<descrição curta, máx 60 chars>",
      "occurred_on": "<YYYY-MM-DD>",
      "category": "<nome exato de uma categoria abaixo>"
    },
    ...
  ]
}

Regras:
- Extraia TODAS as transações visíveis na imagem (exceto saldos, totais e cabeçalhos)
- "Entrada", "PIX recebido", "Crédito", "+" = income
- "Saída", "PIX enviado", "Débito", "Compra", "-" = expense
- Ignore transferências internas se forem claramente saída+entrada na mesma conta
- Use a data que aparece ao lado da transação. Se só aparecer o dia (ex: "15"), use ${today} como referência do mês/ano atual
- Escolha UMA categoria que melhor se encaixe (string EXATA da lista)

Categorias de DESPESA: ${expenseCats.join(", ") || "(nenhuma)"}
Categorias de RECEITA: ${incomeCats.join(", ") || "(nenhuma)"}

Se a imagem não for um extrato ou não houver transações legíveis, retorne {"items":[],"error":"motivo curto"}.`;

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: file.type, data: base64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1,
          },
        }),
      },
    );
  } catch {
    return { ok: false, error: "Não consegui conectar ao Gemini" };
  }

  if (!res.ok) {
    if (res.status === 429) {
      return { ok: false, error: "Limite do Gemini atingido — tente em 1 min" };
    }
    return { ok: false, error: `Falha na IA (${res.status})` };
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const textOut = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOut) return { ok: false, error: "Resposta vazia da IA" };

  let parsed;
  try {
    parsed = responseSchema.parse(JSON.parse(textOut));
  } catch {
    return { ok: false, error: "Não consegui interpretar a resposta" };
  }

  if (parsed.error && (!parsed.items || parsed.items.length === 0)) {
    return { ok: false, error: parsed.error };
  }

  const items: StatementItem[] = [];
  const fallbackIncome = cats.find((c) => c.type === "income") ?? cats[0];
  const fallbackExpense = cats.find((c) => c.type === "expense") ?? cats[0];

  for (const it of parsed.items) {
    let matched = null;
    if (it.category) {
      const wanted = it.category.toLowerCase().trim();
      matched =
        cats.find(
          (c) => c.name.toLowerCase() === wanted && c.type === it.type,
        ) ??
        cats.find(
          (c) =>
            c.name.toLowerCase().includes(wanted) && c.type === it.type,
        ) ??
        null;
    }
    const fallback = it.type === "income" ? fallbackIncome : fallbackExpense;
    const cat = matched ?? fallback;
    if (!cat) continue;

    items.push({
      type: it.type,
      amountCents: it.amount_cents,
      description: it.description || "",
      occurredOn: it.occurred_on ?? today,
      categoryId: cat.id,
      categoryName: cat.name,
    });
  }

  return { ok: true, items };
}

const bulkSchema = z.object({
  items: z
    .array(
      z.object({
        type: z.enum(["income", "expense"]),
        amountCents: z.number().int().positive(),
        categoryId: z.string().min(1),
        description: z.string().max(200).default(""),
        occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1)
    .max(100),
  accountId: z.string().nullable().optional(),
  creditCardId: z.string().nullable().optional(),
});

export async function saveBulkTransactions(
  input: z.infer<typeof bulkSchema>,
): Promise<{ saved: number }> {
  const user = await requireUser();
  const data = bulkSchema.parse(input);

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

  const rows = data.items.map((i) => ({
    userId: user.id,
    type: i.type,
    amountCents: i.amountCents,
    categoryId: i.categoryId,
    accountId: data.accountId ?? null,
    creditCardId: data.creditCardId ?? null,
    description: i.description,
    occurredOn: i.occurredOn,
  }));

  await db.insert(transactions).values(rows);

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");

  return { saved: rows.length };
}
