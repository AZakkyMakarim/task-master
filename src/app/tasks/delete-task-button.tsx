"use client";

import { useActionState, useId, useRef } from "react";
import { deleteTaskAction, type DeleteTaskState } from "./actions";

/**
 * "Delete" for a task, with a confirmation naming it. `redirectToTasks` is for
 * the task's own page, which no longer exists afterwards: the server redirects
 * to "My tasks" itself, so the deleted page is never rendered again.
 */
export function DeleteTaskButton({ id, title, redirectToTasks }: { id: number; title: string; redirectToTasks?: boolean }) {
  const [state, action, pending] = useActionState<DeleteTaskState, FormData>(deleteTaskAction, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  return (
    <>
      <button type="button" aria-label={`Delete ${title}`} onClick={() => dialog.current?.showModal()}>
        Delete
      </button>
      <dialog ref={dialog} aria-labelledby={titleId}>
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          {redirectToTasks && <input type="hidden" name="redirectToTasks" value="1" />}
          <p id={titleId}>Delete &ldquo;{title}&rdquo;? This cannot be undone.</p>
          <button type="submit" disabled={pending}>
            Delete task
          </button>{" "}
          <button type="button" onClick={() => dialog.current?.close()}>
            Cancel
          </button>
          {state.message && <p role="alert">{state.message}</p>}
        </form>
      </dialog>
    </>
  );
}
