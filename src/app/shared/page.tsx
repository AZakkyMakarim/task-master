import Link from "next/link";
import { requireUser } from "@/lib/accounts";
import { formatDay } from "@/lib/format";
import { MarkDoneButton } from "../tasks/mark-done-button";
import { now, today } from "@/lib/clock";
import { canChange, isArchived, isOverdue, listSharedWithMe } from "@/lib/tasks";

export const dynamic = "force-dynamic";

export default async function SharedWithMePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const archivedParam = (await searchParams).archived;
  const includeArchived = (Array.isArray(archivedParam) ? archivedParam[0] : archivedParam) === "1";
  const shared = await listSharedWithMe(user, { includeArchived });
  const moment = await now();
  const day = await today();
  return (
    <main>
      <h1>Shared with me</h1>
      <p>
        <Link href="/tasks">My tasks</Link>
      </p>
      <form action="/shared" method="get" key={String(includeArchived)}>
        <input id="show-archived" name="archived" type="checkbox" value="1" defaultChecked={includeArchived} />
        <label htmlFor="show-archived">Show archived</label> <button type="submit">Apply</button>
      </form>
      {shared.length === 0 ? (
        <p>Nothing has been shared with you yet.</p>
      ) : (
        <ul>
          {shared.map(({ task, ownerEmail, role }) => {
            const archived = isArchived(task, moment);
            return (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`}>{task.title}</Link> <span>Owner: {ownerEmail}</span> <span>Role: {role}</span>{" "}
                <span>Status: {task.status}</span> <span>Priority: {task.priority}</span>{" "}
                <span>Due: {task.dueDate ? formatDay(task.dueDate) : "no due date"}</span>{" "}
                {isOverdue(task, day) && <strong>Overdue</strong>} {archived && <strong>Archived</strong>}{" "}
                {task.status !== "done" && canChange({ access: role, archived }) && <MarkDoneButton id={task.id} title={task.title} />}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
