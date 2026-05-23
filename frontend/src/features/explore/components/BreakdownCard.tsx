import type { Account } from "@/features/accounts/api"
import {
  getProviderLabel,
  ProviderLogo,
} from "@/features/accounts/components/ProviderLogo"
import type { QuotaAccount } from "@/features/explore/api"
import { QuotaBar } from "@/shared/components/QuotaBar"
import { StatusBadge, type BadgeVariant } from "@/shared/components/StatusBadge"
import { formatBytes } from "@/shared/utils/formatSize"

interface BreakdownCardProps {
  account: Account
  quotaAccount?: QuotaAccount
  isLoading?: boolean
}

const STATUS_LABEL: Record<Account["status"], { label: string; variant: BadgeVariant }> = {
  active: { label: "Aktif", variant: "success" },
  never_synced: { label: "Memuat data", variant: "warning" },
  syncing: { label: "Memuat data", variant: "warning" },
  token_invalid: { label: "Perlu otorisasi ulang", variant: "danger" },
  revoked: { label: "Akses dicabut", variant: "danger" },
  load_failed: { label: "Gagal memuat", variant: "danger" },
}

export function BreakdownCard({
  account,
  quotaAccount,
  isLoading = false,
}: BreakdownCardProps) {
  const meta = isLoading ? STATUS_LABEL.syncing : STATUS_LABEL[account.status]
  const quotaUsedBytes = quotaAccount?.usedBytes ?? account.quotaUsedBytes
  const quotaTotalBytes = quotaAccount?.totalBytes ?? account.quotaTotalBytes

  return (
    <article className="rounded-[--radius-sm] border border-line bg-bg px-3.5 py-3">
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
        <p className="text-xs text-ink-soft">
          <span className="font-medium">{formatBytes(quotaUsedBytes)}</span>{" "}
          <span className="text-muted">/ {formatBytes(quotaTotalBytes)}</span>
        </p>
        <div className="mt-1.5">
          <QuotaBar
            usedBytes={quotaUsedBytes}
            totalBytes={quotaTotalBytes}
            showLabel={false}
          />
        </div>
      </div>
    </article>
  )
}
