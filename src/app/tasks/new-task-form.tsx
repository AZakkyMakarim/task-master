"use client";

import { useActionState } from "react";
import { createTaskAction, type NewTaskState } from "./actions";

export function NewTaskForm() {
  const [state, action, pending] = useActionState<NewTaskState, FormData>(createTaskAction, {});
  return (
    <form action={action} noValidate key={state.saved ?? 0}>
      <p>
        <label htmlFor="new-task-title">New task title</label>
        <input
          id="new-task-title"
          name="title"
          type="text"
          defaultValue={state.title}
          aria-invalid={state.message ? true : undefined}
          aria-describedby={state.message ? "new-task-error" : undefined}
        />
        <button type="submit" disabled={pending}>
          Add task
        </button>
      </p>
      {state.message && (
        <p id="new-task-error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
