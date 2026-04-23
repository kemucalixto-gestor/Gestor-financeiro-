"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CreditCard } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { MoneyInput } from "@/components/MoneyInput";
import { formatBRL } from "@/lib/money";
import { deleteCard, saveCard } from "@/server/actions/cards";

const BRANDS: Record<CreditCard["brand"], string> = {
  visa: "Visa",
  master: "Mastercard",
  elo: "Elo",
  amex: "Amex",
  hiper: "Hipercard",
  other: "Outro",
};

const COLORS = ["#111827", "#2563eb", "#16a34a", "#ef4444", "#f97316", "#8b5cf6"];

export function CardsManager({
  initial,
  monthUsage,
}: {
  initial: CreditCard[];
  monthUsage: Record<string, number>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<CreditCard | null | "new">(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Cadastre seus cartões pra lançar compras no cartão e acompanhar limite usado.
          </CardContent>
        </Card>
      )}
      {items.map((c) => {
        const used = monthUsage[c.id] ?? 0;
        const pct = c.limitCents > 0 ? Math.min(100, Math.round((used / c.limitCents) * 100)) : 0;
        const over = c.limitCents > 0 && used > c.limitCents;
        return (
          <Card key={c.id}>
            <CardContent className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-3">
                <span className="h-10 w-10 shrink-0 rounded" style={{ background: c.color }} />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {BRANDS[c.brand]} · Fecha dia {c.closingDay} · Vence dia {c.dueDay}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(c)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Excluir o cartão "${c.name}"?`)) return;
                    startTransition(async () => {
                      try {
                        await deleteCard(c.id);
                        setItems((x) => x.filter((i) => i.id !== c.id));
                      } catch {
                        alert("Não foi possível excluir.");
                      }
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {c.limitCents > 0 && (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{formatBRL(used)} de {formatBRL(c.limitCents)}</span>
                    <span className={over ? "text-destructive font-medium" : ""}>{pct}%</span>
                  </div>
                  <Progress value={pct} indicatorClassName={over ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary"} />
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      <Button variant="outline" className="mt-2" onClick={() => setEditing("new")}>
        <Plus className="h-4 w-4" /> Novo cartão
      </Button>

      {editing !== null && (
        <CardEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CardEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: CreditCard | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brand, setBrand] = useState<CreditCard["brand"]>(initial?.brand ?? "other");
  const [closingDay, setClosingDay] = useState(initial?.closingDay ?? 5);
  const [dueDay, setDueDay] = useState(initial?.dueDay ?? 15);
  const [limitCents, setLimitCents] = useState(initial?.limitCents ?? 0);
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Editar cartão" : "Novo cartão"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Ex.: Nubank Roxinho" />
          </div>
          <div>
            <Label>Bandeira</Label>
            <Select value={brand} onValueChange={(v) => setBrand(v as CreditCard["brand"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(BRANDS) as Array<keyof typeof BRANDS>).map((k) => (
                  <SelectItem key={k} value={k}>{BRANDS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Dia fechamento</Label>
              <Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
            </div>
            <div>
              <Label>Dia vencimento</Label>
              <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
            </div>
          </div>
          <div>
            <Label>Limite</Label>
            <MoneyInput valueCents={limitCents} onChange={setLimitCents} />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setColor(c)} aria-label={c}
                  className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={pending || !name.trim()} onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await saveCard({ id: initial?.id, name: name.trim(), brand, closingDay, dueDay, limitCents, color });
                onSaved();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro");
              }
            });
          }}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
