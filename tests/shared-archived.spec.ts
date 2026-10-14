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

/** Sessions last 30 days, so a test that jumps the clock past that signs in again. */
async function signIn(page: Page, email: string) {
  await page.goto("/signin");
  await waitForHydration(page);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
}

function row(page: Page, title: string) {
  return page.getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });
}

async function addTask(page: Page, title: string, due?: string) {
  await page.getByLabel("New task title").fill(title);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
  if (due) {
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(async () => {
      await waitForHydration(page);
      await page.getByLabel("Due date").fill(due);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2000 });
    }).toPass();
    await page.goto("/tasks");
  }
}

async function shareFromDetail(page: Page, title: string, email: string, role: "view" | "edit") {
  await page.goto("/tasks");
  await page.getByRole("link", { name: title, exact: true }).click();
  await waitForHydration(page);
  await page.getByLabel("Share with (email)").fill(email);
  await page.getByLabel("Role").selectOption(role);
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByRole("list", { name: "Shares" })).toContainText(email);
}

test("overdue and archived behave on shared tasks, and an archived task's shares are frozen", async ({ page, browser, app }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const watch = (p: Page) => {
    p.on("console", (m) => m.type() === "error" && !m.text().includes("403") && errors.push(m.text()));
    p.on("pageerror", (e) => errors.push(e.message));
  };
  watch(page);

  await app.setClock("2030-03-10T12:00:00Z");
  await register(page, "a@example.com");
  const b = await newSession(browser, page);
  watch(b.page);
  await register(b.page, "b@example.com");

  await addTask(page, "Late task", "2030-03-09");
  await addTask(page, "On time task", "2030-03-10");
  await addTask(page, "Finished task");
  for (const title of ["Late task", "On time task", "Finished task"]) await shareFromDetail(page, title, "b@example.com", "edit");
  await page.goto("/tasks");
  await waitForHydration(page);
  await row(page, "Finished task").getByRole("button", { name: "Mark Finished task done" }).click();
  await expect(row(page, "Finished task").getByText("Status: done")).toBeVisible();

  // 1. Overdue marks in "Shared with me", by the same rule.
  await b.page.goto("/shared");
  await expect(row(b.page, "Late task").getByText("Overdue", { exact: true })).toBeVisible();
  await expect(row(b.page, "On time task").getByText("Overdue", { exact: true })).toHaveCount(0);

  // 2. The edit recipient completes the overdue task: the mark goes for both.
  await waitForHydration(b.page);
  await row(b.page, "Late task").getByRole("button", { name: "Mark Late task done" }).click();
  await expect(row(b.page, "Late task").getByText("Status: done")).toBeVisible();
  await expect(row(b.page, "Late task").getByText("Overdue", { exact: true })).toHaveCount(0);
  await page.goto("/tasks");
  await expect(row(page, "Late task").getByText("Status: done")).toBeVisible();
  await expect(row(page, "Late task").getByText("Overdue", { exact: true })).toHaveCount(0);

  // 3. Stale tabs: B's edit form and A's share panel, both open before the archive.
  const staleB = await b.context.newPage();
  watch(staleB);
  await b.page.getByRole("link", { name: "Finished task" }).click();
  await expect(b.page.getByLabel("Title")).toHaveValue("Finished task");
  await staleB.goto(b.page.url());
  await waitForHydration(staleB);
  await expect(staleB.getByLabel("Title")).toHaveValue("Finished task");
  await page.getByRole("link", { name: "Finished task" }).click();
  await waitForHydration(page);
  await expect(page.getByRole("list", { name: "Shares" })).toContainText("b@example.com");
  const finishedUrl = page.url();
  const staleA = await page.context().newPage();
  watch(staleA);
  await staleA.goto(finishedUrl);
  await waitForHydration(staleA);
  await expect(staleA.getByRole("button", { name: "Revoke b@example.com" })).toBeVisible();

  // 4-5. Thirty-one days later "Finished task" is archived: hidden by default, listed on request.
  await app.setClock("2030-04-10T12:00:00Z");
  await signIn(page, "a@example.com");
  await signIn(b.page, "b@example.com");
  await b.page.goto("/shared");
  await expect(b.page.getByRole("link", { name: "Finished task" })).toHaveCount(0);
  await expect(b.page.getByRole("link", { name: "Late task" })).toHaveCount(0);
  await expect(row(b.page, "On time task").getByText("Overdue", { exact: true })).toBeVisible();
  await waitForHydration(b.page);
  await b.page.getByLabel("Show archived").check();
  await b.page.getByRole("button", { name: "Apply" }).click();
  await expect(b.page).toHaveURL(/archived=1/);
  await expect(row(b.page, "Finished task").getByText("Archived", { exact: true })).toBeVisible();
  await expect(row(b.page, "Late task").getByText("Archived", { exact: true })).toBeVisible();
  await expect(row(b.page, "On time task").getByText("Archived", { exact: true })).toHaveCount(0);
  await expect(row(b.page, "Finished task").getByRole("button", { name: /Mark .* done/ })).toHaveCount(0);
  await b.page.reload();
  await expect(b.page.getByLabel("Show archived")).toBeChecked();
  await expect(row(b.page, "Finished task").getByText("Archived", { exact: true })).toBeVisible();

  // 6. B sees everything and no edit or status controls.
  await b.page.getByRole("link", { name: "Finished task" }).click();
  await expect(b.page.getByRole("heading", { name: "Finished task" })).toBeVisible();
  await expect(b.page.getByText("Archived", { exact: true })).toBeVisible();
  await expect(b.page.getByText("Your role: edit")).toBeVisible();
  await expect(b.page.getByText("Status: done")).toBeVisible();
  await expect(b.page.getByText("Priority: medium")).toBeVisible();
  await expect(b.page.getByText("Recurrence: none")).toBeVisible();
  await expect(b.page.getByLabel("Status")).toHaveCount(0);
  await expect(b.page.getByLabel("Title")).toHaveCount(0);
  await expect(b.page.getByRole("button", { name: "Save" })).toHaveCount(0);

  // Edge: the task completed exactly 31 days earlier is read-only too; the never-completed one is editable.
  await b.page.goto("/shared?archived=1");
  await b.page.getByRole("link", { name: "Late task" }).click();
  await expect(b.page.getByRole("heading", { name: "Late task" })).toBeVisible();
  await expect(b.page.getByText("Archived", { exact: true })).toBeVisible();
  await expect(b.page.getByLabel("Title")).toHaveCount(0);
  await b.page.goto("/shared");
  await b.page.getByRole("link", { name: "On time task" }).click();
  await expect(b.page.getByRole("heading", { name: "On time task" })).toBeVisible();
  await expect(b.page.getByLabel("Title")).toBeVisible();

  // 7. B's stale edit form is refused and the task is unchanged.
  await staleB.getByLabel("Title").fill("Changed");
  await staleB.getByRole("button", { name: "Save" }).click();
  await expect(staleB.getByRole("alert").filter({ hasText: "Archived tasks cannot be changed." })).toBeVisible();
  await staleB.reload();
  await expect(staleB.getByRole("heading", { name: "Finished task" })).toBeVisible();
  await staleB.close();

  // 8. A sees the shares, with no way to change them.
  await page.goto(finishedUrl);
  await expect(page.getByText("Archived", { exact: true })).toBeVisible();
  const shares = page.getByRole("list", { name: "Shares" });
  await expect(shares).toContainText("b@example.com");
  await expect(shares).toContainText("Role: edit");
  await expect(page.getByLabel("Share with (email)")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Share" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Revoke/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Delete Finished task" })).toBeVisible();

  // 9. The stale share panel is refused for revoke and for sharing again.
  await staleA.getByRole("button", { name: "Revoke b@example.com" }).click();
  await expect(staleA.getByRole("alert").filter({ hasText: "Archived tasks cannot be changed." })).toBeVisible();
  await staleA.getByLabel("Share with (email)").fill("b@example.com");
  await staleA.getByLabel("Role").selectOption("view");
  await staleA.getByRole("button", { name: "Share" }).click();
  await expect(staleA.getByRole("alert").filter({ hasText: "Archived tasks cannot be changed." })).toHaveCount(2);
  await staleA.close();
  await page.reload();
  await expect(shares).toContainText("Role: edit");
  await expect(shares).toContainText("b@example.com");

  // 10. The owner deletes it; it leaves the recipient's archived view.
  await waitForHydration(page);
  await page.getByRole("button", { name: "Delete Finished task" }).click();
  await page.getByRole("dialog", { name: /Finished task/ }).getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByRole("heading", { name: "My tasks" })).toBeVisible();
  await b.page.goto("/shared?archived=1");
  await expect(b.page.getByRole("link", { name: "Finished task" })).toHaveCount(0);
  await expect(b.page.getByRole("link", { name: "Late task" })).toBeVisible();

  expect(errors).toEqual([]);
  await b.context.close();
});
