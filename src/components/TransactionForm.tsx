"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Camera, Paperclip, Sparkles, Wand2, X } from "lucide-react";
import type {
  Account,
  Category,
  CreditCard,
  Goal,
  Transaction,
} from "@/db/schema";
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
import { uploadAttachment } from "@/server/actions/upload";
import { parseNaturalLanguage } from "@/server/actions/nl-input";
import { parseTags, tagsFromInput } from "@/lib/tags";
import { todayISO } from "@/lib/dates";

interface Props {
  categories: Category[];
  accounts?: Account[];
  creditCards?: CreditCard[];
  goals?: Goal[];
  initial?: Transaction;
}

export function TransactionForm({
  categories,
  accounts = [],
  creditCards = [],
  goals = [],
  initial,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!initial && searchParams.get("scan") === "1") {
      // Pequeno delay para garantir que o input já está no DOM
      const t = setTimeout(() => scanInputRef.current?.click(), 100);
      return () => clearTimeout(t);
    }
  }, [initial, searchParams]);

  const [type, setType] = useState<"income" | "expense">(
    initial?.type === "income" ? "income" : "expense",
  );
  const [amountCents, setAmountCents] = useState<number>(
    initial?.amountCents ?? 0,
  );
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId ?? "");
  const [accountId, setAccountId] = useState<string>(initial?.accountId ?? "");
  const [creditCardId, setCreditCardId] = useState<string>(
    initial?.creditCardId ?? "",
  );
  const [goalId, setGoalId] = useState<string>(initial?.goalId ?? "");
  const [description, setDescription] = useState<string>(
    initial?.description ?? "",
  );
  const [tagsInput, setTagsInput] = useState<string>(
    parseTags(initial?.tagsJson).join(", "),
  );
  const [occurredOn, setOccurredOn] = useState<string>(
    initial?.occurredOn ?? todayISO(),
  );
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(
    initial?.attachmentUrl ?? null,
  );
  const [installments, setInstallments] = useState<number>(
    initial?.installmentTotal && initial.installmentTotal > 1
      ? initial.installmentTotal
      : 1,
  );
  const [nlInput, setNlInput] = useState("");

  const [isRecurring, setIsRecurring] = useState(false);
  const [recFrequency, setRecFrequency] = useState<"monthly" | "weekly">("monthly");
  const [recDayOfMonth, setRecDayOfMonth] = useState<number>(() => {
    const d = new Date(initial?.occurredOn ?? todayISO());
    return d.getDate();
  });
  const [recDayOfWeek, setRecDayOfWeek] = useState<number>(() => {
    const d = new Date(initial?.occurredOn ?? todayISO());
    return d.getDay();
  });

  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [nlPending, setNlPending] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredCats = categories.filter((c) => c.type === type);
  const incomeGoals = goals.filter((g) => g.status === "active");

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
      setScanMessage("Li a imagem e preenchi os campos — confira antes de salvar.");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Erro ao processar imagem");
    } finally {
      setScanning(false);
    }
  }

  async function handleAttachFile(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const result = await uploadAttachment(fd);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setAttachmentUrl(result.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setUploading(false);
    }
  }

  async function handleNL() {
    if (!nlInput.trim()) return;
    setNlPending(true);
    setNlError(null);
    try {
      const r = await parseNaturalLanguage(nlInput);
      if (!r.ok) {
        setNlError(r.error);
        return;
      }
      if (r.type) setType(r.type);
      if (r.amountCents && r.amountCents > 0) setAmountCents(r.amountCents);
      if (r.description) setDescription(r.description);
      if (r.occurredOn) setOccurredOn(r.occurredOn);
      if (r.categoryId) setCategoryId(r.categoryId);
      if (r.tags?.length) setTagsInput(r.tags.join(", "));
      setNlInput("");
    } catch (err) {
      setNlError(err instanceof Error ? err.message : "Erro");
    } finally {
      setNlPending(false);
    }
  }

  const busy = scanning || uploading || pending || nlPending;

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
        if (accounts.length > 0 && !accountId) {
          setError("Selecione uma conta");
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
              attachmentUrl: attachmentUrl ?? null,
              accountId: accountId || null,
              creditCardId: creditCardId || null,
              goalId: goalId || null,
              tags: tagsFromInput(tagsInput),
              installmentTotal: installments > 1 ? installments : null,
              createRecurring: isRecurring
                ? {
                    frequency: recFrequency,
                    dayOfMonth: recFrequency === "monthly" ? recDayOfMonth : null,
                    dayOfWeek: recFrequency === "weekly" ? recDayOfWeek : null,
                  }
                : null,
            });
            router.push("/transactions");
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao salvar");
          }
        });
      }}
    >
      {!initial && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <Label htmlFor="nl" className="text-xs uppercase text-muted-foreground">
            Lançar por texto (IA)
          </Label>
          <div className="flex gap-2">
            <Input
              id="nl"
              value={nlInput}
              onChange={(e) => setNlInput(e.target.value)}
              placeholder='Ex: "gastei 50 no mercado ontem"'
              disabled={busy}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleNL();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={busy || !nlInput.trim()}
              onClick={() => void handleNL()}
              aria-label="Interpretar"
            >
              {nlPending ? (
                <Sparkles className="h-4 w-4 animate-pulse" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
            </Button>
          </div>
          {nlError && <p className="text-xs text-destructive">{nlError}</p>}
        </div>
      )}

      <input
        ref={scanInputRef}
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
        disabled={busy}
        onClick={() => scanInputRef.current?.click()}
      >
        {scanning ? (
          <>
            <Sparkles className="h-4 w-4 animate-pulse" />
            Lendo imagem...
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            Escanear nota / comprovante
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
          setGoalId("");
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
            {filteredCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {accounts.length > 0 && (
        <div>
          <Label>Conta</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma conta" />
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
      )}

      {type === "expense" && creditCards.length > 0 && (
        <>
          <div>
            <Label>Cartão de crédito (opcional)</Label>
            <Select
              value={creditCardId || "__none__"}
              onValueChange={(v) => setCreditCardId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem cartão" />
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
          {!initial && creditCardId && (
            <div>
              <Label htmlFor="installments">
                Parcelar em
                {installments > 1 ? ` ${installments}x` : ""}
              </Label>
              <Input
                id="installments"
                type="number"
                min={1}
                max={48}
                value={installments}
                onChange={(e) =>
                  setInstallments(Math.max(1, Math.min(48, Number(e.target.value) || 1)))
                }
              />
              {installments > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Serão criados {installments} lançamentos mensais.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {type === "income" && incomeGoals.length > 0 && (
        <div>
          <Label>Contribuir para meta (opcional)</Label>
          <Select
            value={goalId || "__none__"}
            onValueChange={(v) => setGoalId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem meta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem meta</SelectItem>
              {incomeGoals.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

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

      <div>
        <Label htmlFor="tags">Tags (opcional)</Label>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="viagem, almoço, trabalho"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Separe por vírgulas. Ex.: viagem sp, almoço
        </p>
      </div>

      {initial?.recurringRuleId && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
          Este lançamento foi gerado por uma recorrência. Edite a regra em{" "}
          <a href="/recurring" className="font-medium text-primary">
            Recorrências
          </a>
          .
        </div>
      )}
      {installments <= 1 && !initial?.recurringRuleId && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            {initial
              ? "Transformar em pagamento recorrente"
              : "Pagamento recorrente (ex: assinatura, aluguel, salário)"}
          </label>
          {isRecurring && (
            <div className="flex flex-col gap-3">
              <div>
                <Label>Frequência</Label>
                <Select
                  value={recFrequency}
                  onValueChange={(v) => setRecFrequency(v as "monthly" | "weekly")}
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
              {recFrequency === "monthly" ? (
                <div>
                  <Label htmlFor="recDom">Dia do mês</Label>
                  <Input
                    id="recDom"
                    type="number"
                    min={1}
                    max={31}
                    value={recDayOfMonth}
                    onChange={(e) =>
                      setRecDayOfMonth(
                        Math.max(1, Math.min(31, Number(e.target.value) || 1)),
                      )
                    }
                  />
                </div>
              ) : (
                <div>
                  <Label>Dia da semana</Label>
                  <Select
                    value={String(recDayOfWeek)}
                    onValueChange={(v) => setRecDayOfWeek(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Domingo",
                        "Segunda",
                        "Terça",
                        "Quarta",
                        "Quinta",
                        "Sexta",
                        "Sábado",
                      ].map((w, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {initial
                  ? "Uma regra de recorrência será criada a partir deste lançamento e aparecerá em Recorrências."
                  : "Uma regra de recorrência será criada automaticamente junto com este lançamento."}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>Comprovante (opcional)</Label>
        <input
          ref={attachInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleAttachFile(f);
            e.target.value = "";
          }}
        />
        {attachmentUrl ? (
          <div className="flex items-center gap-2 rounded-md border p-2">
            {attachmentUrl.match(/\.(pdf)$/i) ? (
              <div className="flex h-14 w-14 items-center justify-center rounded bg-muted text-xs font-semibold">
                PDF
              </div>
            ) : (
              <img
                src={attachmentUrl}
                alt="Comprovante"
                className="h-14 w-14 rounded object-cover"
              />
            )}
            <a
              href={attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 truncate text-sm text-primary underline"
            >
              Ver comprovante
            </a>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setAttachmentUrl(null)}
              aria-label="Remover"
              disabled={busy}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => attachInputRef.current?.click()}
          >
            {uploading ? (
              <>Enviando...</>
            ) : (
              <>
                <Paperclip className="h-4 w-4" />
                Anexar comprovante (Pix, nota, PDF)
              </>
            )}
          </Button>
        )}
        {uploadError && (
          <p className="text-xs text-destructive">{uploadError}</p>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" size="lg" disabled={busy}>
        {pending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
