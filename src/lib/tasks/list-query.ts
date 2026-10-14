import type { Priority, Status } from "./types";

export const STATUS_FILTERS: readonly Status[] = ["todo", "doing", "done"];
export const PRIORITY_FILTERS: readonly Priority[] = ["low", "medium", "high"];
export const SORTS = ["newest", "due", "priority"] as const;
export type Sort = (typeof SORTS)[number];

/**
 * What a task list is narrowed and ordered by. Later tickets add fields here
 * (overdue only, include archived) and the list functions extend their SQL.
 */
export type ListQuery = { status?: Status; priority?: Priority; overdueOnly?: boolean; includeArchived?: boolean; sort: Sort };

export const DEFAULT_LIST_QUERY: ListQuery = { sort: "newest" };

type Params = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Reads a list query from page-address parameters; anything unrecognised is ignored. */
export function parseListQuery(params: Params): ListQuery {
  const status = one(params.status);
  const priority = one(params.priority);
  const sort = one(params.sort);
  return {
    status: STATUS_FILTERS.find((s) => s === status),
    priority: PRIORITY_FILTERS.find((p) => p === priority),
    overdueOnly: one(params.overdue) === "1" || undefined,
    includeArchived: one(params.archived) === "1" || undefined,
    sort: SORTS.find((s) => s === sort) ?? "newest",
  };
}

export function isFiltered(query: ListQuery): boolean {
  return query.status !== undefined || query.priority !== undefined || query.overdueOnly === true;
}
