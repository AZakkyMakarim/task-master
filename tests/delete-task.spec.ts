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

test("delete asks for confirmation, cancel keeps the task, confirm removes it; others cannot delete", async ({ page, context, browser, baseURL }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && !m.text().includes("404") && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await register(page, "a@example.com");
  await addTask(page, "Buy milk");
  await addTask(page, "Call plumber");
  const milkUrl = new URL((await page.getByRole("link", { name: "Buy milk" }).getAttribute("href"))!, baseURL!).toString();
  const plumberUrl = new URL((await page.getByRole("link", { name: "Call plumber" }).getAttribute("href"))!, baseURL!).toString();
  await waitForHydration(page);

  // Cancel leaves both tasks.
  await page.getByRole("button", { name: "Delete Buy milk" }).click();
  const dialog = page.getByRole("dialog", { name: /Buy milk/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("link", { name: "Buy milk" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Call plumber" })).toBeVisible();

  // Confirm removes it.
  await page.getByRole("button", { name: "Delete Buy milk" }).click();
  await page.getByRole("dialog", { name: /Buy milk/ }).getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByRole("link", { name: "Buy milk" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("link", { name: "Buy milk" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Call plumber" })).toBeVisible();

  const gone = await page.goto(milkUrl);
  expect(gone!.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /not found/i })).toBeVisible();

  // Another user sees not-found for the task and no delete control.
  const other = await browser.newContext({ baseURL });
  await other.addCookies(await context.cookies().then((c) => c.filter((x) => x.name === "tm-test-db")));
  const bPage = await other.newPage();
  await register(bPage, "b@example.com");
  const res = await bPage.goto(plumberUrl);
  expect(res!.status()).toBe(404);
  await expect(bPage.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  await other.close();

  await page.goto("/tasks");
  await expect(page.getByRole("link", { name: "Call plumber" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("deleting a task from its own page lands on My tasks", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await register(page, "a@example.com");
  await addTask(page, "Buy milk");
  await addTask(page, "Call plumber");
  await page.getByRole("link", { name: "Buy milk" }).click();
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await waitForHydration(page);
  await page.getByRole("button", { name: "Delete Buy milk" }).click();
  await page.getByRole("dialog", { name: /Buy milk/ }).getByRole("button", { name: "Delete task" }).click();

  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByRole("heading", { name: /not found/i })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Buy milk" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Call plumber" })).toBeVisible();
  expect(errors).toEqual([]);
});
