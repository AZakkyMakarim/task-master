import fs from "node:fs";
import { appTimeZone } from "./config";
import { testClockPath, testDatabaseId } from "./test-support";

/** The only source of "now" in the application. */
export async function now(): Promise<Date> {
  const id = await testDatabaseId(); // null outside test mode
  if (id) {
    try {
      const fixed = new Date(fs.readFileSync(testClockPath(id), "utf8").trim());
      if (!Number.isNaN(fixed.getTime())) return fixed;
    } catch {
      // no override set: fall through to the real time
    }
  }
  return new Date();
}

/** Calendar day (YYYY-MM-DD) of a moment in the application-wide time zone. */
export function calendarDay(moment: Date, timeZone: string = appTimeZone()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(moment);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** "Today": the current calendar day in the application-wide time zone. */
export async function today(): Promise<string> {
  return calendarDay(await now());
}
