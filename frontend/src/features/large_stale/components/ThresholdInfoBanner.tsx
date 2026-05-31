import { Info } from "@phosphor-icons/react"

import type { LargeStaleThresholds } from "@/features/large_stale/api"

interface ThresholdInfoBannerProps {
  thresholds: LargeStaleThresholds
}

// Indonesian percentages use a comma decimal separator.
function formatPercent(value: number): string {
  return `${value.toString().replace(".", ",")}%`
}

export function ThresholdInfoBanner({ thresholds }: ThresholdInfoBannerProps) {
  return (
    <p className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted">
      <Info size={13} weight="bold" />
      <span>
        Kriteria: &gt;{formatPercent(thresholds.large_percent_of_quota)} kuota atau &gt;
        {thresholds.stale_months} bulan
      </span>
    </p>
  )
}
