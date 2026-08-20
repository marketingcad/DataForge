import { redirect } from "next/navigation";

// The app has no marketing landing page — the root goes straight to sign-in.
// (Logged-in users are redirected to /dashboard by the auth middleware before
// this ever renders.)
export default function HomePage() {
  redirect("/sign-in");
}
