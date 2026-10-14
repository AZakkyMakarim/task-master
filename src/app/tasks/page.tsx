import Link from "next/link";
import { requireUser } from "@/lib/accounts";
import { formatDay, formatMoment } from "@/lib/format";
import { now, today } from "@/lib/clock";
import { isArchived, isFiltered, isOverdue, listVisibleTasks, parseListQuery, sharedTaskIds } from "@/lib/tasks";
import { signOutAction } from "../signin/actions";
import { NewTaskForm } from "./new-task-form";
import { ListControls } from "./list-controls";
import { DeleteTaskButton } from "./delete-task-button";
import { MarkDoneButton } from "./mark-done-button";

export const dynamic = "force-dynamic";

export default async function MyTasksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const query = parseListQuery(await searchParams);
  const tasks = await listVisibleTasks(user, query);
  const shared = await sharedTaskIds(user, tasks.map((t) => t.id));
  const day = await today();
  const moment = await now();
  return (
    <main>
      <h1>My tasks</h1>
      <p>
        Signed in as <strong>{user.email}</strong>
      </p>
      <form action={signOutAction}>
        <button type="submit">Sign out</button>
      </form>
      <p>
        <Link href="/shared">Shared with me</Link>
      </p>
      <NewTaskForm />
      <ListControls query={query} />
      {tasks.length === 0 && isFiltered(query) ? (
        <p>No tasks match these filters.</p>
      ) : tasks.length === 0 ? (
        <p>You have no tasks yet. Type a title above and choose Add task to create your first one.</p>
      ) : (
        <ul>
          {tasks.map((task) => (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`}>{task.title}</Link> <span>Status: {task.status}</span>{" "}
              <span>Priority: {task.priority}</span> <span>Due: {task.dueDate ? formatDay(task.dueDate) : "no due date"}</span>{" "}
              {shared.has(task.id) && <strong>Shared</strong>}{" "}
              {isOverdue(task, day) && <strong>Overdue</strong>}{" "}
              {isArchived(task, moment) && <strong>Archived</strong>}{" "}
              {task.completedAt && <span>Completed: {formatMoment(task.completedAt)}</span>}{" "}
              {task.status !== "done" && <MarkDoneButton id={task.id} title={task.title} />} <DeleteTaskButton id={task.id} title={task.title} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
