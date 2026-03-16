import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface QualityBadgeProps {
  score: number;
}

export function QualityBadge({ score }: QualityBadgeProps) {
  const tier = score >= 81
    ? { label: "Premium", className: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-100" }
    : score >= 61
    ? { label: "High", className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" }
    : score >= 31
    ? { label: "Medium", className: "bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100" }
    : { label: "Low", className: "bg-red-100 text-red-700 border-red-200 hover:bg-red-100" };

  return (
    <Badge variant="outline" className={cn("font-medium tabular-nums", tier.className)}>
      {score} · {tier.label}
    </Badge>
  );
}
