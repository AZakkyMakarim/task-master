import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { now } from "../clock";
import { getDb } from "../db";
import { redirect } from "next/navigation";
import { hashPassword, verifyPassword } from "./password";

export const SESSION_COOKIE = "tm-session";
export const SESSION_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;

export type CurrentUser = { id: number; email: string };

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export type RegisterResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; field: "email" | "password"; message: string };

/** Creates a user. Emails are normalised before validation and the uniqueness check. */
export async function registerUser(rawEmail: string, password: string): Promise<RegisterResult> {
  const email = normaliseEmail(rawEmail);
  if (!isValidEmail(email)) return { ok: false, field: "email", message: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, field: "password", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  const db = await getDb();
  const taken = { ok: false, field: "email", message: "That email is already registered." } as const;
  if (await db.selectFrom("users").select("id").where("email", "=", email).executeTakeFirst()) return taken;
  try {
    const row = await db
      .insertInto("users")
      .values({ email, password_hash: await hashPassword(password), created_at: (await now()).toISOString() })
      .returning("id")
      .executeTakeFirstOrThrow();
    return { ok: true, user: { id: row.id, email } };
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint/.test(error.message)) return taken; // lost a race
    throw error;
  }
}

/** Starts a server-side session and sets the http-only cookie that references it. */
export async function startSession(userId: number): Promise<void> {
  const db = await getDb();
  const id = randomBytes(32).toString("base64url");
  const expires = new Date((await now()).getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insertInto("sessions").values({ id, user_id: userId, expires_at: expires.toISOString() }).execute();
  (await cookies()).set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", path: "/", expires });
}

/** The signed-in user for the current request, or null. */
export async function currentUser(): Promise<CurrentUser | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const db = await getDb();
  const row = await db
    .selectFrom("sessions")
    .innerJoin("users", "users.id", "sessions.user_id")
    .select(["users.id as id", "users.email as email", "sessions.expires_at as expires_at"])
    .where("sessions.id", "=", id)
    .executeTakeFirst();
  if (!row || new Date(row.expires_at).getTime() <= (await now()).getTime()) return null;
  return { id: row.id, email: row.email };
}

/** The signed-in user, or a redirect to the sign-in page. Every task page starts with this. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect("/signin");
  return user;
}

export const INVALID_CREDENTIALS = "Email or password is incorrect.";

// Checked when the email is unknown so both failures cost the same time.
const DUMMY_HASH = hashPassword("not-a-real-password");

/** The user for these credentials, or null. Never says which of the two was wrong. */
export async function authenticate(rawEmail: string, password: string): Promise<CurrentUser | null> {
  const email = normaliseEmail(rawEmail);
  const db = await getDb();
  const row = await db
    .selectFrom("users")
    .select(["id", "email", "password_hash"])
    .where("email", "=", email)
    .executeTakeFirst();
  const ok = await verifyPassword(password, row ? row.password_hash : await DUMMY_HASH);
  return row && ok ? { id: row.id, email: row.email } : null;
}

/** Deletes the server-side session and its cookie. */
export async function endSession(): Promise<void> {
  const jar = await cookies();
  const id = jar.get(SESSION_COOKIE)?.value;
  if (id) await (await getDb()).deleteFrom("sessions").where("id", "=", id).execute();
  jar.delete(SESSION_COOKIE);
}
