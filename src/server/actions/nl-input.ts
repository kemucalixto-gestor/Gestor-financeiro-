"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";

const schema = z.object({
  type: z.enum(["income", "expense"]).nullable().optional(),
  amount_cents: z.number().int().positive().nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  error: z.string().nullable().optional(),
});

export type NLResult =
  | {
      ok: true;
      type?: "income" | "expense";
      amountCents?: number;
      description?: string;
      occurredOn?: string;
      categoryId?: string;
      tags?: string[];
    }
  | { ok: false; error: string };

export async function parseNaturalLanguage(text: string): Promise<NLResult> {
  const user = await requireUser();
  const input = (text ?? "").trim();
  if (!input) return { ok: false, error: "Digite algo" };
  if (input.length > 300) return { ok: false, error: "Texto muito longo" };

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return { ok: false, error: "GOOGLE_API_KEY não configurada" };

  const cats = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
  });
  const expenseCats = cats.filter((c) => c.type === "expense").map((c) => c.name);
  const incomeCats = cats.filter((c) => c.type === "income").map((c) => c.name);

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Você é um assistente que extrai lançamentos financeiros de frases em português brasileiro.

Data de hoje: ${today} (dia da semana: ${new Date().toLocaleDateString("pt-BR", { weekday: "long" })})

Frase do usuário: "${input}"

Retorne APENAS um JSON com:
- type: "expense" (despesa/gastei/paguei/comprei) ou "income" (recebi/ganhei/entrou)
- amount_cents: valor em centavos (inteiro). "50 reais" → 5000; "45,90" → 4590
- description: descrição curta do que foi (máx 60 chars)
- occurred_on: data YYYY-MM-DD. "hoje" → ${today}. "ontem" → calcule. "dia 15" → 2026-04-15. Se não disser, use ${today}.
- category: UMA das categorias abaixo (string EXATA)
- tags: array de até 3 tags lowercase relevantes (ex: ["viagem","almoço"]), ou null

Categorias de DESPESA: ${expenseCats.join(", ") || "(nenhuma)"}
Categorias de RECEITA: ${incomeCats.join(", ") || "(nenhuma)"}

Se a frase não for um lançamento claro, retorne {"error":"motivo"}.`;

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
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
      return { ok: false, error: "Limite do Gemini atingido — aguarde 1 min" };
    }
    return { ok: false, error: `Falha na IA (${res.status})` };
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const textOut = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOut) return { ok: false, error: "Resposta vazia" };

  let parsed;
  try {
    parsed = schema.parse(JSON.parse(textOut));
  } catch {
    return { ok: false, error: "Não consegui interpretar a resposta" };
  }

  if (parsed.error) return { ok: false, error: parsed.error };

  let categoryId: string | undefined;
  if (parsed.category) {
    const wanted = parsed.category.toLowerCase().trim();
    const match =
      cats.find((c) => c.name.toLowerCase() === wanted) ??
      cats.find((c) => c.name.toLowerCase().includes(wanted));
    if (match && (!parsed.type || match.type === parsed.type)) {
      categoryId = match.id;
    }
  }

  return {
    ok: true,
    type: parsed.type ?? undefined,
    amountCents: parsed.amount_cents ?? undefined,
    description: parsed.description ?? undefined,
    occurredOn: parsed.occurred_on ?? undefined,
    categoryId,
    tags: parsed.tags ?? undefined,
  };
}
