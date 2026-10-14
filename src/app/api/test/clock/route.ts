import fs from "node:fs";
import path from "node:path";
import { isTestMode } from "@/lib/config";
import { testClockPath, testDatabaseId } from "@/lib/test-support";

export const dynamic = "force-dynamic";

/** Test mode only. Body: {"now": "2030-01-15T10:00:00Z"}; {"now": null} restores the real clock. */
export async function POST(request: Request) {
  const id = await testDatabaseId();
  if (!isTestMode() || !id) return new Response("Not found", { status: 404 });
  const body = (await request.json().catch(() => null)) as { now?: string | null } | null;
  if (!body || !("now" in body)) {
    return Response.json({ error: "Expected {now: ISO-8601 string | null}" }, { status: 400 });
  }
  const file = testClockPath(id);
  if (body.now === null) {
    fs.rmSync(file, { force: true });
    return Response.json({ now: null });
  }
  const moment = new Date(String(body.now));
  if (Number.isNaN(moment.getTime())) return Response.json({ error: "Invalid moment" }, { status: 400 });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, moment.toISOString());
  return Response.json({ now: moment.toISOString() });
}
