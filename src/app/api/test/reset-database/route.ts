import { isTestMode } from "@/lib/config";
import { destroyTestDatabase } from "@/lib/db";
import { testDatabaseId } from "@/lib/test-support";

export const dynamic = "force-dynamic";

/** Test mode only. Empties the current test database (the schema is re-created on next use). */
export async function POST() {
  const id = await testDatabaseId();
  if (!isTestMode() || !id) return new Response("Not found", { status: 404 });
  destroyTestDatabase(id);
  return Response.json({ reset: true });
}
