import type { Page } from "@playwright/test";
import { expect, test } from "./support";

async function register(page: Page, email: string, password: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

async function signIn(page: Page, email: string, password: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

const WRONG = "Email or password is incorrect.";

test("sign out, get redirected from My tasks, then sign in again", async ({ page }) => {
  await register(page, "a@example.com", "correct-horse-1");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("a@example.com")).toHaveCount(0);

  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);

  await signIn(page, "a@example.com", "correct-horse-1");
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(page.getByText("a@example.com")).toBeVisible();
});

test("the email is matched after trimming and lower-casing", async ({ page }) => {
  await register(page, "a@example.com", "correct-horse-1");
  await page.getByRole("button", { name: "Sign out" }).click();
  await signIn(page, "  A@Example.COM ", "correct-horse-1");
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(page.getByText("a@example.com")).toBeVisible();
});

test("a wrong password and an unknown email give exactly the same message", async ({ page }) => {
  await register(page, "a@example.com", "correct-horse-1");
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn(page, "a@example.com", "wrong-password-1");
  const alert = page.getByText(WRONG, { exact: true });
  await expect(alert).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await signIn(page, "nobody@example.com", "correct-horse-1");
  await expect(alert).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);
});

test("the back button after signing out does not reveal task pages", async ({ page }) => {
  await register(page, "a@example.com", "correct-horse-1");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: "My tasks" })).toHaveCount(0);
  await expect(page.getByText("a@example.com")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a signed-out visitor opening any task page is sent to sign in", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
