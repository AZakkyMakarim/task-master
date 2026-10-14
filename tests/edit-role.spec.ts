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

async function setup(browser: Browser, page: Page, app: { setClock(iso: string): Promise<void> }) {
  await app.setClock("2030-02-01T09:00:00Z");
  await register(page, "a@example.com");
  const b = await newSession(browser, page);
  await register(b.page, "b@example.com");
  await page.getByLabel("New task title").fill("Plan trip");
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("link", { name: "Plan trip" }).click();
  await share(page, "b@example.com", "view");
  await expect(page.getByRole("list", { name: "Shares" }).getByRole("listitem")).toHaveCount(1);
  return b;
}

test("edit role: replace role, recipient edits, owner sees changes, view role refuses a stale form", async ({ page, browser, app }) => {
  const b = await setup(browser, page, app);
  const shares = page.getByRole("list", { name: "Shares" });

  // 1. share again with edit replaces the role
  await share(page, "b@example.com", "edit");
  await expect(shares.getByRole("listitem")).toHaveCount(1);
  await expect(shares.getByRole("listitem").first()).toContainText("Role: edit");

  // 2. recipient sees edit role and edit controls, but no delete or share controls
  await b.page.getByRole("link", { name: "Shared with me" }).click();
  const item = b.page.getByRole("listitem").filter({ has: b.page.getByRole("link", { name: "Plan trip" }) });
  await expect(item).toContainText("Role: edit");
  await expect(item.getByRole("button", { name: "Mark Plan trip done" })).toBeVisible();
  await b.page.getByRole("link", { name: "Plan trip" }).click();
  await expect(b.page.getByText("Your role: edit")).toBeVisible();
  await expect(b.page.getByLabel("Title")).toBeVisible();
  await expect(b.page.getByRole("button", { name: /Delete/ })).toHaveCount(0);
  await expect(b.page.getByLabel("Share with (email)")).toHaveCount(0);

  // 3. recipient edits everything
  await waitForHydration(b.page);
  await expect(async () => {
    await b.page.getByLabel("Title").fill("Plan summer trip");
    await b.page.getByLabel("Priority").selectOption("high");
    await b.page.getByLabel("Due date").fill("2030-06-01");
    await b.page.getByLabel("Recurrence").selectOption("weekly");
    await b.page.getByLabel("Status").selectOption("done");
    await b.page.getByRole("button", { name: "Save" }).click();
    await expect(b.page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
  }).toPass();

  // 4. owner sees the changes
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plan summer trip" })).toBeVisible();
  await expect(page.getByLabel("Priority")).toHaveValue("high");
  await expect(page.getByLabel("Due date")).toHaveValue("2030-06-01");
  await expect(page.getByLabel("Recurrence")).toHaveValue("weekly");
  await expect(page.getByLabel("Status")).toHaveValue("done");
  await expect(page.getByText("Completed: 1 February 2030")).toBeVisible();

  // 5-7. stale form refused after the role drops to view
  await b.page.reload();
  await waitForHydration(b.page);
  await share(page, "b@example.com", "view");
  await expect(shares.getByRole("listitem")).toHaveCount(1);
  await expect(shares.getByRole("listitem").first()).toContainText("Role: view");
  await b.page.getByLabel("Title").fill("Hijacked");
  await b.page.getByRole("button", { name: "Save" }).click();
  await expect(b.page.getByRole("alert").filter({ hasText: "You are not allowed to change this task." })).toBeVisible();

  // 8. both see the unchanged title; B has no edit controls
  await page.reload();
  await expect(page.getByRole("heading", { name: "Plan summer trip" })).toBeVisible();
  await b.page.reload();
  await expect(b.page.getByRole("heading", { name: "Plan summer trip" })).toBeVisible();
  await expect(b.page.getByText("Your role: view")).toBeVisible();
  await expect(b.page.getByLabel("Title")).toHaveCount(0);
  await expect(b.page.getByRole("main").getByRole("button")).toHaveCount(0);
  await b.context.close();
});

test("edit recipient: empty title is refused, and mark done from Shared with me sets the completion moment", async ({ page, browser, app }) => {
  const b = await setup(browser, page, app);
  await share(page, "b@example.com", "edit");
  await expect(page.getByRole("list", { name: "Shares" })).toContainText("Role: edit");

  await b.page.getByRole("link", { name: "Shared with me" }).click();
  await b.page.getByRole("link", { name: "Plan trip" }).click();
  await waitForHydration(b.page);
  await expect(async () => {
    await b.page.getByLabel("Title").fill("   ");
    await b.page.getByRole("button", { name: "Save" }).click();
    await expect(b.page.getByRole("alert").filter({ hasText: "A title is required." })).toBeVisible({ timeout: 2000 });
  }).toPass();
  await b.page.reload();
  await expect(b.page.getByRole("heading", { name: "Plan trip" })).toBeVisible();

  await b.page.getByRole("link", { name: "Shared with me" }).click();
  await waitForHydration(b.page);
  await expect(async () => {
    await b.page.getByRole("button", { name: "Mark Plan trip done" }).click();
    await expect(b.page.getByText("Status: done")).toBeVisible({ timeout: 2000 });
  }).toPass();
  await page.reload();
  await expect(page.getByLabel("Status")).toHaveValue("done");
  await expect(page.getByText("Completed: 1 February 2030")).toBeVisible();
  await b.context.close();
});

test("a view recipient is offered no mark-done in Shared with me", async ({ page, browser, app }) => {
  const b = await setup(browser, page, app);
  await b.page.getByRole("link", { name: "Shared with me" }).click();
  await expect(b.page.getByRole("button", { name: "Mark Plan trip done" })).toHaveCount(0);
  await b.context.close();
});
