import type { Page } from "@playwright/test";
import { expect, test, waitForHydration } from "./support";

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

async function addTask(page: Page, title: string) {
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
}


/** The session lasts 30 days from sign-in, so a test that jumps the clock far ahead signs in again. */
async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await waitForHydration(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

function row(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

async function markDone(page: Page, title: string) {
  await waitForHydration(page);
  await row(page, title).getByRole("button", { name: `Mark ${title} done` }).click();
  await expect(row(page, title).getByText("Status: done")).toBeVisible();
}

/** Saves the status on the open task page; retried as a whole because a save can race hydration. */
async function setStatus(page: Page, status: string) {
  await expect(async () => {
    await waitForHydration(page);
    await page.getByLabel("Status").selectOption(status);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    await expect(page.getByLabel("Status")).toHaveValue(status, { timeout: 2000 });
  }).toPass();
}

test("archived tasks are hidden, opt-in, read-only, and deletable by their owner", async ({ page, context, app }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => m.type() === "error" && !m.text().includes("403") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  await app.setClock("2030-01-01T10:00:00Z");
  await register(page, "a@example.com");
  await addTask(page, "Old report");
  await markDone(page, "Old report");
  await app.setClock("2030-01-01T10:00:01Z");
  await addTask(page, "Boundary report");
  await markDone(page, "Boundary report");
  await addTask(page, "Open task");

  // 1. Exactly 30 days stays in the default list; 30 days and 1 second is hidden.
  await app.setClock("2030-01-31T10:00:01Z");
  await signIn(page, "a@example.com");
  await expect(row(page, "Boundary report")).toBeVisible();
  await expect(row(page, "Open task")).toBeVisible();
  await expect(page.getByRole("link", { name: "Old report" })).toHaveCount(0);
  await expect(page.getByText("Archived", { exact: true })).toHaveCount(0);

  // 2. "Show archived" lists it, marked, and survives a reload.
  await waitForHydration(page);
  await page.getByLabel("Show archived").check();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/archived=1/);
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await expect(row(page, "Old report").getByText("Archived", { exact: true })).toBeVisible();
  await expect(row(page, "Boundary report").getByText("Archived", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Show archived")).toBeChecked();
  await expect(page.getByRole("listitem")).toHaveCount(3);
  await expect(row(page, "Old report").getByText("Archived", { exact: true })).toBeVisible();
  await expect(row(page, "Old report").getByRole("button", { name: /Mark .* done/ })).toHaveCount(0);

  // 3. Archived detail: all fields, no edit or status controls, delete remains.
  const listUrl = page.url();
  await page.getByRole("link", { name: "Old report" }).click();
  await expect(page.getByRole("heading", { name: "Old report" })).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  await expect(page.getByText("Status: done")).toBeVisible();
  await expect(page.getByText("Priority: medium")).toBeVisible();
  await expect(page.getByText("Due: no due date")).toBeVisible();
  await expect(page.getByText("Recurrence: none")).toBeVisible();
  await expect(page.getByText("Completed: 1 January 2030")).toBeVisible();
  await expect(page.getByLabel("Status")).toHaveCount(0);
  await expect(page.getByLabel("Title")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Old report" })).toBeVisible();

  // 4. A stale edit form is refused once the task has become archived.
  await page.goto(listUrl);
  const stale = await context.newPage();
  await stale.goto(new URL((await page.getByRole("link", { name: "Boundary report" }).getAttribute("href"))!, page.url()).toString());
  await waitForHydration(stale);
  await expect(stale.getByLabel("Title")).toHaveValue("Boundary report");
  await app.setClock("2030-01-31T10:00:02Z");
  await stale.getByLabel("Title").fill("Changed");
  await stale.getByRole("button", { name: "Save" }).click();
  await expect(stale.getByRole("alert").filter({ hasText: "Archived tasks cannot be changed." })).toBeVisible();
  await stale.reload();
  await expect(stale.getByRole("heading", { name: "Boundary report" })).toBeVisible();
  await expect(stale.getByText("Archived", { exact: true })).toBeVisible();
  await stale.close();

  // 5. The owner deletes an archived task, with the usual confirmation.
  await page.goto(listUrl);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Delete Old report" }).click();
  await page.getByRole("dialog", { name: /Old report/ }).getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByRole("link", { name: "Old report" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Show archived")).toBeChecked();
  await expect(page.getByRole("link", { name: "Old report" })).toHaveCount(0);
  await expect(page.getByRole("listitem")).toHaveCount(2);

  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("re-completing a task restarts the 30-day count", async ({ page, app }) => {
  test.setTimeout(120_000);
  await app.setClock("2030-03-01T10:00:00Z");
  await register(page, "a@example.com");
  await addTask(page, "Redo");
  await markDone(page, "Redo");

  await app.setClock("2030-03-20T10:00:00Z");
  await page.getByRole("link", { name: "Redo" }).click();
  await setStatus(page, "todo");
  await setStatus(page, "done");

  await app.setClock("2030-04-10T10:00:00Z");
  await signIn(page, "a@example.com");
  await expect(row(page, "Redo")).toBeVisible();
  await expect(page.getByText("Archived", { exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Redo" }).click();
  await expect(page.getByLabel("Status")).toBeVisible();
});
