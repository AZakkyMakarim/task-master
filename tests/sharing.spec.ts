import type { Browser, Page } from "@playwright/test";
import { expect, test, waitForHydration } from "./support";

const PASSWORD = "correct-horse-1";

/** A second, independent browser session sharing the same test database. */
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

async function addTask(page: Page, title: string) {
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
}

async function share(page: Page, email: string, role: "view" | "edit") {
  await waitForHydration(page);
  await page.getByLabel("Share with (email)").fill(email);
  await page.getByLabel("Role").selectOption(role);
  await page.getByRole("button", { name: "Share" }).click();
}

test("share with the view role, Shared with me, and no access for others", async ({ page, browser }) => {
  await register(page, "a@example.com");
  const b = await newSession(browser, page);
  await register(b.page, "b@example.com");
  const c = await newSession(browser, page);
  await register(c.page, "c@example.com");

  await addTask(page, "Plan trip");
  await addTask(page, "Private note");
  await page.getByRole("link", { name: "Plan trip" }).click();
  await waitForHydration(page);
  // Retried as a whole: a save that races the page's hydration can submit the unedited form.
  await expect(async () => {
    await page.getByLabel("Priority").selectOption("high");
    await page.getByLabel("Due date").fill("2030-05-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    await page.reload();
    await expect(page.getByLabel("Priority")).toHaveValue("high", { timeout: 2000 });
  }).toPass();
  const planUrl = page.url();

  // 1. empty state
  await b.page.getByRole("link", { name: "Shared with me" }).click();
  await expect(b.page.getByRole("heading", { name: "Shared with me" })).toBeVisible();
  await expect(b.page.getByText("Nothing has been shared with you yet.")).toBeVisible();

  // 2-3. share (email trimmed and lower-cased)
  await share(page, " B@Example.com ", "view");
  const shares = page.getByRole("list", { name: "Shares" });
  await expect(shares.getByRole("listitem")).toHaveCount(1);
  await expect(shares.getByRole("listitem").first()).toContainText("b@example.com");
  await expect(shares.getByRole("listitem").first()).toContainText("Role: view");
  await share(page, "c@example.com", "view");
  await expect(shares.getByRole("listitem")).toHaveCount(2);
  await expect(shares).toContainText("c@example.com");

  await page.getByRole("link", { name: "My tasks" }).click();
  const plan = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Plan trip" }) });
  const note = page.getByRole("listitem").filter({ has: page.getByRole("link", { name: "Private note" }) });
  await expect(plan.getByText("Shared", { exact: true })).toBeVisible();
  await expect(note.getByText("Shared", { exact: true })).toHaveCount(0);

  // 4. recipient lists
  await b.page.reload();
  const item = b.page.getByRole("listitem").filter({ has: b.page.getByRole("link", { name: "Plan trip" }) });
  await expect(item).toContainText("Owner: a@example.com");
  await expect(item).toContainText("Role: view");
  await b.page.getByRole("link", { name: "My tasks" }).click();
  await expect(b.page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await expect(b.page.getByRole("link", { name: "Plan trip" })).toHaveCount(0);

  // 5. recipient opens it: read-only
  await b.page.getByRole("link", { name: "Shared with me" }).click();
  await b.page.getByRole("link", { name: "Plan trip" }).click();
  await expect(b.page.getByRole("heading", { name: "Plan trip" })).toBeVisible();
  await expect(b.page.getByText("Status: todo")).toBeVisible();
  await expect(b.page.getByText("Priority: high")).toBeVisible();
  await expect(b.page.getByText("Due: 1 May 2030")).toBeVisible();
  await expect(b.page.getByText("Recurrence: none")).toBeVisible();
  await expect(b.page.getByRole("main").getByRole("button")).toHaveCount(0);
  await expect(b.page.getByLabel("Title")).toHaveCount(0);
  await expect(b.page.getByLabel("Status")).toHaveCount(0);
  await expect(b.page.getByLabel("Share with (email)")).toHaveCount(0);
  await expect(b.page.getByText("c@example.com")).toHaveCount(0);

  // 6. unrelated user and non-shared task
  await b.page.goto(await note.getByRole("link").getAttribute("href").then((h) => new URL(h!, planUrl).href));
  await expect(b.page.getByRole("heading", { name: "Plan trip" })).toHaveCount(0);
  await expect(b.page.getByText("Private note")).toHaveCount(0);
  const res = await c.page.goto(planUrl.replace(/\/\d+$/, "/999"));
  expect(res!.status()).toBe(404);

  await b.context.close();
  await c.context.close();
});

test("sharing with an unknown email or yourself shows an error and creates no share", async ({ page }) => {
  await register(page, "a@example.com");
  await addTask(page, "Plan trip");
  await page.getByRole("link", { name: "Plan trip" }).click();
  await share(page, "nobody@example.com", "view");
  await expect(page.getByRole("alert").filter({ hasText: "No user has that email." })).toBeVisible();
  await expect(page.getByRole("list", { name: "Shares" })).toHaveCount(0);
  await share(page, "A@example.com", "view");
  await expect(page.getByRole("alert").filter({ hasText: "You cannot share a task with yourself." })).toBeVisible();
  await expect(page.getByRole("list", { name: "Shares" })).toHaveCount(0);
});
