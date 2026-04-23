"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Category, Transaction } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoneyInput } from "@/components/MoneyInput";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { saveTransaction } from "@/server/actions/transactions";
import { todayISO } from "@/lib/dates";

interface Props {
  categories: Category[];
  initial?: Transaction;
}

export function TransactionForm({ categories, initial }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"income" | "expense">(
    initial?.type ?? "expense",
  );
  const [amountCents, setAmountCents] = useState<number>(
    initial?.amountCents ?? 0,
  );
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? "");
  const [description, setDescription] = useState<string>(
    initial?.description ?? "",
  );
  const [occurredOn, setOccurredOn] = useState<string>(
    initial?.occurredOn ?? todayISO(),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = categories.filter((c) => c.type === type);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (amountCents <= 0) {
          setError("Informe um valor maior que zero");
          return;
        }
        if (!categoryId) {
          setError("Selecione uma categoria");
          return;
        }
        startTransition(async () => {
          try {
            await saveTransaction({
              id: initial?.id,
              type,
              amountCents,
              categoryId,
              description,
              occurredOn,
            });
            router.push("/transactions");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao salvar");
          }
        });
      }}
    >
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
        <Label htmlFor="amount">Valor</Label>
        <MoneyInput
          id="amount"
          valueCents={amountCents}
          onChange={setAmountCents}
        />
      </div>

      <div>
        <Label>Categoria</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder="Escolha uma categoria" />
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
        <Label htmlFor="date">Data</Label>
        <Input
          id="date"
          type="date"
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="desc">Descrição (opcional)</Label>
        <Input
          id="desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={200}
          placeholder="Ex.: Mercado do mês"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
