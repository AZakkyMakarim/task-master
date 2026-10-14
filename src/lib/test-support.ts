import { cookies } from "next/headers";
import path from "node:path";
import { isTestMode } from "./config";

export const TEST_DB_COOKIE = "tm-test-db";
const DEFAULT_TEST_DB = "default";

/**
 * In test mode every browser context carries a cookie naming its own
 * isolated database (and clock). Without the cookie (manual use) a shared
 * "default" test database is used. Returns null outside test mode.
 */
export async function testDatabaseId(): Promise<string | null> {
  if (!isTestMode()) return null;
  const value = (await cookies()).get(TEST_DB_COOKIE)?.value;
  return value && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : DEFAULT_TEST_DB;
}

export function testDatabasePath(id: string): string {
  return path.resolve("data", "test", `${id}.db`);
}

export function testClockPath(id: string): string {
  return path.resolve("data", "test", `${id}.clock`);
}
