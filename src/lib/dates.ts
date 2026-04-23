import {
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function currentMonthKey(date = new Date()): string {
  return format(date, "yyyy-MM");
}

export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

export function monthBounds(month: string): { start: string; end: string } {
  const ref = parseISO(`${month}-01`);
  return {
    start: format(startOfMonth(ref), "yyyy-MM-dd"),
    end: format(endOfMonth(ref), "yyyy-MM-dd"),
  };
}

export function formatMonthLabel(month: string): string {
  return format(parseISO(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

export function formatDateLabel(iso: string): string {
  return format(parseISO(iso), "dd 'de' MMM", { locale: ptBR });
}

export function lastNMonths(n: number, reference = new Date()): string[] {
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(monthKey(subMonths(reference, i)));
  }
  return months;
}

export function nextMonth(month: string): string {
  return monthKey(addMonths(parseISO(`${month}-01`), 1));
}
