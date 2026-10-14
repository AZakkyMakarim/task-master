import type { Page } from "@playwright/test";
import { expect, test, waitForHydration } from "./support";

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

/** Saves the given fields on the open task page; retried as a whole because a save can race hydration. */
async function edit(page: Page, fields: { status?: string; due?: string }) {
  await expect(async () => {
    await waitForHydration(page);
    if (fields.status !== undefined) await page.getByLabel("Status").selectOption(fields.status);
    if (fields.due !== undefined) await page.getByLabel("Due date").fill(fields.due);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    if (fields.status !== undefined) await expect(page.getByLabel("Status")).toHaveValue(fields.status, { timeout: 2000 });
    if (fields.due !== undefined) await expect(page.getByLabel("Due date")).toHaveValue(fields.due, { timeout: 2000 });
  }).toPass();
}

async function addTask(page: Page, title: string, status: string, due: string) {
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("link", { name: title }).click();
  await edit(page, { status, due });
  await page.getByRole("link", { name: "My tasks" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

function row(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

async function expectMarked(page: Page, marked: string[], unmarked: string[]) {
  for (const t of marked) await expect(row(page, t).getByText("Overdue", { exact: true })).toBeVisible();
  for (const t of unmarked) await expect(row(page, t).getByText("Overdue", { exact: true })).toHaveCount(0);
}

test("overdue mark and overdue-only filter follow the clock and the task's facts", async ({ page, app }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  await app.setClock("2030-03-10T12:00:00Z");
  await register(page, "a@example.com");
  await addTask(page, "Yesterday", "todo", "2030-03-09");
  await addTask(page, "Today", "todo", "2030-03-10");
  await addTask(page, "Tomorrow", "doing", "2030-03-11");
  await addTask(page, "Old and done", "done", "2030-01-01");
  await addTask(page, "No date", "todo", "");

  // 1. Only "Yesterday" is marked.
  await expect(page.getByRole("listitem")).toHaveCount(5);
  await expectMarked(page, ["Yesterday"], ["Today", "Tomorrow", "Old and done", "No date"]);

  // 2. Overdue-only filter, in the address, survives a reload.
  await waitForHydration(page);
  await page.getByLabel("Overdue only").check();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/overdue=1/);
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(row(page, "Yesterday")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Overdue only")).toBeChecked();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await expect(row(page, "Yesterday")).toBeVisible();

  // Combines with the other filters.
  await page.goto("/tasks?overdue=1&status=doing");
  await expect(page.getByText("No tasks match these filters.")).toBeVisible();

  // 3. The clock passes midnight.
  await page.goto("/tasks");
  await app.setClock("2030-03-11T00:30:00Z");
  await page.reload();
  await expect(page.getByRole("listitem")).toHaveCount(5);
  await expectMarked(page, ["Yesterday", "Today"], ["Tomorrow", "Old and done", "No date"]);

  // 4. Completing removes the mark.
  await waitForHydration(page);
  await row(page, "Yesterday").getByRole("button", { name: "Mark Yesterday done" }).click();
  await expect(row(page, "Yesterday").getByText("Status: done")).toBeVisible();
  await expectMarked(page, ["Today"], ["Yesterday", "Tomorrow", "Old and done", "No date"]);

  // 5. Moving the due date to today removes the mark, in the list and the detail view.
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await edit(page, { due: "2030-03-11" });
  await expect(page.getByText("Overdue", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "My tasks" }).click();
  await expectMarked(page, [], ["Yesterday", "Today", "Tomorrow", "Old and done", "No date"]);

  // Edge: reopening an old done task marks it; done again clears it.
  await page.getByRole("link", { name: "Old and done" }).click();
  await edit(page, { status: "todo" });
  await expect(page.getByText("Overdue", { exact: true })).toBeVisible();
  await edit(page, { status: "done" });
  await expect(page.getByText("Overdue", { exact: true })).toHaveCount(0);

  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
