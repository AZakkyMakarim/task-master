import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        This page does not exist. <Link href="/tasks">Go to My tasks</Link>
      </p>
    </main>
  );
}
