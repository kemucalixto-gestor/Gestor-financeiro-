import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { generatePendingTransactions } from "@/lib/recurring";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const secret = process.env.RECURRING_CRON_SECRET;
  const headerSecret =
    req.headers.get("x-cron-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!secret || headerSecret !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allUsers = await db.select({ id: users.id }).from(users);
  let totalCreated = 0;
  for (const u of allUsers) {
    totalCreated += await generatePendingTransactions(u.id);
  }
  return NextResponse.json({ ok: true, usersProcessed: allUsers.length, totalCreated });
}
