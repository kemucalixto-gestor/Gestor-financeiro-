"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Pencil, X } from "lucide-react";
import type { Category } from "@/db/schema";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deleteCategory, saveCategory } from "@/server/actions/categories";
import { Card, CardContent } from "@/components/ui/card";

const COLORS = [
  "#16a34a", "#0ea5e9", "#8b5cf6", "#ef4444", "#f97316",
  "#eab308", "#ec4899", "#6366f1", "#14b8a6", "#a855f7",
  "#84cc16", "#64748b",
];

type Editing =
  | { mode: "create"; type: "income" | "expense" }
  | { mode: "edit"; category: Category }
  | null;

export function CategoriesManager({ initial }: { initial: Category[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, startTransition] = useTransition();

  function renderList(type: "income" | "expense") {
    const list = items.filter((c) => c.type === type);
    return (
      <div className="flex flex-col gap-2">
        {list.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center gap-3 p-3">
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ background: c.color }}
              />
              <span className="flex-1 font-medium">{c.name}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditing({ mode: "edit", category: c })}
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
                  if (!confirm(`Excluir a categoria "${c.name}"?`)) return;
                  startTransition(async () => {
                    try {
                      await deleteCategory(c.id);
                      setItems((prev) => prev.filter((x) => x.id !== c.id));
                    } catch (err) {
                      alert("Não foi possível excluir — há lançamentos usando esta categoria.");
                    }
                  });
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        <Button
          variant="outline"
          onClick={() => setEditing({ mode: "create", type })}
          className="mt-2"
        >
          <Plus className="h-4 w-4" /> Nova categoria
        </Button>
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="expense" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expense">Despesas</TabsTrigger>
          <TabsTrigger value="income">Receitas</TabsTrigger>
        </TabsList>
        <TabsContent value="expense">{renderList("expense")}</TabsContent>
        <TabsContent value="income">{renderList("income")}</TabsContent>
      </Tabs>

      {editing && (
        <CategoryEditor
          editing={editing}
          onClose={() => setEditing(null)}
          onSaved={(cat) => {
            setItems((prev) => {
              const idx = prev.findIndex((x) => x.id === cat.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = cat;
                return next;
              }
              return [...prev, cat];
            });
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function CategoryEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: Exclude<Editing, null>;
  onClose: () => void;
  onSaved: (c: Category) => void;
}) {
  const initial = editing.mode === "edit" ? editing.category : null;
  const defaultType: "income" | "expense" =
    editing.mode === "edit" ? editing.category.type : editing.type;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<"income" | "expense">(defaultType);
  const [color, setColor] = useState(initial?.color ?? COLORS[0]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-background p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {initial ? "Editar categoria" : "Nova categoria"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="cat-name">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div>
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "income" | "expense")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Cor</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    color === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button
            disabled={pending || !name.trim()}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await saveCategory({
                    id: initial?.id,
                    name: name.trim(),
                    type,
                    color,
                    icon: initial?.icon ?? "circle",
                  });
                  onSaved({
                    id: initial?.id ?? crypto.randomUUID(),
                    userId: initial?.userId ?? "",
                    name: name.trim(),
                    type,
                    color,
                    icon: initial?.icon ?? "circle",
                    createdAt: initial?.createdAt ?? new Date().toISOString(),
                  });
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
