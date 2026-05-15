import { WarningCircle } from "@phosphor-icons/react"

import type { Account } from "@/features/accounts/api"
import { formatBytes } from "@/shared/utils/formatSize"

interface QuotaHeroCardProps {
  accounts: Account[]
  // Akun yang status-nya bermasalah ditampilkan sebagai catatan: angka kuota
  // di hero card mencerminkan sinkronisasi terakhir, bukan kondisi real-time.
  problemAccounts: Account[]
}

export function QuotaHeroCard({ accounts, problemAccounts }: QuotaHeroCardProps) {
  const syncedAccounts = accounts.filter((a) => a.status !== "never_synced")
  const totalUsed = syncedAccounts.reduce((sum, a) => sum + a.quotaUsedBytes, 0)
  const totalCapacity = syncedAccounts.reduce((sum, a) => sum + a.quotaTotalBytes, 0)
  const percent =
    totalCapacity > 0 ? Math.min(Math.round((totalUsed / totalCapacity) * 100), 100) : 0

  const activeCount = accounts.filter((a) => a.status === "active").length
  const totalCount = accounts.length

  const barColor = percent >= 90 ? "bg-danger" : percent >= 70 ? "bg-warning" : "bg-success"

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[--radius] border border-line bg-panel shadow-soft">
      <header className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-2">
          Ringkasan Penyimpanan
        </h2>
      </header>

      <div className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Total terpakai
        </p>
        <p className="mt-2 text-2xl font-semibold text-ink">
          {formatBytes(totalUsed)}
          <span className="ml-2 text-sm font-normal text-muted">
            dari {formatBytes(totalCapacity)} · {percent}%
          </span>
        </p>
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-panel-soft">
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

      <div className="flex-1 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-2">
          Akun aktif
        </p>
        <p className="mt-2 text-2xl font-semibold text-ink">
          {activeCount}
          <span className="ml-2 text-sm font-normal text-muted">dari {totalCount}</span>
        </p>
        {problemAccounts.length > 0 ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-warning-soft px-3 py-2 text-xs text-warning-strong">
            <WarningCircle size={14} weight="fill" />
            <span>
              <strong className="font-semibold">{problemAccounts.length}</strong>{" "}
              memerlukan perhatian
            </span>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted">Semua akun sehat.</p>
        )}
      </div>
    </section>
  )
}
