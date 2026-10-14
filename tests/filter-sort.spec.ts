import type { Page } from "@playwright/test";
import { expect, test, waitForHydration } from "./support";

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

type Spec = { title: string; status: string; priority: string; due: string };

async function addTask(page: Page, spec: Spec) {
  await page.getByLabel("New task title").fill(spec.title);
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("link", { name: spec.title }).click();
  await waitForHydration(page);
  // Retried as a whole: a save that races hydration can submit the unedited form.
  await expect(async () => {
    await waitForHydration(page);
    await page.getByLabel("Status").selectOption(spec.status);
    await page.getByLabel("Priority").selectOption(spec.priority);
    await page.getByLabel("Due date").fill(spec.due);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    await expect(page.getByLabel("Status")).toHaveValue(spec.status, { timeout: 2000 });
    await expect(page.getByLabel("Priority")).toHaveValue(spec.priority, { timeout: 2000 });
    await expect(page.getByLabel("Due date")).toHaveValue(spec.due, { timeout: 2000 });
  }).toPass();
  await page.getByRole("link", { name: "My tasks" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

async function listed(page: Page): Promise<string[]> {
  const items = page.getByRole("listitem");
  const names = await items.evaluateAll((els) => els.map((e) => e.querySelector("a")?.textContent ?? ""));
  return names;
}

const TASKS: Spec[] = [
  { title: "Alpha", status: "todo", priority: "high", due: "2030-03-20" },
  { title: "Bravo", status: "todo", priority: "high", due: "2030-03-05" },
  { title: "Charlie", status: "todo", priority: "high", due: "" },
  { title: "Delta", status: "doing", priority: "low", due: "2030-03-01" },
  { title: "Echo", status: "done", priority: "medium", due: "2030-03-10" },
];

test("filter by status and priority, sort, keep state in the address, and clear", async ({ page, context }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  await register(page, "a@example.com");
  for (const t of TASKS) await addTask(page, t);
  await waitForHydration(page);
  await expect(page.getByRole("listitem")).toHaveCount(5);

  await page.getByLabel("Filter by status").selectOption("todo");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/status=todo/);
  await expect.poll(() => listed(page).then((l) => [...l].sort())).toEqual(["Alpha", "Bravo", "Charlie"]);

  await page.getByLabel("Filter by priority").selectOption("high");
  await page.getByLabel("Sort by").selectOption("due");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/sort=due/);
  await expect.poll(() => listed(page)).toEqual(["Bravo", "Alpha", "Charlie"]);

  await page.reload();
  await expect.poll(() => listed(page)).toEqual(["Bravo", "Alpha", "Charlie"]);
  await expect(page.getByLabel("Filter by status")).toHaveValue("todo");
  await expect(page.getByLabel("Filter by priority")).toHaveValue("high");
  await expect(page.getByLabel("Sort by")).toHaveValue("due");

  const other = await context.newPage();
  await other.goto(page.url());
  await expect.poll(() => listed(other)).toEqual(["Bravo", "Alpha", "Charlie"]);
  await expect(other.getByLabel("Filter by status")).toHaveValue("todo");
  await expect(other.getByLabel("Sort by")).toHaveValue("due");
  await other.close();

  // Edge: nothing matches.
  await page.getByLabel("Filter by status").selectOption("done");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("No tasks match these filters.")).toBeVisible();
  await expect(page.getByText(/You have no tasks yet/)).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(5);

  await page.getByLabel("Sort by").selectOption("priority");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/sort=priority/);
  await expect.poll(() => listed(page).then((l) => [l.slice(0, 3).sort(), l.slice(3)])).toEqual([["Alpha", "Bravo", "Charlie"], ["Echo", "Delta"]]);

  // A malformed address falls back to the unfiltered default.
  await page.goto("/tasks?status=bogus&sort=nope");
  await expect(page.getByRole("listitem")).toHaveCount(5);

  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
