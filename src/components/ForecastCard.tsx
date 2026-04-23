import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";
import type { MonthForecast } from "@/lib/forecast";

export function ForecastCard({ forecast }: { forecast: MonthForecast }) {
  const good = forecast.projectedBalance >= 0;
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5" />
          Previsão fim do mês
        </div>
        <p
          className={`text-2xl font-bold ${
            good ? "text-income" : "text-expense"
          }`}
        >
          {formatBRL(forecast.projectedBalance)}
        </p>
        <p className="text-xs text-muted-foreground">
          {forecast.daysRemaining} dias restantes. Inclui{" "}
          {formatBRL(forecast.recurringIncomePending)} de receitas recorrentes e{" "}
          {formatBRL(
            forecast.recurringExpensePending + forecast.projectedExpenseExtra,
          )}{" "}
          em despesas previstas (recorrentes + média diária).
        </p>
      </CardContent>
    </Card>
  );
}
