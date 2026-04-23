export const DEFAULT_CATEGORIES: Array<{
  name: string;
  type: "income" | "expense";
  color: string;
  icon: string;
}> = [
  { name: "Salário", type: "income", color: "#16a34a", icon: "briefcase" },
  { name: "Freelance / Extras", type: "income", color: "#0ea5e9", icon: "wallet" },
  { name: "Investimentos", type: "income", color: "#8b5cf6", icon: "trending-up" },
  { name: "Alimentação", type: "expense", color: "#ef4444", icon: "utensils" },
  { name: "Transporte", type: "expense", color: "#f97316", icon: "car" },
  { name: "Moradia", type: "expense", color: "#eab308", icon: "home" },
  { name: "Saúde", type: "expense", color: "#ec4899", icon: "heart-pulse" },
  { name: "Educação", type: "expense", color: "#6366f1", icon: "graduation-cap" },
  { name: "Lazer", type: "expense", color: "#14b8a6", icon: "gamepad-2" },
  { name: "Assinaturas", type: "expense", color: "#a855f7", icon: "credit-card" },
  { name: "Mercado", type: "expense", color: "#84cc16", icon: "shopping-cart" },
  { name: "Outros", type: "expense", color: "#64748b", icon: "circle" },
];
