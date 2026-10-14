import type { Task } from "./types";

export const ARCHIVE_AFTER_DAYS = 30;

/**
 * The one definition of "archived task": completed more than 30 days before
 * `now`. A task completed exactly 30 days ago is not archived yet. Derived on
 * every request from the completion moment and the application clock, never
 * stored; there is no background job. Callers pass the clock's `now()`.
 */
export function isArchived(task: Pick<Task, "completedAt">, now: Date): boolean {
  if (task.completedAt === null) return false;
  return now.getTime() - new Date(task.completedAt).getTime() > ARCHIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** Why every change to an archived task, its shares included, is refused. */
export const ARCHIVED_MESSAGE = "Archived tasks cannot be changed.";
