"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
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

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (err: unknown) {
    // Re-throw Next.js redirect (this is how a successful login works)
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
}
