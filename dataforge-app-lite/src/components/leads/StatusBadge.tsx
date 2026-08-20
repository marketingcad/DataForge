import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "flagged" | "invalid";
}

const statusConfig = {
  active: { label: "Active", className: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100" },
  flagged: { label: "Flagged", className: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100" },
  invalid: { label: "Invalid", className: "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-100" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
