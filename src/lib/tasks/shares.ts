import { now } from "../clock";
import { normaliseEmail, type CurrentUser } from "../accounts";
import { getDb } from "../db";
import { getVisibleTask } from "./access";
import { ARCHIVED_MESSAGE } from "./archived";
import type { ShareRole } from "./types";

/**
 * Managing shares. Only the owner may share a task or see who it is shared
 * with; that is decided from getVisibleTask()'s access, never re-derived here.
 * What a recipient may do is decided by access.ts. Follow-up tickets extend
 * this module.
 */
export const SHARE_ROLES: readonly ShareRole[] = ["view", "edit"];

export type Share = { taskId: number; recipientId: number; recipientEmail: string; role: ShareRole };

export type ShareResult = { ok: true } | { ok: false; field: "email" | "role" | "task"; message: string };

/** Shares a task the user owns with the registered user at `rawEmail`. Sharing again with the same recipient sets the role. */
export async function shareTask(owner: CurrentUser, taskId: number, rawEmail: string, role: string): Promise<ShareResult> {
  const found = await getVisibleTask(owner, taskId);
  if (!found || found.access !== "owner") return { ok: false, field: "task", message: "Task not found." };
  if (found.archived) return { ok: false, field: "task", message: ARCHIVED_MESSAGE };
  if (!SHARE_ROLES.includes(role as ShareRole)) return { ok: false, field: "role", message: "Choose view or edit." };
  const email = normaliseEmail(rawEmail);
  if (!email) return { ok: false, field: "email", message: "Enter the email of the user to share with." };
  const db = await getDb();
  const recipient = await db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst();
  if (!recipient) return { ok: false, field: "email", message: "No user has that email." };
  if (recipient.id === owner.id) return { ok: false, field: "email", message: "You cannot share a task with yourself." };
  await db
    .insertInto("shares")
    .values({ task_id: taskId, recipient_id: recipient.id, role: role as ShareRole, created_at: (await now()).toISOString() })
    .onConflict((oc) => oc.columns(["task_id", "recipient_id"]).doUpdateSet({ role: role as ShareRole }))
    .execute();
  return { ok: true };
}

/** Every share on a task, oldest first. Empty unless the user owns the task. */
export async function listShares(user: CurrentUser, taskId: number): Promise<Share[]> {
  const found = await getVisibleTask(user, taskId);
  if (!found || found.access !== "owner") return [];
  const db = await getDb();
  const rows = await db
    .selectFrom("shares")
    .innerJoin("users", "users.id", "shares.recipient_id")
    .select(["shares.task_id", "shares.recipient_id", "users.email", "shares.role"])
    .where("shares.task_id", "=", taskId)
    .orderBy("shares.created_at")
    .orderBy("users.email")
    .execute();
  return rows.map((r) => ({ taskId: r.task_id, recipientId: r.recipient_id, recipientEmail: r.email, role: r.role }));
}

/** Which of the user's own tasks have at least one share (for the "Shared" mark in "My tasks"). */
export async function sharedTaskIds(owner: CurrentUser, taskIds: number[]): Promise<Set<number>> {
  if (taskIds.length === 0) return new Set();
  const db = await getDb();
  const rows = await db
    .selectFrom("shares")
    .innerJoin("tasks", "tasks.id", "shares.task_id")
    .select("shares.task_id")
    .distinct()
    .where("tasks.owner_id", "=", owner.id)
    .where("shares.task_id", "in", taskIds)
    .execute();
  return new Set(rows.map((r) => r.task_id));
}

/** Removes a share from a task the user owns. Anyone else gets the same answer as for a missing task. */
export async function revokeShare(owner: CurrentUser, taskId: number, recipientId: number): Promise<ShareResult> {
  const found = await getVisibleTask(owner, taskId);
  if (!found || found.access !== "owner") return { ok: false, field: "task", message: "Task not found." };
  if (found.archived) return { ok: false, field: "task", message: ARCHIVED_MESSAGE };
  const db = await getDb();
  await db.deleteFrom("shares").where("task_id", "=", taskId).where("recipient_id", "=", recipientId).execute();
  return { ok: true };
}
