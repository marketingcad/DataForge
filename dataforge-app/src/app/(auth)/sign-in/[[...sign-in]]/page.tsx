"use client";

import { useState } from "react";
import { loginAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Database, EyeIcon, EyeOffIcon, Loader2, Search, ShieldCheck, BarChart3 } from "lucide-react";

export default function SignInPage() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const result = await loginAction(new FormData(e.currentTarget));
    if (result?.error) {
      setError(result.error);
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left: brand panel (hidden on small screens) ── */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 text-white lg:flex">
        {/* Decorative dot grid + soft glows */}
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <Database className="h-6 w-6" />
          </div>
          <span className="text-2xl font-semibold tracking-tight">DataForge</span>
        </div>

        {/* Headline + features */}
        <div className="relative z-10 max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Extract &amp; manage leads <span className="text-blue-200">at scale</span>
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-blue-100/90">
            Discover businesses, scrape contact details automatically, and keep your
            database clean with intelligent deduplication.
          </p>

          <ul className="mt-10 space-y-5">
            <Feature
              icon={<Search className="h-5 w-5" />}
              title="Automated discovery"
              desc="Find businesses on Google Maps and pull their contact details automatically."
            />
            <Feature
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Smart deduplication"
              desc="Phone, email, and website signals are cross-checked so a lead is never saved twice."
            />
            <Feature
              icon={<BarChart3 className="h-5 w-5" />}
              title="Quality scoring"
              desc="Every lead is scored on completeness — scores only go up as more data is found."
            />
          </ul>
        </div>

        <p className="relative z-10 text-sm text-blue-100/70">
          © 2026 DataForge. All rights reserved.
        </p>
      </div>

      {/* ── Right: sign-in form ── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo (mobile only — the brand panel carries it on desktop) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Database className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold tracking-tight">DataForge</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-muted-foreground">Sign in to access your workspace.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="leading-5">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="leading-5">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  required
                  autoComplete="current-password"
                  className="h-11 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 rounded-l-none text-muted-foreground hover:bg-transparent focus-visible:ring-0"
                >
                  {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Checkbox id="rememberMe" name="rememberMe" className="size-4" />
                <Label htmlFor="rememberMe" className="font-normal text-muted-foreground">
                  Remember me
                </Label>
              </div>
              <a href="#" className="text-sm text-blue-600 hover:underline">
                Forgot password?
              </a>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="h-11 w-full bg-blue-600 text-white hover:bg-blue-700"
              disabled={pending}
            >
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {pending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
        {icon}
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm leading-relaxed text-blue-100/80">{desc}</p>
      </div>
    </li>
  );
}
