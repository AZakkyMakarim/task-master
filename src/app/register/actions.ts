"use server";

import { redirect } from "next/navigation";
import { registerUser, startSession } from "@/lib/accounts";

export type RegisterFormState = { field?: "email" | "password"; message?: string; email?: string };

export async function registerAction(_prev: RegisterFormState, form: FormData): Promise<RegisterFormState> {
  const email = String(form.get("email") ?? "");
  const result = await registerUser(email, String(form.get("password") ?? ""));
  if (!result.ok) return { field: result.field, message: result.message, email };
  await startSession(result.user.id);
  redirect("/tasks");
}
