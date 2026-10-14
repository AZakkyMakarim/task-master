"use client";

import { useActionState } from "react";
import { markDoneAction, type MarkDoneState } from "./actions";

/** One-action "mark done" for a task that is not done yet. */
export function MarkDoneButton({ id, title }: { id: number; title: string }) {
  const [state, action, pending] = useActionState<MarkDoneState, FormData>(markDoneAction, {});
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Mark ${title} done`} disabled={pending}>
        Mark done
      </button>
      {state.message && <span role="alert">{state.message}</span>}
    </form>
  );
}
