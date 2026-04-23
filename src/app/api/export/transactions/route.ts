import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, transactions } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { monthBounds } from "@/lib/dates";
import { parseTags } from "@/lib/tags";

export const runtime = "nodejs";

function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const month = url.searchParams.get("month");

  let startDate: string | undefined;
  let endDate: string | undefined;
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const b = monthBounds(month);
    startDate = b.start;
    endDate = b.end;
  } else {
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) startDate = from;
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) endDate = to;
  }

  const conditions = [eq(transactions.userId, user.id)];
  if (startDate) conditions.push(gte(transactions.occurredOn, startDate));
  if (endDate) conditions.push(lte(transactions.occurredOn, endDate));

  const [rows, cats] = await Promise.all([
    db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(asc(transactions.occurredOn), asc(transactions.createdAt)),
    db.query.categories.findMany({
      where: eq(categories.userId, user.id),
    }),
  ]);

  const catMap = Object.fromEntries(cats.map((c) => [c.id, c.name]));

  const header = [
    "Data",
    "Tipo",
    "Valor (R$)",
    "Categoria",
    "Descrição",
    "Tags",
    "Parcela",
    "Anexo",
  ];
  const lines: string[] = [header.map(csvCell).join(";")];
  for (const t of rows) {
    const valorReais = (t.amountCents / 100).toFixed(2).replace(".", ",");
    const tipo =
      t.type === "income" ? "Receita" : t.type === "transfer" ? "Transferência" : "Despesa";
    const tags = parseTags(t.tagsJson).join(", ");
    const parcela =
      t.installmentTotal && t.installmentNumber
        ? `${t.installmentNumber}/${t.installmentTotal}`
        : "";
    lines.push(
      [
        t.occurredOn,
        tipo,
        valorReais,
        catMap[t.categoryId] ?? "",
        t.description,
        tags,
        parcela,
        t.attachmentUrl ?? "",
      ].map(csvCell).join(";"),
    );
  }

  const csv = "﻿" + lines.join("\n");
  const filenameParts = ["transacoes"];
  if (month) filenameParts.push(month);
  else if (startDate) filenameParts.push(startDate);
  const filename = filenameParts.join("_") + ".csv";

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
