"use client";

import { useActionState } from "react";
import { registerAction, type RegisterFormState } from "./actions";

export function RegisterForm() {
  const [state, action, pending] = useActionState<RegisterFormState, FormData>(registerAction, {});
  return (
    <form action={action} noValidate>
      <p>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          aria-invalid={state.field === "email"}
          aria-describedby={state.field === "email" ? "email-error" : undefined}
        />
      </p>
      {state.field === "email" && (
        <p id="email-error" role="alert">
          {state.message}
        </p>
      )}
      <p>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={state.field === "password"}
          aria-describedby={state.field === "password" ? "password-error" : undefined}
        />
      </p>
      {state.field === "password" && (
        <p id="password-error" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending}>
        Register
      </button>
    </form>
  );
}
