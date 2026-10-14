"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/accounts";
import { createTask, deleteTask, revokeShare, setTaskStatus, shareTask, updateTask } from "@/lib/tasks";

export type NewTaskState = { message?: string; title?: string; saved?: number };

export async function createTaskAction(prev: NewTaskState, form: FormData): Promise<NewTaskState> {
  const user = await requireUser();
  const title = String(form.get("title") ?? "");
  const result = await createTask(user, title);
  if (!result.ok) return { message: result.message, title, saved: prev.saved };
  revalidatePath("/tasks");
  return { saved: (prev.saved ?? 0) + 1 };
}

export type EditTaskValues = { title: string; status: string; priority: string; dueDate: string; recurrence: string };
export type EditTaskState = { message?: string; field?: string; saved?: boolean; values?: EditTaskValues; revision?: number };

export async function updateTaskAction(prev: EditTaskState, form: FormData): Promise<EditTaskState> {
  const id = Number(form.get("id"));
  const user = await requireUser();
  const values: EditTaskValues = {
    title: String(form.get("title") ?? ""),
    status: String(form.get("status") ?? ""),
    priority: String(form.get("priority") ?? ""),
    dueDate: String(form.get("dueDate") ?? ""),
    recurrence: String(form.get("recurrence") ?? ""),
  };
  const revision = (prev.revision ?? 0) + 1;
  const result = await updateTask(user, id, values);
  if (!result.ok) return { message: result.message, field: result.field, values, revision };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { saved: true, values, revision };
}

export type DeleteTaskState = { message?: string };

export async function deleteTaskAction(_prev: DeleteTaskState, form: FormData): Promise<DeleteTaskState> {
  const id = Number(form.get("id"));
  const user = await requireUser();
  const result = await deleteTask(user, id);
  if (!result.ok) return { message: result.message };
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  if (form.get("redirectToTasks")) redirect("/tasks");
  return {};
}

export type MarkDoneState = { message?: string };

export async function markDoneAction(_prev: MarkDoneState, form: FormData): Promise<MarkDoneState> {
  const id = Number(form.get("id"));
  const user = await requireUser();
  const result = await setTaskStatus(user, id, "done");
  if (!result.ok) return { message: result.message };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return {};
}

export type ShareTaskState = { message?: string; field?: string; email?: string; role?: string; saved?: number };

export async function shareTaskAction(prev: ShareTaskState, form: FormData): Promise<ShareTaskState> {
  const id = Number(form.get("id"));
  const user = await requireUser();
  const email = String(form.get("email") ?? "");
  const role = String(form.get("role") ?? "view");
  const result = await shareTask(user, id, email, role);
  if (!result.ok) return { message: result.message, field: result.field, email, role, saved: prev.saved };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return { saved: (prev.saved ?? 0) + 1, role };
}

export type RevokeShareState = { message?: string };

export async function revokeShareAction(_prev: RevokeShareState, form: FormData): Promise<RevokeShareState> {
  const id = Number(form.get("id"));
  const recipientId = Number(form.get("recipientId"));
  const user = await requireUser();
  const result = await revokeShare(user, id, recipientId);
  if (!result.ok) return { message: result.message };
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${id}`);
  return {};
}
