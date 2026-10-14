import type { CurrentUser } from "../accounts";
import { getDb } from "../db";
import { sql } from "kysely";
import { now, today } from "../clock";
import { isOverdue } from "./overdue";
import { isArchived } from "./archived";
import { DEFAULT_LIST_QUERY, type ListQuery } from "./list-query";
import type { ShareRole, Task } from "./types";

/**
 * Task access: the single place that answers "what may this user do with this
 * task?". Every read of a task goes through it. Archived tasks are read-only
 * (canChange); the owner may still delete them. Recipients get their access
 * from their share's role, here and nowhere else.  The
 * edit role may change a task; it cannot delete it or manage its shares.
 */
export type TaskAccess = "owner" | "edit" | "view" | "none";

/** `role` is the user's share role on the task, or null/undefined when the task is not shared with them. */
export function accessFor(user: CurrentUser, task: Pick<Task, "ownerId">, role?: ShareRole | null): TaskAccess {
  if (task.ownerId === user.id) return "owner";
  return role ?? "none";
}


type Row = Awaited<ReturnType<typeof selectRows>>[number];

/**
 * Rows the user may see in "My tasks", narrowed and ordered by `query`.
 * Narrowing by owner is the SQL form of accessFor() for listing; it must stay
 * equivalent to it (the rows are re-checked by the caller). Later list kinds
 * (shared, archived, overdue) add their conditions here.
 */
async function selectRows(ownerId: number, query: ListQuery) {
  const db = await getDb();
  let q = db.selectFrom("tasks").selectAll().where("owner_id", "=", ownerId);
  if (query.status) q = q.where("status", "=", query.status);
  if (query.priority) q = q.where("priority", "=", query.priority);
  if (query.sort === "due") {
    q = q.orderBy(sql`due_date IS NULL`).orderBy("due_date", "asc");
  } else if (query.sort === "priority") {
    q = q.orderBy(sql`CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END`);
  }
  return q.orderBy("id", "desc").execute();
}

export function toTask(row: Row): Task {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    recurrence: row.recurrence,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

/** Tasks the user may see in "My tasks": the ones they own, ordered by the query (newest first by default). */
export async function listVisibleTasks(user: CurrentUser, query: ListQuery = DEFAULT_LIST_QUERY): Promise<Task[]> {
  const moment = await now();
  const tasks = (await selectRows(user.id, query))
    .map(toTask)
    .filter((t) => accessFor(user, t) === "owner" && (query.includeArchived || !isArchived(t, moment)));
  if (!query.overdueOnly) return tasks;
  const day = await today();
  return tasks.filter((t) => isOverdue(t, day));
}

/** The user's share role on a task, or null when the task is not shared with them. */
async function shareRole(userId: number, taskId: number): Promise<ShareRole | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("shares")
    .select("role")
    .where("task_id", "=", taskId)
    .where("recipient_id", "=", userId)
    .executeTakeFirst();
  return row?.role ?? null;
}

export type SharedTask = { task: Task; ownerEmail: string; role: ShareRole };

/**
 * Tasks shared with the user ("Shared with me"), newest first. The share join is
 * the SQL form of accessFor() for recipients; rows are re-checked through it.
 * Tasks the user owns never appear here.
 */
export async function listSharedWithMe(user: CurrentUser, options: { includeArchived?: boolean } = {}): Promise<SharedTask[]> {
  const moment = await now();
  const db = await getDb();
  const rows = await db
    .selectFrom("shares")
    .innerJoin("tasks", "tasks.id", "shares.task_id")
    .innerJoin("users as owners", "owners.id", "tasks.owner_id")
    .selectAll("tasks")
    .select(["owners.email as owner_email", "shares.role as share_role"])
    .where("shares.recipient_id", "=", user.id)
    .orderBy("tasks.id", "desc")
    .execute();
  return rows
    .map((row) => ({ task: toTask(row), ownerEmail: row.owner_email, role: row.share_role }))
    .filter((s) => accessFor(user, s.task, s.role) !== "none" && (options.includeArchived || !isArchived(s.task, moment)));
}

/** One task if the user may see it, else null (a missing task and a forbidden one look the same). */
export async function getVisibleTask(
  user: CurrentUser,
  id: number,
): Promise<{ task: Task; access: TaskAccess; archived: boolean; ownerEmail: string; role: ShareRole | null } | null> {
  const db = await getDb();
  const row = await db
    .selectFrom("tasks")
    .innerJoin("users as owners", "owners.id", "tasks.owner_id")
    .selectAll("tasks")
    .select("owners.email as owner_email")
    .where("tasks.id", "=", id)
    .executeTakeFirst();
  if (!row) return null;
  const task = toTask(row);
  const role = task.ownerId === user.id ? null : await shareRole(user.id, id);
  const access = accessFor(user, task, role);
  return access === "none" ? null : { task, access, archived: isArchived(task, await now()), ownerEmail: row.owner_email, role };
}

/** May the user change this task's fields or status? Owner and edit recipients may; an archived task is read-only for everyone. */
export function canChange(found: { access: TaskAccess; archived: boolean }): boolean {
  return (found.access === "owner" || found.access === "edit") && !found.archived;
}
