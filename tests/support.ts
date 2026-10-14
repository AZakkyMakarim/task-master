import { expect, test as base, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

/**
 * Every test gets a browser context carrying its own test-database id, so the
 * server gives it an isolated SQLite database and clock. Tests run in
 * parallel and in any order.
 */
export const test = base.extend<{ app: App }>({
  context: async ({ context, baseURL }, run) => {
    await context.addCookies([{ name: "tm-test-db", value: randomUUID(), url: baseURL! }]);
    await run(context);
  },
  app: async ({ page }, run) => {
    await run(new App(page));
  },
});

export { expect };

export class App {
  constructor(private readonly page: Page) {}

  /** Test-only control: set the clock to a chosen moment (ISO-8601). */
  async setClock(isoMoment: string): Promise<void> {
    const res = await this.page.request.post("/api/test/clock", { data: { now: isoMoment } });
    expect(res.ok()).toBe(true);
  }

  /** Test-only control: start from an empty database. */
  async resetDatabase(): Promise<void> {
    const res = await this.page.request.post("/api/test/reset-database");
    expect(res.ok()).toBe(true);
  }
}

/** Waits until React has hydrated the page's forms, so typing is not undone by hydration. */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const forms = Array.from(document.querySelectorAll("form"));
    return forms.length > 0 && forms.every((f) => Object.keys(f).some((k) => k.startsWith("__reactProps")));
  });
}
