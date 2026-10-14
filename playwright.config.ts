import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.TEST_PORT || 3100);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [["list"]],
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Starts the application in test mode on its own build directory.
    command: `npx cross-env TASK_MASTER_TEST_MODE=1 NEXT_DIST_DIR=.next-test next dev -p ${port}`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
