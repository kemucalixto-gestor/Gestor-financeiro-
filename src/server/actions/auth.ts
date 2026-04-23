"use server";

import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { categories, users } from "@/db/schema";
import { signIn, signOut } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";

const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome").max(80),
    email: z.string().trim().toLowerCase().email("E-mail inválido"),
    password: z.string().min(6, "Mínimo de 6 caracteres").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
  });

export type ActionState = { error?: string } | undefined;

export async function signupAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const { name, email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) return { error: "Este e-mail já está cadastrado" };

  const passwordHash = await bcrypt.hash(password, 10);

  const [created] = await db
    .insert(users)
    .values({ email, passwordHash, name })
    .returning();

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((c) => ({
      userId: created.id,
      name: c.name,
      type: c.type,
      color: c.color,
      icon: c.icon,
    })),
  );

  try {
    await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Não foi possível entrar após o cadastro" };
    }
    throw err;
  }

  redirect("/dashboard");
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "E-mail ou senha inválidos" };
    }
    throw err;
  }

  const next = (formData.get("next") as string) || "/dashboard";
  redirect(next);
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}
