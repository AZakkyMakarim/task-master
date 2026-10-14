import { expect, test } from "./support";


function today() {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(),
  );
}

test("home page shows today's date from the clock", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Task Manager", level: 1 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Today" })).toContainText(today());
});

test("setting the clock changes the date shown on the home page", async ({ page, app }) => {
  await app.setClock("2030-01-15T10:00:00Z");
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Today" })).toContainText("15 January 2030");

  await app.setClock("2031-12-31T23:59:00Z");
  await page.reload();
  await expect(page.getByRole("region", { name: "Today" })).toContainText("31 December 2031");
});

test("the clock is isolated per test", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Today" })).not.toContainText("2030");
});

test("resetting the database leaves a working application", async ({ page, app }) => {
  await page.goto("/");
  await app.setClock("2030-01-15T10:00:00Z");
  await app.resetDatabase();
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Today" })).toContainText("15 January 2030");
});
