import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/**
 * Generic page loading skeleton used by route-level loading.tsx files so that
 * navigation shows an instant placeholder (especially important in the desktop
 * app, where every click otherwise feels frozen until the server responds).
 *
 * Pick a `variant` that roughly matches the destination page's shape.
 */
export function PageSkeleton({
  variant = "list",
  title = true,
}: {
  variant?: "list" | "table" | "cards" | "grid" | "form";
  title?: boolean;
}) {
  return (
    <div className="space-y-6">
      {title && (
        <>
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
          <Separator />
        </>
      )}

      {variant === "table" && (
        <div className="rounded-xl border">
          <div className="border-b p-3">
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      )}

      {variant === "cards" && (
        <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      )}

      {variant === "list" && (
        <div className="stagger space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2 rounded-xl border p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      )}

      {variant === "grid" && (
        <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      )}

      {variant === "form" && (
        <div className="max-w-2xl space-y-4 rounded-xl border p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      )}
    </div>
  );
}
