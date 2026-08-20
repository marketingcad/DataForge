"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

// Auth.js session-cookie names across prefixes/versions (secure prefix first).
const SESSION_COOKIE_NAMES = [
  "__Secure-authjs.session-token",
  "authjs.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
];

/**
 * When "Remember me" is unchecked, downgrade the persistent session cookie
 * Auth.js just set into a SESSION cookie (no maxAge/expires) so it clears when
 * the browser closes. Best-effort: if it fails, the session simply stays
 * persistent — login is never broken by this.
 */
async function makeSessionCookieEphemeral() {
  try {
    const jar = await cookies();
    const name = SESSION_COOKIE_NAMES.find((n) => jar.has(n));
    if (!name) return;
    const value = jar.get(name)!.value;
    jar.set(name, value, {
      httpOnly: true,
      sameSite: "lax",
      secure: name.startsWith("__Secure-"),
      path: "/",
      // no maxAge / expires → the browser drops it on close
    });
  } catch { /* non-fatal */ }
}

export async function signOutAction() {
  // Clear the session WITHOUT a server-side redirect — the client navigates
  // itself after this resolves (a server redirect from a plain onClick action
  // doesn't reliably move the browser, which left users stuck until a reload).
  await signOut({ redirect: false });
}

export async function registerAction(formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const hashed = await bcrypt.hash(password, 12);
  // First user ever registered automatically becomes boss
  const isFirstUser = (await prisma.user.count()) === 0;
  await prisma.user.create({
    data: { name, email, password: hashed, role: isFirstUser ? "boss" : "lead_specialist" },
  });

  await signIn("credentials", { email, password, redirectTo: "/dashboard" });
}

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const rememberMe = !!formData.get("rememberMe");

  try {
    if (rememberMe) {
      // Proven path: persistent session (Auth.js default). Throws NEXT_REDIRECT
      // on success.
      await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    } else {
      // Sign in without redirecting so we can shorten the cookie afterwards.
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res && typeof res === "object" && "error" in res && (res as { error?: unknown }).error) {
        return { error: "Invalid email or password." };
      }
    }
  } catch (err: unknown) {
    // Re-throw Next.js redirect (this is how the rememberMe path succeeds)
    if (err instanceof Error && (err as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    const type = (err as { type?: string }).type;
    const message = err instanceof Error ? err.message : String(err);
    if (type === "CredentialsSignin" || message.includes("CredentialsSignin")) {
      return { error: "Invalid email or password." };
    }
    return { error: "Invalid email or password." };
  }

  // Reached only on the successful !rememberMe path: make the session end on
  // browser close, then navigate.
  await makeSessionCookieEphemeral();
  redirect("/dashboard");
}
