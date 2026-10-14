import Link from "next/link";
import { isFiltered, type ListQuery } from "@/lib/tasks";

/** Filter and sort controls: a plain GET form, so the chosen state lives in the page address. */
export function ListControls({ query }: { query: ListQuery }) {
  return (
    <form action="/tasks" method="get" key={`${query.status}-${query.priority}-${query.overdueOnly}-${query.includeArchived}-${query.sort}`}>
      <label htmlFor="filter-status">Filter by status</label>
      <select id="filter-status" name="status" defaultValue={query.status ?? ""}>
        <option value="">any</option>
        <option value="todo">todo</option>
        <option value="doing">doing</option>
        <option value="done">done</option>
      </select>{" "}
      <label htmlFor="filter-priority">Filter by priority</label>
      <select id="filter-priority" name="priority" defaultValue={query.priority ?? ""}>
        <option value="">any</option>
        <option value="low">low</option>
        <option value="medium">medium</option>
        <option value="high">high</option>
      </select>{" "}
      <input id="filter-overdue" name="overdue" type="checkbox" value="1" defaultChecked={query.overdueOnly === true} />
      <label htmlFor="filter-overdue">Overdue only</label>{" "}
      <input id="show-archived" name="archived" type="checkbox" value="1" defaultChecked={query.includeArchived === true} />
      <label htmlFor="show-archived">Show archived</label>{" "}
      <label htmlFor="sort-by">Sort by</label>
      <select id="sort-by" name="sort" defaultValue={query.sort}>
        <option value="newest">newest first</option>
        <option value="due">due date</option>
        <option value="priority">priority</option>
      </select>{" "}
      <button type="submit">Apply</button>
      {(isFiltered(query) || query.includeArchived || query.sort !== "newest") && <Link href="/tasks">Clear filters</Link>}
    </form>
  );
}
