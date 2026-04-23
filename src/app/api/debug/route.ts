import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const present = (k: string) => (process.env[k] ? "✓ set" : "✗ MISSING");
  const urlPrefix = (process.env.TURSO_DATABASE_URL ?? "").slice(0, 30);

  return NextResponse.json({
    node: process.version,
    env: {
      TURSO_DATABASE_URL: present("TURSO_DATABASE_URL"),
      TURSO_AUTH_TOKEN: present("TURSO_AUTH_TOKEN"),
      AUTH_SECRET: present("AUTH_SECRET"),
      RECURRING_CRON_SECRET: present("RECURRING_CRON_SECRET"),
    },
    dbUrlPrefix: urlPrefix + "...",
  });
}
