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

export const recurringRules = sqliteTable("recurring_rules", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),
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
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull().default(""),
  occurredOn: text("occurred_on").notNull(),
  attachmentUrl: text("attachment_url"),
  recurringRuleId: text("recurring_rule_id").references(
    () => recurringRules.id,
    { onDelete: "set null" },
  ),
  createdAt: text("created_at").notNull().default(now()),
}, (t) => ({
  byUserDate: index("transactions_user_date_idx").on(t.userId, t.occurredOn),
  byCategory: index("transactions_category_idx").on(t.categoryId),
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
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type RecurringRule = typeof recurringRules.$inferSelect;
