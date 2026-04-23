"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CreditCard,
  LayoutDashboard,
  ListOrdered,
  Menu,
  PiggyBank,
  Repeat,
  Tags,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/dashboard", label: "Início", Icon: LayoutDashboard },
  { href: "/transactions", label: "Lançamentos", Icon: ListOrdered },
  { href: "/budgets", label: "Orçamentos", Icon: PiggyBank },
  { href: "/goals", label: "Metas", Icon: Target },
];

const MORE = [
  { href: "/accounts", label: "Contas", Icon: Wallet },
  { href: "/cards", label: "Cartões", Icon: CreditCard },
  { href: "/recurring", label: "Recorrentes", Icon: Repeat },
  { href: "/categories", label: "Categorias", Icon: Tags },
];

export function BottomNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Mais opções</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                className="rounded p-2 hover:bg-accent"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {MORE.map(({ href, label, Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-4 text-base",
                        active ? "border-primary text-primary" : "",
                      )}
                    >
                      <Icon className="h-6 w-6" />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground active:bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-14 items-center justify-center rounded-full transition-colors",
                      active && "bg-primary/10",
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="leading-tight">{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setOpen(true)}
              className={cn(
                "flex min-h-[60px] w-full flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium transition-colors",
                MORE.some((m) => pathname.startsWith(m.href))
                  ? "text-primary"
                  : "text-muted-foreground active:bg-accent",
              )}
              aria-label="Mais opções"
            >
              <span
                className={cn(
                  "flex h-9 w-14 items-center justify-center rounded-full transition-colors",
                  MORE.some((m) => pathname.startsWith(m.href)) && "bg-primary/10",
                )}
              >
                <Menu className="h-6 w-6" />
              </span>
              <span className="leading-tight">Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
