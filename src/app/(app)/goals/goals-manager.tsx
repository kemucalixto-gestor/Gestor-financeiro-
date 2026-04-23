"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { parseISO } from "date-fns";
import type { Goal } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { MoneyInput } from "@/components/MoneyInput";
import { formatBRL } from "@/lib/money";
import { deleteGoal, saveGoal } from "@/server/actions/goals";

const COLORS = ["#22c55e", "#2563eb", "#f97316", "#ec4899", "#8b5cf6", "#14b8a6"];

export function GoalsManager({ initial }: { initial: Goal[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Goal | null | "new">(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Crie uma meta (viagem, reserva, compra grande) e acompanhe o progresso.
          </CardContent>
        </Card>
      )}
      {items.map((g) => {
        const pct = g.targetCents > 0 ? Math.min(100, Math.round((g.currentCents / g.targetCents) * 100)) : 0;
        const done = g.currentCents >= g.targetCents;
        return (
          <Card key={g.id}>
            <CardContent className="flex flex-col gap-2 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: g.color + "22" }}>
                  {done ? <CheckCircle2 className="h-5 w-5" style={{ color: g.color }} /> : <Target className="h-5 w-5" style={{ color: g.color }} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  {g.targetDate && (
                    <p className="text-xs text-muted-foreground">
                      Até {parseISO(g.targetDate).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setEditing(g)} aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Excluir a meta "${g.name}"?`)) return;
                    startTransition(async () => {
                      await deleteGoal(g.id);
                      setItems((x) => x.filter((i) => i.id !== g.id));
                    });
                  }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="flex justify-between text-xs">
                <span className={done ? "text-income font-semibold" : "text-muted-foreground"}>
                  {formatBRL(g.currentCents)} de {formatBRL(g.targetCents)}
                </span>
                <span className={done ? "text-income font-semibold" : "text-muted-foreground"}>{pct}%</span>
              </div>
              <Progress value={pct} indicatorClassName={done ? "bg-income" : "bg-primary"} />
            </CardContent>
          </Card>
        );
      })}
      <Button variant="outline" className="mt-2" onClick={() => setEditing("new")}>
        <Plus className="h-4 w-4" /> Nova meta
      </Button>

      {editing !== null && (
        <GoalEditor
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

function GoalEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Goal | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [targetCents, setTargetCents] = useState(initial?.targetCents ?? 0);
  const [targetDate, setTargetDate] = useState(initial?.targetDate ?? "");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Editar meta" : "Nova meta"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Nome da meta</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Ex.: Viagem para Fernando de Noronha" />
          </div>
          <div>
            <Label>Quanto você quer juntar</Label>
            <MoneyInput valueCents={targetCents} onChange={setTargetCents} />
          </div>
          <div>
            <Label>Até quando (opcional)</Label>
            <Input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
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
          <Button disabled={pending || !name.trim() || targetCents <= 0} onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await saveGoal({
                  id: initial?.id,
                  name: name.trim(),
                  targetCents,
                  targetDate: targetDate || null,
                  color,
                  status: initial?.status ?? "active",
                });
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
