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

/** Changes the status on the task page; retried as a whole because a save can race hydration. */
async function setStatus(page: Page, status: string) {
  await expect(async () => {
    await page.getByLabel("Status").selectOption(status);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    await expect(page.getByLabel("Status")).toHaveValue(status, { timeout: 2000 });
  }).toPass();
}

test("mark done, move between statuses, and the completion moment follows the clock", async ({ page, app }) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));

  await app.setClock("2030-01-10T09:00:00Z");
  await register(page, "a@example.com");
  await addTask(page, "Buy milk");
  await waitForHydration(page);

  const item = page.getByRole("listitem").filter({ hasText: "Buy milk" });
  await expect(item.getByText("completed", { exact: false })).toHaveCount(0);
  await item.getByRole("button", { name: "Mark Buy milk done" }).click();
  await expect(item.getByText("Status: done")).toBeVisible();
  await expect(item.getByText("Completed: 10 January 2030")).toBeVisible();
  await expect(item.getByRole("button", { name: /Mark .* done/ })).toHaveCount(0);

  await item.getByRole("link", { name: "Buy milk" }).click();
  await waitForHydration(page);
  await expect(page.getByText("Completed: 10 January 2030")).toBeVisible();

  await setStatus(page, "doing");
  await expect(page.getByText("Status: doing")).toBeVisible();
  await expect(page.getByText(/Completed:/)).toHaveCount(0);

  await setStatus(page, "todo");
  await expect(page.getByText(/Completed:/)).toHaveCount(0);
  await setStatus(page, "doing");
  await app.setClock("2030-01-12T09:00:00Z");
  await setStatus(page, "done");
  await expect(page.getByText("Status: done")).toBeVisible();
  await expect(page.getByText("Completed: 12 January 2030")).toBeVisible();

  await app.setClock("2030-01-14T09:00:00Z");
  await expect(async () => {
    await page.getByLabel("Title").fill("Buy oat milk");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Buy oat milk" })).toBeVisible({ timeout: 2000 });
  }).toPass();
  await page.reload();
  await expect(page.getByText("Completed: 12 January 2030")).toBeVisible();

  await page.getByRole("link", { name: "My tasks" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Buy oat milk" }).getByText("Completed: 12 January 2030")).toBeVisible();

  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});

test("all six status moves are accepted and only done shows a completion date", async ({ page, app }) => {
  await app.setClock("2030-01-10T09:00:00Z");
  await register(page, "a@example.com");
  await addTask(page, "Walk dog");
  await page.getByRole("link", { name: "Walk dog" }).click();
  await waitForHydration(page);

  const moves: Array<[string, string]> = [
    ["todo", "doing"],
    ["doing", "todo"],
    ["todo", "done"],
    ["done", "todo"],
    ["todo", "doing"],
    ["doing", "done"],
    ["done", "doing"],
  ];
  for (const [, to] of moves) {
    await setStatus(page, to);
    await expect(page.getByText(`Status: ${to}`)).toBeVisible();
    await expect(page.getByText(/Completed:/)).toHaveCount(to === "done" ? 1 : 0);
  }
});
