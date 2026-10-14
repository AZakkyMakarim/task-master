import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts";
import { SignInForm } from "./signin-form";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (await currentUser()) redirect("/tasks");
  return (
    <main>
      <h1>Sign in</h1>
      <SignInForm />
      <p>
        New here? <Link href="/register">Register</Link>
      </p>
    </main>
  );
}
