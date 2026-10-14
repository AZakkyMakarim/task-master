import { today } from "@/lib/clock";
import { appTimeZone } from "@/lib/config";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  await getDb(); // opens the database, applying migrations on a fresh one
  const day = await today();
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${day}T00:00:00Z`));

  return (
    <main>
      <h1>Task Manager</h1>
      <section aria-labelledby="today-heading">
        <h2 id="today-heading">Today</h2>
        <p>
          <time dateTime={day}>{label}</time> ({appTimeZone()})
        </p>
      </section>
    </main>
  );
}
