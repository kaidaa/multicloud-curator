import { Info } from "@phosphor-icons/react"

import type { LargeStaleThresholds } from "@/shared/api/mocks/largeStale"

interface ThresholdInfoBannerProps {
  thresholds: LargeStaleThresholds
}

// Format persen lokal id-ID supaya pakai koma desimal ("0,5%" bukan "0.5%").
function formatPercent(value: number): string {
  return `${value.toString().replace(".", ",")}%`
}

export function ThresholdInfoBanner({ thresholds }: ThresholdInfoBannerProps) {
  return (
    <div className="flex items-start gap-2.5 rounded-[--radius-sm] border border-line bg-panel-soft px-4 py-2.5 text-xs text-ink-soft">
      <Info size={16} weight="bold" className="mt-0.5 flex-shrink-0 text-muted" />
      <p>
        Menampilkan file milik Anda yang melebihi{" "}
        <strong className="font-semibold">{formatPercent(thresholds.large_percent_of_quota)}</strong>{" "}
        kuota akun ATAU tidak dimodifikasi dalam{" "}
        <strong className="font-semibold">{thresholds.stale_months} bulan</strong>{" "}
        terakhir.
      </p>
    </div>
  )
}
