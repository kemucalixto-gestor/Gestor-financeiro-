"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  FileImage,
  ImageIcon,
  Minus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { Account, Category, CreditCard } from "@/db/schema";
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
import { MoneyInput } from "@/components/MoneyInput";
import {
  saveBulkTransactions,
  scanStatement,
  type StatementItem,
} from "@/server/actions/scan-statement";
import { formatBRL } from "@/lib/money";

interface Props {
  categories: Category[];
  accounts: Account[];
  creditCards: CreditCard[];
}

interface Draft extends StatementItem {
  enabled: boolean;
  localId: string;
}

export function StatementImporter({
  categories,
  accounts,
  creditCards,
}: Props) {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [chooserOpen, setChooserOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [creditCardId, setCreditCardId] = useState("");
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setScanning(true);
    setScanError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const result = await scanStatement(fd);
      if (!result.ok) {
        setScanError(result.error);
        return;
      }
      if (result.items.length === 0) {
        setScanError("Nenhuma transação encontrada na imagem");
        return;
      }
      setDrafts(
        result.items.map((it) => ({
          ...it,
          enabled: true,
          localId: crypto.randomUUID(),
        })),
      );
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Erro ao processar");
    } finally {
      setScanning(false);
    }
  }

  function updateDraft(localId: string, patch: Partial<Draft>) {
    setDrafts(
      (prev) =>
        prev?.map((d) => (d.localId === localId ? { ...d, ...patch } : d)) ??
        null,
    );
  }

  function removeDraft(localId: string) {
    setDrafts((prev) => prev?.filter((d) => d.localId !== localId) ?? null);
  }

  const activeDrafts = drafts?.filter((d) => d.enabled) ?? [];
  const totalIncome = activeDrafts
    .filter((d) => d.type === "income")
    .reduce((a, b) => a + b.amountCents, 0);
  const totalExpense = activeDrafts
    .filter((d) => d.type === "expense")
    .reduce((a, b) => a + b.amountCents, 0);

  // Sem drafts ainda: mostra tela de upload
  if (!drafts) {
    return (
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <FileImage className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-semibold">Importar extrato por imagem</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Tire um print do seu extrato (Nubank, Itaú, Bradesco, Inter,
                etc.) ou fatura e a IA extrai todas as transações de uma vez.
              </p>
            </div>
          </CardContent>
        </Card>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />

        <Button
          size="lg"
          disabled={scanning}
          onClick={() => setChooserOpen(true)}
        >
          {scanning ? (
            <>
              <Sparkles className="h-4 w-4 animate-pulse" />
              Analisando extrato...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              Enviar print do extrato
            </>
          )}
        </Button>

        {scanError && (
          <p className="text-sm text-destructive">{scanError}</p>
        )}

        {chooserOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
            onClick={() => setChooserOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-t-2xl bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold">Enviar como:</h3>
                <button
                  onClick={() => setChooserOpen(false)}
                  aria-label="Fechar"
                  className="rounded p-2 hover:bg-accent"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start"
                  onClick={() => {
                    setChooserOpen(false);
                    cameraRef.current?.click();
                  }}
                >
                  <Camera className="h-5 w-5" />
                  Tirar foto agora
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="justify-start"
                  onClick={() => {
                    setChooserOpen(false);
                    galleryRef.current?.click();
                  }}
                >
                  <ImageIcon className="h-5 w-5" />
                  Escolher da galeria
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Com drafts: mostra tela de revisão
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-xs uppercase text-muted-foreground">
            Detectei {drafts.length} transaç{drafts.length === 1 ? "ão" : "ões"}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">
                Entradas
              </p>
              <p className="font-semibold text-income">
                {formatBRL(totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase text-muted-foreground">
                Saídas
              </p>
              <p className="font-semibold text-expense">
                {formatBRL(totalExpense)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {accounts.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <div>
              <Label>Salvar na conta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha a conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {creditCards.length > 0 && (
              <div>
                <Label>Cartão de crédito (se for extrato de fatura)</Label>
                <Select
                  value={creditCardId || "__none__"}
                  onValueChange={(v) =>
                    setCreditCardId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Sem cartão</SelectItem>
                    {creditCards.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {drafts.map((d) => (
          <DraftCard
            key={d.localId}
            draft={d}
            categories={categories}
            onUpdate={(patch) => updateDraft(d.localId, patch)}
            onRemove={() => removeDraft(d.localId)}
          />
        ))}
      </div>

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            if (confirm("Descartar e enviar outro extrato?")) {
              setDrafts(null);
              setScanError(null);
            }
          }}
          disabled={saving}
        >
          Descartar
        </Button>
        <Button
          className="flex-1"
          disabled={
            saving ||
            activeDrafts.length === 0 ||
            (accounts.length > 0 && !accountId)
          }
          onClick={() => {
            setSaveError(null);
            startSaving(async () => {
              try {
                const res = await saveBulkTransactions({
                  items: activeDrafts.map((d) => ({
                    type: d.type,
                    amountCents: d.amountCents,
                    categoryId: d.categoryId,
                    description: d.description,
                    occurredOn: d.occurredOn,
                  })),
                  accountId: accountId || null,
                  creditCardId: creditCardId || null,
                });
                router.push("/transactions");
                router.refresh();
                alert(`${res.saved} lançamentos importados!`);
              } catch (err) {
                setSaveError(
                  err instanceof Error ? err.message : "Erro ao salvar",
                );
              }
            });
          }}
        >
          {saving
            ? "Importando..."
            : `Importar ${activeDrafts.length} lançamento${activeDrafts.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

function DraftCard({
  draft,
  categories,
  onUpdate,
  onRemove,
}: {
  draft: Draft;
  categories: Category[];
  onUpdate: (patch: Partial<Draft>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cat = categories.find((c) => c.id === draft.categoryId);
  const filteredCats = categories.filter((c) => c.type === draft.type);

  return (
    <Card className={draft.enabled ? "" : "opacity-50"}>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onUpdate({ enabled: !draft.enabled })}
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded border ${draft.enabled ? "border-primary bg-primary text-primary-foreground" : "border-input"}`}
            aria-label={draft.enabled ? "Desmarcar" : "Marcar"}
          >
            {draft.enabled && <Check className="h-4 w-4" />}
          </button>
          <div className="flex-1 min-w-0" onClick={() => setExpanded(!expanded)}>
            <p className="truncate text-sm font-medium">
              {draft.description || cat?.name || "Lançamento"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {new Date(draft.occurredOn).toLocaleDateString("pt-BR")} ·{" "}
              {cat?.name ?? "—"}
            </p>
          </div>
          <p
            className={`text-sm font-semibold ${
              draft.type === "income" ? "text-income" : "text-expense"
            }`}
          >
            {draft.type === "income" ? "+" : "−"}
            {formatBRL(draft.amountCents)}
          </p>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover"
            className="rounded p-1 text-destructive hover:bg-accent"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {expanded && (
          <div className="flex flex-col gap-2 border-t pt-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={draft.type === "expense" ? "default" : "outline"}
                onClick={() => onUpdate({ type: "expense" })}
              >
                Despesa
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draft.type === "income" ? "default" : "outline"}
                onClick={() => onUpdate({ type: "income" })}
              >
                Receita
              </Button>
            </div>
            <div>
              <Label className="text-xs">Valor</Label>
              <MoneyInput
                valueCents={draft.amountCents}
                onChange={(v) => onUpdate({ amountCents: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select
                value={draft.categoryId}
                onValueChange={(v) => {
                  const newCat = categories.find((c) => c.id === v);
                  onUpdate({
                    categoryId: v,
                    categoryName: newCat?.name ?? "",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={draft.occurredOn}
                onChange={(e) => onUpdate({ occurredOn: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Input
                value={draft.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                maxLength={200}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
