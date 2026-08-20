import { Badge } from "@/components/ui/badge";

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800" },
  running: { label: "Running", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800" },
  completed: { label: "Completed", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800" },
  failed: { label: "Failed", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800" },
  paused: { label: "Paused", className: "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400 dark:border-gray-700" },
};

export function JobStatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={`text-xs font-medium capitalize ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}
