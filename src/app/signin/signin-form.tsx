"use client";

import { useActionState } from "react";
import { signInAction, type SignInFormState } from "./actions";

export function SignInForm() {
  const [state, action, pending] = useActionState<SignInFormState, FormData>(signInAction, {});
  return (
    <form action={action} noValidate>
      {state.message && <p role="alert">{state.message}</p>}
      <p>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} />
      </p>
      <p>
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" />
      </p>
      <button type="submit" disabled={pending}>
        Sign in
      </button>
    </form>
  );
}
