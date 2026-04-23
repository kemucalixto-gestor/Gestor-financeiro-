"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Camera, Sparkles } from "lucide-react";
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
import { scanReceipt } from "@/server/actions/scan-receipt";
import { todayISO } from "@/lib/dates";

interface Props {
  categories: Category[];
  initial?: Transaction;
}

export function TransactionForm({ categories, initial }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = categories.filter((c) => c.type === type);

  async function handleScanFile(file: File) {
    setScanning(true);
    setScanMessage(null);
    setScanError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await scanReceipt(fd);
      if (!result.ok) {
        setScanError(result.error);
        return;
      }
      if (result.type) setType(result.type);
      if (result.amountCents && result.amountCents > 0) {
        setAmountCents(result.amountCents);
      }
      if (result.description) setDescription(result.description);
      if (result.occurredOn) setOccurredOn(result.occurredOn);
      if (result.categoryId) setCategoryId(result.categoryId);
      setScanMessage("Li a nota fiscal e preenchi os campos — confira antes de salvar.");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Erro ao processar imagem");
    } finally {
      setScanning(false);
    }
  }

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
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleScanFile(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        disabled={scanning || pending}
        onClick={() => fileInputRef.current?.click()}
      >
        {scanning ? (
          <>
            <Sparkles className="h-4 w-4 animate-pulse" />
            Lendo nota fiscal...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            Escanear nota fiscal
          </>
        )}
      </Button>
      {scanMessage && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          {scanMessage}
        </p>
      )}
      {scanError && <p className="text-sm text-destructive">{scanError}</p>}

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

      <Button type="submit" size="lg" disabled={pending || scanning}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
