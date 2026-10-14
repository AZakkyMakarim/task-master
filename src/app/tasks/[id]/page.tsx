import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/accounts";
import { today } from "@/lib/clock";
import { formatDay, formatMoment } from "@/lib/format";
import { getVisibleTask, isOverdue, listShares } from "@/lib/tasks";
import { EditTaskForm } from "./edit-task-form";
import { DeleteTaskButton } from "../delete-task-button";
import { RevokeShareButton, ShareForm } from "../share-panel";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d{1,15}$/.test(id)) notFound();
  const found = await getVisibleTask(user, Number(id));
  if (!found) notFound();
  const { task, archived, access, ownerEmail } = found;
  const isOwner = access === "owner";
  const mayChange = access === "owner" || access === "edit";
  const shares = isOwner ? await listShares(user, task.id) : [];
  return (
    <main>
      <p>
        <Link href="/tasks">My tasks</Link> <Link href="/shared">Shared with me</Link>
      </p>
      <h1>{task.title}</h1>
      {!isOwner && <p>Owner: {ownerEmail}</p>}
      {!isOwner && <p>Your role: {found.role}</p>}
      <p>Status: {task.status}</p>
      <p>Due: {task.dueDate ? formatDay(task.dueDate) : "no due date"}</p>
      {isOverdue(task, await today()) && <p><strong>Overdue</strong></p>}
      {task.completedAt && <p>Completed: {formatMoment(task.completedAt)}</p>}
      {archived ? (
        <>
          <p><strong>Archived</strong></p>
          <p>Priority: {task.priority}</p>
          <p>Recurrence: {task.recurrence}</p>
          <p>Archived tasks cannot be changed.{isOwner && " You can still delete it."}</p>
        </>
      ) : mayChange ? (
        <EditTaskForm task={task} />
      ) : (
        <>
          <p>Priority: {task.priority}</p>
          <p>Recurrence: {task.recurrence}</p>
        </>
      )}
      {isOwner && (
        <>
          <DeleteTaskButton id={task.id} title={task.title} redirectToTasks />
          <section aria-labelledby="share-heading">
            <h2 id="share-heading">Sharing</h2>
            {!archived && <ShareForm id={task.id} />}
            {shares.length === 0 ? (
              <p>This task is not shared with anyone.</p>
            ) : (
              <ul aria-label="Shares">
                {shares.map((s) => (
                  <li key={s.recipientId}>
                    <span>{s.recipientEmail}</span> <span>Role: {s.role}</span>{" "}
                    {!archived && <RevokeShareButton id={task.id} recipientId={s.recipientId} email={s.recipientEmail} />}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
