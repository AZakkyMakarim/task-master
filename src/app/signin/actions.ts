"use server";

import { redirect } from "next/navigation";
import { authenticate, endSession, INVALID_CREDENTIALS, startSession } from "@/lib/accounts";

export type SignInFormState = { message?: string; email?: string };

export async function signInAction(_prev: SignInFormState, form: FormData): Promise<SignInFormState> {
  const email = String(form.get("email") ?? "");
  const user = await authenticate(email, String(form.get("password") ?? ""));
  if (!user) return { message: INVALID_CREDENTIALS, email };
  await startSession(user.id);
  redirect("/tasks");
}

export async function signOutAction(): Promise<void> {
  await endSession();
  redirect("/signin");
}
