import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./support";

async function register(page: Page, email: string, password: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Register" }).click();
}

/** A second, signed-out browser session sharing the first one's test database. */
async function otherSession(browser: Browser, page: Page) {
  const context = await browser.newContext();
  const testDb = (await page.context().cookies()).filter((c) => c.name === "tm-test-db");
  await context.addCookies(testDb);
  return { context, page: await context.newPage() };
}

test("registering signs the user in on an empty My tasks page showing their email", async ({ page }) => {
  await register(page, "a@example.com", "correct-horse-1");
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(page.getByText("a@example.com")).toBeVisible();
});

test("the user stays signed in after a reload and after closing and reopening the browser", async ({
  page,
  browser,
}) => {
  await register(page, "a@example.com", "correct-horse-1");
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(page.getByText("a@example.com")).toBeVisible();

  // Closing the browser drops session cookies; only persistent ones survive.
  const state = await page.context().storageState();
  const persistent = { ...state, cookies: state.cookies.filter((c) => c.expires > 0 || c.name === "tm-test-db") };
  await page.context().close();
  const reopened = await browser.newContext({ storageState: persistent });
  const again = await reopened.newPage();
  await again.goto("/tasks");
  await expect(again.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(again.getByText("a@example.com")).toBeVisible();
  await reopened.close();
});

test("an email already in use is refused, compared after trimming and lower-casing", async ({ page, browser }) => {
  await register(page, "a@example.com", "correct-horse-1");
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();

  const second = await otherSession(browser, page);
  await register(second.page, "  A@Example.com ", "correct-horse-1");
  await expect(second.page.getByText("That email is already registered")).toBeVisible();
  await expect(second.page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);
  await second.page.goto("/tasks");
  await expect(second.page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);
  await second.context.close();
});

test("a malformed email shows a validation message", async ({ page }) => {
  await register(page, "not-an-email", "correct-horse-1");
  await expect(page.getByText("Enter a valid email address")).toBeVisible();
  await expect(page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);
});

test("a password shorter than 8 characters shows a validation message", async ({ page }) => {
  await register(page, "c@example.com", "short");
  await expect(page.getByText("Password must be at least 8 characters")).toBeVisible();
  await expect(page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);
});
