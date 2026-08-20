"use client";

import Link from "next/link";
import { Bug } from "lucide-react";

export function FeedbackButton() {
  return (
    <Link
      href="/feedback"
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      title="Bug Reports & Feature Requests"
    >
      <Bug className="h-4 w-4" />
    </Link>
  );
}
