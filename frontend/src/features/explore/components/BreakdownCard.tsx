import type { Account } from "@/features/accounts/api"
import {
  getProviderLabel,
  ProviderLogo,
} from "@/features/accounts/components/ProviderLogo"
import { QuotaBar } from "@/shared/components/QuotaBar"
import { StatusBadge, type BadgeVariant } from "@/shared/components/StatusBadge"
import { formatBytes } from "@/shared/utils/formatSize"

interface BreakdownCardProps {
  account: Account
}

const STATUS_LABEL: Record<Account["status"], { label: string; variant: BadgeVariant }> = {
  active: { label: "Aktif", variant: "success" },
  never_synced: { label: "Belum disinkronisasi", variant: "warning" },
  syncing: { label: "Memuat", variant: "warning" },
  token_invalid: { label: "Token kadaluwarsa", variant: "danger" },
  revoked: { label: "Otorisasi dicabut", variant: "danger" },
}

export function BreakdownCard({ account }: BreakdownCardProps) {
  const meta = STATUS_LABEL[account.status]
  const hasData = account.status !== "never_synced"

  return (
    <article className="rounded-[--radius-sm] border border-line bg-panel px-4 py-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <ProviderLogo provider={account.provider} size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{getProviderLabel(account.provider)}</p>
            <p className="truncate text-xs text-muted">{account.email}</p>
          </div>
        </div>
        <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
      </header>

      <div className="mt-3">
        {hasData ? (
          <>
            <p className="text-xs text-ink-soft">
              <span className="font-medium">{formatBytes(account.quotaUsedBytes)}</span>{" "}
              <span className="text-muted">/ {formatBytes(account.quotaTotalBytes)}</span>
            </p>
            <div className="mt-1.5">
              <QuotaBar
                usedBytes={account.quotaUsedBytes}
                totalBytes={account.quotaTotalBytes}
                showLabel={false}
              />
            </div>
          </>
        ) : (
          <p className="text-xs text-muted">— / {formatBytes(account.quotaTotalBytes)}</p>
        )}
      </div>
    </article>
  )
}
