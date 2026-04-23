import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const now = () => sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  emailIdx: uniqueIndex("users_email_uidx").on(t.email),
}));

export const categories = sqliteTable("categories", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  color: text("color").notNull().default("#64748b"),
  icon: text("icon").notNull().default("circle"),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUser: index("categories_user_idx").on(t.userId),
}));

export const accounts = sqliteTable("accounts", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["checking", "savings", "cash", "digital_wallet", "other"],
  }).notNull().default("checking"),
  color: text("color").notNull().default("#2563eb"),
  icon: text("icon").notNull().default("wallet"),
  initialBalanceCents: integer("initial_balance_cents").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUser: index("accounts_user_idx").on(t.userId),
}));

export const creditCards = sqliteTable("credit_cards", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  brand: text("brand", {
    enum: ["visa", "master", "elo", "amex", "hiper", "other"],
  }).notNull().default("other"),
  closingDay: integer("closing_day").notNull(),
  dueDay: integer("due_day").notNull(),
  limitCents: integer("limit_cents").notNull().default(0),
  color: text("color").notNull().default("#111827"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUser: index("credit_cards_user_idx").on(t.userId),
}));

export const goals = sqliteTable("goals", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  targetCents: integer("target_cents").notNull(),
  targetDate: text("target_date"),
  currentCents: integer("current_cents").notNull().default(0),
  color: text("color").notNull().default("#22c55e"),
  icon: text("icon").notNull().default("target"),
  status: text("status", { enum: ["active", "completed", "cancelled"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUser: index("goals_user_idx").on(t.userId),
}));

export const recurringRules = sqliteTable("recurring_rules", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull().default(""),
  frequency: text("frequency", { enum: ["monthly", "weekly"] }).notNull(),
  dayOfMonth: integer("day_of_month"),
  dayOfWeek: integer("day_of_week"),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on"),
  lastGeneratedOn: text("last_generated_on"),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUser: index("recurring_user_idx").on(t.userId),
}));

export const transactions = sqliteTable("transactions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
  accountId: text("account_id").references(() => accounts.id, {
    onDelete: "set null",
  }),
  creditCardId: text("credit_card_id").references(() => creditCards.id, {
    onDelete: "set null",
  }),
  goalId: text("goal_id").references(() => goals.id, {
    onDelete: "set null",
  }),
  type: text("type", { enum: ["income", "expense", "transfer"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull().default(""),
  occurredOn: text("occurred_on").notNull(),
  tagsJson: text("tags_json"),
  attachmentUrl: text("attachment_url"),
  installmentGroupId: text("installment_group_id"),
  installmentNumber: integer("installment_number"),
  installmentTotal: integer("installment_total"),
  transferPairId: text("transfer_pair_id"),
  recurringRuleId: text("recurring_rule_id").references(
    () => recurringRules.id,
    { onDelete: "set null" },
  ),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUserDate: index("transactions_user_date_idx").on(t.userId, t.occurredOn),
  byCategory: index("transactions_category_idx").on(t.categoryId),
  byAccount: index("transactions_account_idx").on(t.accountId),
  byCard: index("transactions_card_idx").on(t.creditCardId),
  byGoal: index("transactions_goal_idx").on(t.goalId),
}));

export const budgets = sqliteTable("budgets", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  month: text("month").notNull(),
  limitCents: integer("limit_cents").notNull(),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  unique: uniqueIndex("budgets_user_cat_month_uidx").on(
    t.userId,
    t.categoryId,
    t.month,
  ),
  byUserMonth: index("budgets_user_month_idx").on(t.userId, t.month),
}));

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type CreditCard = typeof creditCards.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
