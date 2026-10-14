import type { Browser, Page } from "@playwright/test";
import { expect, test, waitForHydration } from "./support";

const PASSWORD = "correct-horse-1";

async function newSession(browser: Browser, page: Page) {
  const cookie = (await page.context().cookies()).find((c) => c.name === "tm-test-db")!;
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin });
  await context.addCookies([cookie]);
  return { context, page: await context.newPage() };
}

async function register(page: Page, email: string) {
  await page.goto("/register");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Register" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

async function share(page: Page, email: string, role: "view" | "edit") {
  await waitForHydration(page);
  await page.getByLabel("Share with (email)").fill(email);
  await page.getByLabel("Role").selectOption(role);
  await page.getByRole("button", { name: "Share" }).click();
}

async function openTask(page: Page, title: string) {
  await page.goto("/tasks");
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
}

test("revoke ends one recipient's access, delete removes the task for everyone, and re-sharing works", async ({ page, browser }) => {
  await register(page, "a@example.com");
  const b = await newSession(browser, page);
  await register(b.page, "b@example.com");
  const c = await newSession(browser, page);
  await register(c.page, "c@example.com");

  for (const title of ["Plan trip", "Book hotel"]) {
    await page.getByLabel("New task title").fill(title);
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByRole("link", { name: title })).toBeVisible();
  }
  await openTask(page, "Plan trip");
  const planUrl = page.url();
  await share(page, "b@example.com", "edit");
  await expect(page.getByRole("list", { name: "Shares" }).getByRole("listitem")).toHaveCount(1);
  await share(page, "c@example.com", "view");
  const shares = page.getByRole("list", { name: "Shares" });
  await expect(shares.getByRole("listitem")).toHaveCount(2);
  await openTask(page, "Book hotel");
  await share(page, "b@example.com", "view");
  await expect(page.getByRole("list", { name: "Shares" }).getByRole("listitem")).toHaveCount(1);

  // 1. B opens Plan trip (edit role) and leaves it open
  await b.page.getByRole("link", { name: "Shared with me" }).click();
  await b.page.getByRole("link", { name: "Plan trip" }).click();
  await expect(b.page.getByRole("heading", { name: "Plan trip" })).toBeVisible();
  await waitForHydration(b.page);
  await expect(b.page.getByRole("button", { name: /Revoke/ })).toHaveCount(0);

  // 2. A revokes b on Plan trip
  await page.goto(planUrl);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Revoke b@example.com" }).click();
  await expect(shares.getByRole("listitem")).toHaveCount(1);
  await expect(shares).toContainText("c@example.com");
  await expect(shares).not.toContainText("b@example.com");

  // 3. B's open page: a stale submit changes nothing, a reload shows not-found
  await b.page.getByLabel("Title").fill("Hijacked");
  await b.page.getByRole("button", { name: "Save" }).click();
  await expect(b.page.getByRole("alert").filter({ hasText: "Task not found." })).toBeVisible();
  const res = await b.page.reload();
  expect(res!.status()).toBe(404);
  await expect(b.page.getByRole("heading", { name: "Page not found" })).toBeVisible();

  // 4. lists: B lost Plan trip but keeps Book hotel; C keeps Plan trip
  await b.page.goto("/shared");
  await expect(b.page.getByRole("link", { name: "Plan trip" })).toHaveCount(0);
  await expect(b.page.getByRole("link", { name: "Book hotel" })).toBeVisible();
  await c.page.goto("/shared");
  await expect(c.page.getByRole("link", { name: "Plan trip" })).toBeVisible();
  await page.goto(planUrl);
  await expect(page.getByLabel("Title")).toHaveValue("Plan trip");

  // 5-7. A deletes Book hotel while B has it open
  await b.page.getByRole("link", { name: "Book hotel" }).click();
  await expect(b.page.getByRole("heading", { name: "Book hotel" })).toBeVisible();
  await page.goto("/tasks");
  await waitForHydration(page);
  await page.getByRole("button", { name: "Delete Book hotel" }).click();
  await page.getByRole("dialog", { name: /Book hotel/ }).getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByRole("link", { name: "Book hotel" })).toHaveCount(0);
  const gone = await b.page.reload();
  expect(gone!.status()).toBe(404);
  await expect(b.page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await b.page.goto("/shared");
  await expect(b.page.getByText("Nothing has been shared with you yet.")).toBeVisible();

  // 8. revoking the last share removes the "Shared" mark
  await page.goto(planUrl);
  await waitForHydration(page);
  await page.getByRole("button", { name: "Revoke c@example.com" }).click();
  await expect(page.getByText("This task is not shared with anyone.")).toBeVisible();
  await page.getByRole("link", { name: "My tasks" }).click();
  const plan = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Plan trip" }) });
  await expect(plan).toBeVisible();
  await expect(plan.getByText("Shared", { exact: true })).toHaveCount(0);

  // edge: share again after a revoke
  await page.getByRole("link", { name: "Plan trip" }).click();
  await share(page, "b@example.com", "view");
  await expect(page.getByRole("list", { name: "Shares" })).toContainText("b@example.com");
  await b.page.goto("/shared");
  await expect(b.page.getByRole("link", { name: "Plan trip" })).toBeVisible();

  await b.context.close();
  await c.context.close();
});
