/**
 * Battery-style indicator of how many leads in a folder have been exported.
 * Renders nothing when nothing has been exported yet (no bar for 0 exports).
 * Sits to the right of the "Click to view leads →" hint on a folder card.
 */
export function FolderExportBar({
  exported,
  total,
  color,
}: {
  exported: number;
  total: number;
  color: string;
}) {
  if (!exported) return null;
  const pct = total > 0 ? Math.min(100, Math.round((exported / total) * 100)) : 0;

  return (
    <div
      className="flex items-center gap-1.5 shrink-0"
      title={`${exported.toLocaleString()} of ${total.toLocaleString()} exported (${pct}%)`}
    >
      <span className="text-[10px] font-semibold tabular-nums leading-none" style={{ color }}>
        {pct}%
      </span>
      {/* Battery: rounded track + fill + terminal nub */}
      <div className="flex items-center">
        <div
          className="relative h-3 w-7 rounded-[3px] border overflow-hidden"
          style={{ borderColor: color + "66", backgroundColor: color + "14" }}
        >
          <div
            className="absolute inset-y-0 left-0 transition-all"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <div className="h-1.5 w-[2px] rounded-r-sm" style={{ backgroundColor: color + "66" }} />
      </div>
    </div>
  );
}
