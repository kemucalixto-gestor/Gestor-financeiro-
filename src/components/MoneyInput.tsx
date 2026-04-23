"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { centsToDecimalString, parseBRLToCents } from "@/lib/money";

interface Props {
  valueCents: number;
  onChange: (cents: number) => void;
  id?: string;
  placeholder?: string;
}

export function MoneyInput({ valueCents, onChange, id, placeholder }: Props) {
  const [raw, setRaw] = React.useState(
    valueCents > 0 ? centsToDecimalString(valueCents) : "",
  );

  React.useEffect(() => {
    const parsed = parseBRLToCents(raw);
    if (parsed !== valueCents && raw !== centsToDecimalString(valueCents)) {
      setRaw(valueCents > 0 ? centsToDecimalString(valueCents) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueCents]);

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
        R$
      </span>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={placeholder ?? "0,00"}
        className="pl-10"
        value={raw}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9,]/g, "");
          setRaw(v);
          onChange(parseBRLToCents(v));
        }}
      />
    </div>
  );
}
