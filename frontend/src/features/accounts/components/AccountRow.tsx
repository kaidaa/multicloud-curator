import { useState } from "react"
import {
  ArrowsClockwise,
  CircleNotch,
  Plugs,
  ShieldWarning,
} from "@phosphor-icons/react"

import type { Account, AccountStatus } from "@/features/accounts/api"
import {
  getProviderLabel,
  ProviderLogo,
} from "@/features/accounts/components/ProviderLogo"
import { QuotaBar } from "@/shared/components/QuotaBar"
import { StatusBadge, type BadgeVariant } from "@/shared/components/StatusBadge"
import { formatDateID } from "@/shared/utils/formatDate"
import { formatBytes } from "@/shared/utils/formatSize"

interface StatusMeta {
  variant: BadgeVariant
  label: string
}

const STATUS_META: Record<AccountStatus, StatusMeta> = {
  active: { variant: "success", label: "Aktif" },
  never_synced: { variant: "warning", label: "Belum disinkronisasi" },
  syncing: { variant: "warning", label: "Memuat metadata" },
  token_invalid: { variant: "danger", label: "Token kadaluwarsa" },
  revoked: { variant: "danger", label: "Otorisasi dicabut" },
}

interface AccountRowProps {
  account: Account
  onRefresh: (accountId: string) => Promise<void>
  onReauthorize: (accountId: string) => Promise<void>
  onDisconnect: (accountId: string) => void
}

export function AccountRow({
  account,
  onRefresh,
  onReauthorize,
  onDisconnect,
}: AccountRowProps) {
  const [busyAction, setBusyAction] = useState<"refresh" | "reauthorize" | null>(null)
  const statusMeta = STATUS_META[account.status]
  const isSyncing = account.status === "syncing"
  const needsReauth =
    account.status === "token_invalid" || account.status === "revoked"
  const canRefresh = account.status === "active" || account.status === "never_synced"

  async function handleRefresh() {
    if (busyAction) return
    setBusyAction("refresh")
    try {
      await onRefresh(account.id)
    } finally {
      setBusyAction(null)
    }
  }

  async function handleReauthorize() {
    if (busyAction) return
    setBusyAction("reauthorize")
    try {
      await onReauthorize(account.id)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <tr className="border-b border-line transition last:border-b-0 hover:bg-panel-soft/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ProviderLogo provider={account.provider} size="sm" />
          <span className="text-sm font-medium text-ink">
            {getProviderLabel(account.provider)}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-ink-soft">{account.email}</td>
      <td className="px-4 py-3">
        <StatusBadge
          variant={statusMeta.variant}
          icon={
            isSyncing ? (
              <CircleNotch size={12} className="animate-spin" weight="bold" />
            ) : undefined
          }
        >
          {statusMeta.label}
        </StatusBadge>
      </td>
      <td className="px-4 py-3 align-middle">
        <div className="min-w-[140px] space-y-1.5">
          <p className="whitespace-nowrap text-xs text-ink-soft">
            {formatBytes(account.quotaUsedBytes)} / {formatBytes(account.quotaTotalBytes)}
          </p>
          <QuotaBar
            usedBytes={account.quotaUsedBytes}
            totalBytes={account.quotaTotalBytes}
            showLabel={false}
          />
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-soft">
        {formatDateID(account.lastSyncAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1.5">
          {needsReauth && (
            <button
              type="button"
              onClick={handleReauthorize}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1 rounded-[--radius-sm] bg-primary px-2.5 py-1 text-xs font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === "reauthorize" ? (
                <CircleNotch size={13} className="animate-spin" weight="bold" />
              ) : (
                <ShieldWarning size={13} weight="bold" />
              )}
              <span>Otorisasi ulang</span>
            </button>
          )}
          {canRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={busyAction !== null}
              className="inline-flex items-center gap-1 rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busyAction === "refresh" || isSyncing ? (
                <CircleNotch size={13} className="animate-spin" weight="bold" />
              ) : (
                <ArrowsClockwise size={13} weight="bold" />
              )}
              <span>Refresh</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onDisconnect(account.id)}
            disabled={busyAction !== null}
            className="inline-flex items-center gap-1 rounded-[--radius-sm] px-2.5 py-1 text-xs font-medium text-danger-strong transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plugs size={13} weight="bold" />
            <span>Putus koneksi</span>
          </button>
        </div>
      </td>
    </tr>
  )
}
