import type { Task } from "./types";

/**
 * The one definition of "overdue": the due date is before today and the status
 * is not done. A task due today is not overdue. Derived on every view from
 * `today` (the application clock's current calendar day), never stored.
 */
export function isOverdue(task: Pick<Task, "status" | "dueDate">, today: string): boolean {
  return task.status !== "done" && task.dueDate !== null && task.dueDate < today;
}
