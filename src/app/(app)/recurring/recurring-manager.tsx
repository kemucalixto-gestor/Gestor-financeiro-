"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { Category, RecurringRule } from "@/db/schema";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoneyInput } from "@/components/MoneyInput";
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { deleteRecurring, saveRecurring } from "@/server/actions/recurring";
import {
  detectSubscriptions,
  type SubscriptionSuggestion,
} from "@/server/actions/detect-subscriptions";
import { useRouter } from "next/navigation";

const WEEKDAY_NAMES = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
];

export function RecurringManager({
  initial,
  categories,
}: {
  initial: RecurringRule[];
  categories: Category[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<
    { mode: "create" } | { mode: "edit"; rule: RecurringRule } | null
  >(null);
  const [suggestions, setSuggestions] = useState<SubscriptionSuggestion[] | null>(
    null,
  );
  const [detecting, setDetecting] = useState(false);
  const [pending, startTransition] = useTransition();

  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));

  async function handleDetect() {
    setDetecting(true);
    try {
      const list = await detectSubscriptions();
      setSuggestions(list);
    } finally {
      setDetecting(false);
    }
  }

  async function acceptSuggestion(s: SubscriptionSuggestion) {
    await saveRecurring({
      type: "expense",
      categoryId: s.categoryId,
      amountCents: s.amountCents,
      description: s.description,
      frequency: "monthly",
      dayOfMonth: s.dayOfMonth,
      dayOfWeek: null,
      startsOn: s.sampleDates[s.sampleDates.length - 1] ?? todayISO(),
      endsOn: null,
    });
    setSuggestions((prev) => (prev ? prev.filter((x) => x !== s) : prev));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma recorrência cadastrada.
          </CardContent>
        </Card>
      )}
      {items.map((r) => {
        const cat = catMap[r.categoryId];
        const freqLabel =
          r.frequency === "monthly"
            ? `todo dia ${r.dayOfMonth}`
            : `toda ${WEEKDAY_NAMES[r.dayOfWeek ?? 0]}`;
        return (
          <Card key={r.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <span
                className="h-10 w-10 shrink-0 rounded-full"
                style={{ background: cat?.color ?? "#64748b" }}
              />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">
                  {r.description || cat?.name || "Recorrência"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {cat?.name ?? "—"} · {freqLabel}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    r.type === "income" ? "text-income" : "text-expense"
                  }`}
                >
                  {r.type === "income" ? "+" : "−"}
                  {formatBRL(r.amountCents)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing({ mode: "edit", rule: r })}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label="Excluir"
                onClick={() => {
                  if (!confirm("Excluir esta recorrência?")) return;
                  startTransition(async () => {
                    await deleteRecurring(r.id);
                    setItems((prev) => prev.filter((x) => x.id !== r.id));
                    router.refresh();
                  });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => setEditing({ mode: "create" })}>
          <Plus className="h-4 w-4" /> Nova
        </Button>
        <Button variant="outline" onClick={handleDetect} disabled={detecting}>
          <Sparkles className={`h-4 w-4 ${detecting ? "animate-pulse" : ""}`} />
          {detecting ? "Analisando..." : "Detectar assinaturas"}
        </Button>
      </div>

      {suggestions && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Sugestões detectadas
          </p>
          {suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Não encontrei padrões claros. Faça alguns lançamentos nos próximos meses e tente de novo.
            </p>
          ) : (
            suggestions.map((s, i) => (
              <Card key={i}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{s.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.categoryName} · todo dia {s.dayOfMonth} · {s.occurrencesFound}× nos últimos 4 meses
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-expense">
                    {formatBRL(s.amountCents)}
                  </p>
                  <Button size="sm" onClick={() => acceptSuggestion(s)}>
                    Criar
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {editing && (
        <RecurringEditor
          categories={categories}
          initial={editing.mode === "edit" ? editing.rule : undefined}
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

function RecurringEditor({
  initial,
  categories,
  onClose,
  onSaved,
}: {
  initial?: RecurringRule;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<"income" | "expense">(
    initial?.type ?? "expense",
  );
  const [amountCents, setAmountCents] = useState(initial?.amountCents ?? 0);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [frequency, setFrequency] = useState<"monthly" | "weekly">(
    initial?.frequency ?? "monthly",
  );
  const [dayOfMonth, setDayOfMonth] = useState(initial?.dayOfMonth ?? 5);
  const [dayOfWeek, setDayOfWeek] = useState(initial?.dayOfWeek ?? 1);
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? todayISO());
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = categories.filter((c) => c.type === type);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-background p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Editar recorrência" : "Nova recorrência"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <Tabs
            value={type}
            onValueChange={(v) => {
              setType(v as "income" | "expense");
              setCategoryId("");
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="expense">Despesa</TabsTrigger>
              <TabsTrigger value="income">Receita</TabsTrigger>
            </TabsList>
          </Tabs>

          <div>
            <Label>Valor</Label>
            <MoneyInput
              valueCents={amountCents}
              onChange={setAmountCents}
            />
          </div>

          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar" />
              </SelectTrigger>
              <SelectContent>
                {filtered.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex.: Aluguel"
              maxLength={200}
            />
          </div>

          <div>
            <Label>Frequência</Label>
            <Select
              value={frequency}
              onValueChange={(v) => setFrequency(v as "monthly" | "weekly")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {frequency === "monthly" ? (
            <div>
              <Label htmlFor="dom">Dia do mês</Label>
              <Input
                id="dom"
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
              />
            </div>
          ) : (
            <div>
              <Label>Dia da semana</Label>
              <Select
                value={String(dayOfWeek)}
                onValueChange={(v) => setDayOfWeek(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_NAMES.map((w, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="start">Início</Label>
              <Input
                id="start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="end">Fim (opcional)</Label>
              <Input
                id="end"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            disabled={pending || !categoryId || amountCents <= 0}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await saveRecurring({
                    id: initial?.id,
                    type,
                    categoryId,
                    amountCents,
                    description,
                    frequency,
                    dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
                    dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
                    startsOn,
                    endsOn: endsOn || null,
                  });
                  onSaved();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Erro ao salvar",
                  );
                }
              });
            }}
          >
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
