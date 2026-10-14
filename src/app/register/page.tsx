import { redirect } from "next/navigation";
import { currentUser } from "@/lib/accounts";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await currentUser()) redirect("/tasks");
  return (
    <main>
      <h1>Register</h1>
      <RegisterForm />
    </main>
  );
}
