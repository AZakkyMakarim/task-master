"use client";

import { useActionState } from "react";
import { revokeShareAction, shareTaskAction, type RevokeShareState, type ShareTaskState } from "./actions";

/** The owner's form to share a task: the recipient's email and the role to give. */
export function ShareForm({ id }: { id: number }) {
  const [state, action, pending] = useActionState<ShareTaskState, FormData>(shareTaskAction, {});
  return (
    <form action={action} noValidate key={state.saved ?? 0}>
      <input type="hidden" name="id" value={id} />
      <p>
        <label htmlFor="share-email">Share with (email)</label>
        <input
          id="share-email"
          name="email"
          type="text"
          defaultValue={state.email}
          aria-invalid={state.field === "email" ? true : undefined}
          aria-describedby={state.message ? "share-error" : undefined}
        />
      </p>
      <p>
        <label htmlFor="share-role">Role</label>
        <select id="share-role" name="role" defaultValue={state.role ?? "view"}>
          <option value="view">view</option>
          <option value="edit">edit</option>
        </select>
      </p>
      <button type="submit" disabled={pending}>
        Share
      </button>
      {state.message && (
        <p id="share-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}

/** The owner's "Revoke" for one recipient's share. */
export function RevokeShareButton({ id, recipientId, email }: { id: number; recipientId: number; email: string }) {
  const [state, action, pending] = useActionState<RevokeShareState, FormData>(revokeShareAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="recipientId" value={recipientId} />
      <button type="submit" disabled={pending} aria-label={`Revoke ${email}`}>
        Revoke
      </button>
      {state.message && <p role="alert">{state.message}</p>}
    </form>
  );
}
