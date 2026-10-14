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

test("edit title, priority, due date and recurrence; keep them across reload; hide from others", async ({ page, context, browser }) => {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));

  await register(page, "a@example.com");
  await addTask(page, "Buy milk");

  await page.getByRole("link", { name: "Buy milk" }).click();
  await waitForHydration(page);
  await expect(page.getByRole("heading", { name: "Buy milk" })).toBeVisible();
  await expect(page.getByText("Status: todo")).toBeVisible();
  await expect(page.getByLabel("Priority")).toHaveValue("medium");
  await expect(page.getByLabel("Due date")).toHaveValue("");
  await expect(page.getByLabel("Recurrence")).toHaveValue("none");

  // Retried as a whole: a save that races the page's hydration can submit the unedited form.
  await expect(async () => {
    await page.getByLabel("Title").fill("Buy oat milk");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Due date").fill("2030-03-10");
    await page.getByLabel("Recurrence").selectOption("weekly");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Buy oat milk" })).toBeVisible({ timeout: 2000 });
  }).toPass();

  const detailUrl = page.url();
  await page.reload();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Buy oat milk" })).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Buy oat milk");
  await expect(page.getByLabel("Priority")).toHaveValue("high");
  await expect(page.getByLabel("Due date")).toHaveValue("2030-03-10");
  await expect(page.getByLabel("Recurrence")).toHaveValue("weekly");
  await expect(page.getByText("Due: 10 March 2030")).toBeVisible();

  await page.getByRole("link", { name: "My tasks" }).click();
  const item = page.getByRole("listitem").filter({ hasText: "Buy oat milk" });
  await expect(item.getByText("Priority: high")).toBeVisible();
  await expect(item.getByText("Due: 10 March 2030")).toBeVisible();

  await item.getByRole("link", { name: "Buy oat milk" }).click();
  await waitForHydration(page);
  await page.getByLabel("Due date").fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Due date")).toHaveValue("");
  await expect(page.getByText("Due: no due date")).toBeVisible();

  const other = await browser.newContext();
  await other.addCookies((await context.cookies()).filter((c) => c.name === "tm-test-db"));
  const pageB = await other.newPage();
  await register(pageB, "b@example.com");
  const missing = detailUrl.replace(/\/tasks\/\d+/, "/tasks/987654");
  const forbidden = await pageB.goto(detailUrl);
  const forbiddenBody = await pageB.locator("body").innerText();
  const absent = await pageB.goto(missing);
  const absentBody = await pageB.locator("body").innerText();
  expect(forbidden?.status()).toBe(404);
  expect(absent?.status()).toBe(404);
  expect(forbiddenBody).toBe(absentBody);
  expect(forbiddenBody).not.toContain("Buy oat milk");
  await other.close();

  expect(errors).toEqual([]);
});

test("a blank or too-long title is rejected on rename and the title is unchanged", async ({ page }) => {
  await register(page, "a@example.com");
  await addTask(page, "Buy oat milk");
  await page.getByRole("link", { name: "Buy oat milk" }).click();
  await waitForHydration(page);

  // Retried as a whole: a save that races the page's hydration can submit the unedited form.
  await expect(async () => {
    await page.getByLabel("Title").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "A title is required." })).toBeVisible({ timeout: 2000 });
  }).toPass();
  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue("Buy oat milk");

  await waitForHydration(page);
  await page.getByLabel("Title").fill("x".repeat(201));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "The title is too long (200 characters at most)." })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Title")).toHaveValue("Buy oat milk");
});

test("the due date shown is the day entered, whatever the clock", async ({ page, app }) => {
  await app.setClock("2030-03-09T23:30:00Z");
  await register(page, "a@example.com");
  await addTask(page, "Pay rent");
  await page.getByRole("link", { name: "Pay rent" }).click();
  await waitForHydration(page);
  await page.getByLabel("Due date").fill("2030-03-10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Due: 10 March 2030")).toBeVisible();
});
