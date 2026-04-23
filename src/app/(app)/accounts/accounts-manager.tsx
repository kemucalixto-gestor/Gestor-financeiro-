"use client";

import { useState, useTransition } from "react";
import { ArrowRightLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Account } from "@/db/schema";
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
import { formatBRL } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { deleteAccount, saveAccount } from "@/server/actions/accounts";
import { createTransfer } from "@/server/actions/transactions";

const TYPE_LABEL: Record<Account["type"], string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  digital_wallet: "Carteira digital",
  other: "Outro",
};

const COLORS = [
  "#2563eb", "#16a34a", "#ef4444", "#f97316", "#eab308",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b",
];

export function AccountsManager({
  initial,
  balances,
}: {
  initial: Account[];
  balances: Record<string, number>;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Account | null | "new">(null);
  const [transferring, setTransferring] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            Crie suas contas (banco, carteira, dinheiro) para organizar os lançamentos.
          </CardContent>
        </Card>
      )}
      {items.map((a) => {
        const balance = balances[a.id] ?? 0;
        return (
          <Card key={a.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <span
                className="h-10 w-10 shrink-0 rounded-full"
                style={{ background: a.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {TYPE_LABEL[a.type]}
                </p>
              </div>
              <div className="text-right">
                <p
                  className={`text-sm font-semibold ${
                    balance >= 0 ? "text-income" : "text-expense"
                  }`}
                >
                  {formatBRL(balance)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing(a)}
                aria-label="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Excluir a conta "${a.name}"? Os lançamentos ficam sem conta.`)) return;
                  startTransition(async () => {
                    try {
                      await deleteAccount(a.id);
                      setItems((x) => x.filter((i) => i.id !== a.id));
                    } catch {
                      alert("Não foi possível excluir.");
                    }
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
        <Button variant="outline" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4" /> Nova conta
        </Button>
        <Button
          variant="outline"
          disabled={items.length < 2}
          onClick={() => setTransferring(true)}
        >
          <ArrowRightLeft className="h-4 w-4" /> Transferir
        </Button>
      </div>

      {editing !== null && (
        <AccountEditor
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
      {transferring && (
        <TransferEditor
          accounts={items}
          onClose={() => setTransferring(false)}
          onSaved={() => {
            setTransferring(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function AccountEditor({
  initial,
  onClose,
  onSaved,
}: {
  initial: Account | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<Account["type"]>(initial?.type ?? "checking");
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [balance, setBalance] = useState(initial?.initialBalanceCents ?? 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? "Editar conta" : "Nova conta"}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as Account["type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABEL) as Array<keyof typeof TYPE_LABEL>).map((k) => (
                  <SelectItem key={k} value={k}>{TYPE_LABEL[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Saldo inicial</Label>
            <MoneyInput valueCents={balance} onChange={setBalance} />
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
                await saveAccount({
                  id: initial?.id,
                  name: name.trim(),
                  type,
                  color,
                  initialBalanceCents: balance,
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

function TransferEditor({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fromId, setFromId] = useState(accounts[0]?.id ?? "");
  const [toId, setToId] = useState(accounts[1]?.id ?? "");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Transferir entre contas</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label>De</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Para</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {accounts.filter(a => a.id !== fromId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor</Label>
            <MoneyInput valueCents={amount} onChange={setAmount} />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button disabled={pending || amount <= 0 || !fromId || !toId || fromId === toId} onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                await createTransfer({
                  fromAccountId: fromId,
                  toAccountId: toId,
                  amountCents: amount,
                  occurredOn: date,
                  description,
                });
                onSaved();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Erro");
              }
            });
          }}>
            {pending ? "Enviando..." : "Transferir"}
          </Button>
        </div>
      </div>
    </div>
  );
}
