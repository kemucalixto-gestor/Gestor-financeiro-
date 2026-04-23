"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import type { Category } from "@/db/schema";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Props {
  categories: Category[];
  currentQ: string;
  currentType: string;
  currentCategory: string;
  month: string;
}

export function TransactionsFilter({
  categories,
  currentQ,
  currentType,
  currentCategory,
  month,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(currentQ);
  const [type, setType] = useState(currentType);
  const [category, setCategory] = useState(currentCategory);

  useEffect(() => {
    setQ(currentQ);
    setType(currentType);
    setCategory(currentCategory);
  }, [currentQ, currentType, currentCategory]);

  function apply(next: { q?: string; type?: string; category?: string }) {
    const params = new URLSearchParams();
    params.set("month", month);
    const finalQ = next.q ?? q;
    const finalType = next.type ?? type;
    const finalCategory = next.category ?? category;
    if (finalQ.trim()) params.set("q", finalQ.trim());
    if (finalType) params.set("type", finalType);
    if (finalCategory) params.set("category", finalCategory);
    router.push(`/transactions?${params.toString()}`);
  }

  const hasFilter = q || type || category;

  const filteredCats = type
    ? categories.filter((c) => c.type === type)
    : categories;

  return (
    <div className="flex flex-col gap-2">
      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault();
          apply({});
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por descrição ou tag..."
          className="pl-9 pr-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              apply({ q: "" });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
            aria-label="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      <div className="flex gap-2">
        <Select
          value={type || "all"}
          onValueChange={(v) => {
            const next = v === "all" ? "" : v;
            setType(next);
            setCategory("");
            apply({ type: next, category: "" });
          }}
        >
          <SelectTrigger className="h-9 flex-1">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="transfer">Transferências</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={category || "all"}
          onValueChange={(v) => {
            const next = v === "all" ? "" : v;
            setCategory(next);
            apply({ category: next });
          }}
        >
          <SelectTrigger className="h-9 flex-1">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {filteredCats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilter && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setQ("");
              setType("");
              setCategory("");
              router.push(`/transactions?month=${month}`);
            }}
            aria-label="Limpar filtros"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
