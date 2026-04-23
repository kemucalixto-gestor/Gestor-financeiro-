const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

export function formatBRLCompact(cents: number): string {
  const value = cents / 100;
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return BRL.format(value);
}

export function parseBRLToCents(input: string): number {
  if (!input) return 0;
  const normalized = input
    .replace(/\s|R\$/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = Number(normalized);
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
