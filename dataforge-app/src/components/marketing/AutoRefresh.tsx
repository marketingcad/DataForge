"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Silently re-fetches server component data every `intervalMs` milliseconds.
export function AutoRefresh({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
