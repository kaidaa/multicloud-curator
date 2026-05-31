import { formatBytes } from "@/shared/utils/formatSize"

interface QuotaBarProps {
  usedBytes: number
  totalBytes: number
  // Hide the text label when the bar is only a compact visual indicator.
  showLabel?: boolean
}

export function QuotaBar({ usedBytes, totalBytes, showLabel = true }: QuotaBarProps) {
  const safeTotal = totalBytes > 0 ? totalBytes : 0
  const ratio = safeTotal === 0 ? 0 : Math.min(usedBytes / safeTotal, 1)
  const percent = Math.round(ratio * 100)

  // Color warns about capacity pressure even when the percentage is skipped.
  const barColor =
    ratio >= 0.9
      ? "bg-danger"
      : ratio >= 0.75
        ? "bg-warning"
        : "bg-primary"

  return (
    <div className="w-full">
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>
            {formatBytes(usedBytes)} / {formatBytes(totalBytes)}
          </span>
          <span>{percent}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-soft">
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
