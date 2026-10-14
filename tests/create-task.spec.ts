import type { Page } from "@playwright/test";
import { expect, test } from "./support";

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
}

test("create a task, keep it across reload, and keep it private to its owner", async ({ page, context, browser }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await register(page, "a@example.com");
  await expect(page.getByText("You have no tasks yet", { exact: false })).toBeVisible();

  await addTask(page, "  Buy milk  ");
  const item = page.getByRole("listitem").filter({ hasText: "Buy milk" });
  await expect(item).toHaveCount(1);
  await expect(item.getByText("Status: todo")).toBeVisible();
  await expect(item.getByText("Priority: medium")).toBeVisible();
  await expect(page.getByText("You have no tasks yet", { exact: false })).toHaveCount(0);
  await expect(page.getByLabel("New task title")).toHaveValue("");

  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: "Buy milk" })).toHaveCount(1);

  // A second, separate browser session sharing the same test database.
  const other = await browser.newContext();
  await other.addCookies((await context.cookies()).filter((c) => c.name === "tm-test-db"));
  const pageB = await other.newPage();
  await register(pageB, "b@example.com");
  await expect(pageB.getByText("You have no tasks yet", { exact: false })).toBeVisible();
  await expect(pageB.getByText("Buy milk")).toHaveCount(0);
  await other.close();

  expect(errors).toEqual([]);
});

test("a blank or too-long title is rejected with a message and creates nothing", async ({ page }) => {
  await register(page, "a@example.com");
  await addTask(page, "Buy milk");
  await expect(page.getByRole("listitem")).toHaveCount(1);

  await addTask(page, "   ");
  await expect(page.getByRole("alert").filter({ hasText: "A title is required." })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);

  await addTask(page, "x".repeat(201));
  await expect(page.getByRole("alert").filter({ hasText: "The title is too long (200 characters at most)." })).toBeVisible();
  await expect(page.getByRole("listitem")).toHaveCount(1);

  await addTask(page, "x".repeat(200));
  await expect(page.getByRole("listitem")).toHaveCount(2);
  await expect(page.getByRole("alert").filter({ hasText: "title" })).toHaveCount(0);
});
