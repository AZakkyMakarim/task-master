export const MAX_TITLE_LENGTH = 200;

export type Status = "todo" | "doing" | "done";
export type Priority = "low" | "medium" | "high";
export type Recurrence = "none" | "daily" | "weekly";

export type ShareRole = "view" | "edit";

export type Task = {
  id: number;
  ownerId: number;
  title: string;
  status: Status;
  priority: Priority;
  /** Calendar day (YYYY-MM-DD) or null. */
  dueDate: string | null;
  recurrence: Recurrence;
  /** ISO moment the task became done, or null. */
  completedAt: string | null;
  createdAt: string;
};
