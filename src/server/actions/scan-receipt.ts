"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { categories } from "@/db/schema";
import { requireUser } from "@/lib/session";

const geminiResponseSchema = z.object({
  type: z.enum(["income", "expense"]).nullable().optional(),
  amount_cents: z.number().int().positive().nullable().optional(),
  description: z.string().max(200).nullable().optional(),
  occurred_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  category: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export type ScanResult =
  | {
      ok: true;
      type?: "income" | "expense";
      amountCents?: number;
      description?: string;
      occurredOn?: string;
      categoryId?: string;
    }
  | { ok: false; error: string };

export async function scanReceipt(formData: FormData): Promise<ScanResult> {
  const user = await requireUser();
  const file = formData.get("image");
  if (!(file instanceof File)) {
    return { ok: false, error: "Arquivo ausente" };
  }
  if (file.size === 0) return { ok: false, error: "Arquivo vazio" };
  if (file.size > 9 * 1024 * 1024) {
    return { ok: false, error: "Imagem maior que 9MB — tente uma foto menor" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Arquivo não é uma imagem" };
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "GOOGLE_API_KEY não configurada no servidor" };
  }

  const cats = await db.query.categories.findMany({
    where: eq(categories.userId, user.id),
  });
  const expenseCats = cats.filter((c) => c.type === "expense").map((c) => c.name);
  const incomeCats = cats.filter((c) => c.type === "income").map((c) => c.name);

  const buf = Buffer.from(await file.arrayBuffer());
  const base64 = buf.toString("base64");
  const mimeType = file.type;

  const today = new Date().toISOString().slice(0, 10);

  const prompt = `Você é um assistente especializado em extrair dados de notas fiscais, cupons fiscais e comprovantes de pagamento brasileiros.

Analise a imagem e retorne APENAS um JSON com estes campos (sem markdown, sem explicação):
- type: "expense" para despesas (compras, contas) ou "income" para receitas (pagamentos recebidos, salário)
- amount_cents: valor TOTAL em centavos, inteiro. Exemplos: R$ 45,50 → 4550; R$ 1.234,00 → 123400
- description: nome curto do estabelecimento ou da operação (máximo 60 caracteres)
- occurred_on: data da transação no formato YYYY-MM-DD. Se não estiver visível ou legível, use "${today}"
- category: UMA das categorias listadas abaixo, escolhendo a que melhor se encaixa. Use a string EXATA da lista.

Categorias de DESPESA disponíveis: ${expenseCats.join(", ") || "(nenhuma)"}
Categorias de RECEITA disponíveis: ${incomeCats.join(", ") || "(nenhuma)"}

Se a imagem não for legível ou não for um comprovante, retorne apenas: {"error":"motivo curto"}.`;

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
                { inline_data: { mime_type: mimeType, data: base64 } },
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
    let detail = "";
    try {
      const j = (await res.json()) as { error?: { message?: string } };
      detail = j?.error?.message ?? "";
    } catch {
      /* ignore */
    }
    if (res.status === 429) {
      return { ok: false, error: "Limite de uso do Gemini atingido — tente em 1 minuto" };
    }
    return {
      ok: false,
      error: `Falha na IA (${res.status}): ${detail.slice(0, 140) || "sem detalhes"}`,
    };
  }

  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return { ok: false, error: "Resposta vazia da IA" };
  }

  let parsed;
  try {
    parsed = geminiResponseSchema.parse(JSON.parse(text));
  } catch {
    return { ok: false, error: "Não consegui interpretar a resposta da IA" };
  }

  if (parsed.error) {
    return { ok: false, error: parsed.error };
  }

  let categoryId: string | undefined;
  if (parsed.category) {
    const wanted = parsed.category.toLowerCase().trim();
    const match =
      cats.find((c) => c.name.toLowerCase() === wanted) ??
      cats.find((c) => c.name.toLowerCase().includes(wanted)) ??
      cats.find((c) => wanted.includes(c.name.toLowerCase()));
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
  };
}
