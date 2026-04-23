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
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Mais</h2>
              <button onClick={() => setOpen(false)} aria-label="Fechar">
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
                        "flex items-center gap-3 rounded-lg border p-3 text-sm",
                        active ? "border-primary text-primary" : "",
                      )}
                    >
                      <Icon className="h-5 w-5" />
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
        <ul className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {PRIMARY.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setOpen(true)}
              className={cn(
                "flex w-full flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
                MORE.some((m) => pathname.startsWith(m.href)) && "text-primary",
              )}
              aria-label="Mais opções"
            >
              <Menu className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
