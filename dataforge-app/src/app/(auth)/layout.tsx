import { Database } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30">
      <Link href="/" className="flex items-center gap-2 mb-8 font-semibold text-lg">
        <Database className="h-5 w-5 text-blue-600" />
        DataForge
      </Link>
      {children}
    </div>
  );
}
