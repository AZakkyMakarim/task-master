"use client";

import { useActionState } from "react";
import type { Task } from "@/lib/tasks";
import { updateTaskAction, type EditTaskState } from "../actions";

export function EditTaskForm({ task }: { task: Task }) {
  const [state, action, pending] = useActionState<EditTaskState, FormData>(updateTaskAction, {});
  const values = state.values ?? { title: task.title, status: task.status, priority: task.priority, dueDate: task.dueDate ?? "", recurrence: task.recurrence };
  return (
    <form action={action} noValidate key={state.revision ?? 0}>
      <input type="hidden" name="id" value={task.id} />
      <p>
        <label htmlFor="task-title">Title</label>
        <input id="task-title" name="title" type="text" defaultValue={values.title} aria-invalid={state.field === "title" ? true : undefined} />
      </p>
      <p>
        <label htmlFor="task-status">Status</label>
        <select id="task-status" name="status" defaultValue={values.status}>
          <option value="todo">todo</option>
          <option value="doing">doing</option>
          <option value="done">done</option>
        </select>
      </p>
      <p>
        <label htmlFor="task-priority">Priority</label>
        <select id="task-priority" name="priority" defaultValue={values.priority}>
          <option value="low">low</option>
          <option value="medium">medium</option>
          <option value="high">high</option>
        </select>
      </p>
      <p>
        <label htmlFor="task-due-date">Due date</label>
        <input id="task-due-date" name="dueDate" type="date" defaultValue={values.dueDate} aria-invalid={state.field === "dueDate" ? true : undefined} />
      </p>
      <p>
        <label htmlFor="task-recurrence">Recurrence</label>
        <select id="task-recurrence" name="recurrence" defaultValue={values.recurrence}>
          <option value="none">none</option>
          <option value="daily">daily</option>
          <option value="weekly">weekly</option>
        </select>
      </p>
      <button type="submit" disabled={pending}>
        Save
      </button>
      {state.message && <p role="alert">{state.message}</p>}
      {state.saved && !state.message && <p role="status">Saved</p>}
    </form>
  );
}
