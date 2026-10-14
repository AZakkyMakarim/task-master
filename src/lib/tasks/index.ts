import { now } from "../clock";
import type { CurrentUser } from "../accounts";
import { getDb } from "../db";
import { MAX_TITLE_LENGTH, type Priority, type Recurrence, type Status, type Task } from "./types";
import { canChange, getVisibleTask } from "./access";
import { ARCHIVED_MESSAGE } from "./archived";



const NOT_ALLOWED_MESSAGE = "You are not allowed to change this task.";

/** Why the user may not change the task, or null when they may. A task they cannot see looks missing. */
function changeRefusal(found: Awaited<ReturnType<typeof getVisibleTask>>): string | null {
  if (!found) return "Task not found.";
  if (found.access === "view") return NOT_ALLOWED_MESSAGE;
  return canChange(found) ? null : ARCHIVED_MESSAGE;
}

export type TitleResult = { ok: true; title: string } | { ok: false; message: string };

/** The one place a task title is validated (create now; rename in a later ticket). */
export function validateTitle(raw: string): TitleResult {
  const title = raw.trim();
  if (!title) return { ok: false, message: "A title is required." };
  if (title.length > MAX_TITLE_LENGTH) {
    return { ok: false, message: `The title is too long (${MAX_TITLE_LENGTH} characters at most).` };
  }
  return { ok: true, title };
}

export type CreateTaskResult = { ok: true; task: Task } | { ok: false; field: "title"; message: string };

/** Creates a task owned by `owner`: status todo, priority medium, no due date, recurrence none. */
export async function createTask(owner: CurrentUser, rawTitle: string): Promise<CreateTaskResult> {
  const valid = validateTitle(rawTitle);
  if (!valid.ok) return { ok: false, field: "title", message: valid.message };
  const db = await getDb();
  const row = await db
    .insertInto("tasks")
    .values({
      owner_id: owner.id,
      title: valid.title,
      due_date: null,
      completed_at: null,
      created_at: (await now()).toISOString(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  const found = await getVisibleTask(owner, row.id);
  return { ok: true, task: found!.task };
}

export type TaskEdit = { title: string; status: string; priority: string; dueDate: string; recurrence: string };

export type UpdateTaskResult =
  | { ok: true; task: Task }
  | { ok: false; field: "title" | "status" | "priority" | "dueDate" | "recurrence" | "task"; message: string };

const STATUSES: readonly Status[] = ["todo", "doing", "done"];
const PRIORITIES: readonly Priority[] = ["low", "medium", "high"];
const RECURRENCES: readonly Recurrence[] = ["none", "daily", "weekly"];

function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Edits title, priority, due date (empty clears it) and recurrence of a task the
 * user may change (owner or edit recipient). Access is decided by access.ts.
 */
export async function updateTask(user: CurrentUser, id: number, edit: TaskEdit): Promise<UpdateTaskResult> {
  const found = await getVisibleTask(user, id);
  const refusal = changeRefusal(found);
  if (!found) return { ok: false, field: "task", message: refusal! };
  if (refusal) return { ok: false, field: "task", message: refusal };
  const valid = validateTitle(edit.title);
  if (!valid.ok) return { ok: false, field: "title", message: valid.message };
  if (!STATUSES.includes(edit.status as Status)) return { ok: false, field: "status", message: "Choose todo, doing or done." };
  const status = edit.status as Status;
  if (!PRIORITIES.includes(edit.priority as Priority)) return { ok: false, field: "priority", message: "Choose low, medium or high." };
  if (!RECURRENCES.includes(edit.recurrence as Recurrence)) return { ok: false, field: "recurrence", message: "Choose none, daily or weekly." };
  const dueDate = edit.dueDate.trim();
  if (dueDate && !isCalendarDay(dueDate)) return { ok: false, field: "dueDate", message: "Enter a valid due date." };
  const db = await getDb();
  await db
    .updateTable("tasks")
    .set({
      title: valid.title,
      status,
      completed_at: await completionMoment(found.task, status),
      priority: edit.priority as Priority,
      due_date: dueDate || null,
      recurrence: edit.recurrence as Recurrence,
    })
    .where("id", "=", id)
    .execute();
  const updated = await getVisibleTask(user, id);
  return { ok: true, task: updated!.task };
}

/**
 * The completion moment a task carries after moving to `status`: the clock's
 * "now" when it becomes done, cleared when it leaves done, untouched while it
 * stays done (or stays not done).
 */
async function completionMoment(task: Task, status: Status): Promise<string | null> {
  if (status !== "done") return null;
  if (task.status === "done") return task.completedAt;
  return (await now()).toISOString();
}

/** Moves a task the user may change to `status` ("mark done" uses this). */
export async function setTaskStatus(user: CurrentUser, id: number, status: string): Promise<UpdateTaskResult> {
  const found = await getVisibleTask(user, id);
  const refusal = changeRefusal(found);
  if (!found) return { ok: false, field: "task", message: refusal! };
  if (refusal) return { ok: false, field: "task", message: refusal };
  if (!STATUSES.includes(status as Status)) return { ok: false, field: "status", message: "Choose todo, doing or done." };
  const db = await getDb();
  await db
    .updateTable("tasks")
    .set({ status: status as Status, completed_at: await completionMoment(found.task, status as Status) })
    .where("id", "=", id)
    .execute();
  const updated = await getVisibleTask(user, id);
  return { ok: true, task: updated!.task };
}

export { listVisibleTasks, listSharedWithMe, getVisibleTask, accessFor, canChange, type TaskAccess, type SharedTask } from "./access";
export { shareTask, revokeShare, listShares, sharedTaskIds, type Share, type ShareResult } from "./shares";
export * from "./types";
export * from "./list-query";
export { isOverdue } from "./overdue";
export { isArchived } from "./archived";

export type DeleteTaskResult = { ok: true } | { ok: false; message: string };

/** Deletes a task the user owns. Anyone else gets the same answer as for a missing task. */
export async function deleteTask(user: CurrentUser, id: number): Promise<DeleteTaskResult> {
  const found = await getVisibleTask(user, id);
  if (!found || found.access !== "owner") return { ok: false, message: "Task not found." };
  const db = await getDb();
  await db.deleteFrom("tasks").where("id", "=", id).execute();
  return { ok: true };
}
