"use client";

import { useEffect } from "react";
import { DbReconnect } from "@/components/DbReconnect";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return <DbReconnect reset={reset} digest={error.digest} />;
}
