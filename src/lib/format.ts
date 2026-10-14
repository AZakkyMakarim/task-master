import { calendarDay } from "./clock";

/** A calendar day (YYYY-MM-DD) as "10 March 2030", independent of any time zone. */
export function formatDay(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${day}T00:00:00Z`),
  );
}

/** A moment (ISO-8601) as the calendar day it falls on in the application time zone, e.g. "10 January 2030". */
export function formatMoment(iso: string): string {
  return formatDay(calendarDay(new Date(iso)));
}
