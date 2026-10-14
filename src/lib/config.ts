/** Application-wide time zone (IANA name). Configured via APP_TIME_ZONE, UTC by default. */
export function appTimeZone(): string {
  return process.env.APP_TIME_ZONE?.trim() || "UTC";
}

/**
 * Test mode enables the two test-only controls (set the clock, reset the
 * database). It can never be on in a production build, even if the
 * environment variable is set.
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.TASK_MASTER_TEST_MODE === "1";
}

export function databasePath(): string {
  return process.env.DATABASE_PATH?.trim() || "data/task-master.db";
}
