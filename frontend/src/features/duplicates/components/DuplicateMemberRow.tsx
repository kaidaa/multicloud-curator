import { ArrowSquareOut } from "@phosphor-icons/react"

import { getProviderLabel } from "@/features/accounts/components/ProviderLogo"
import type { DuplicateMember } from "@/features/duplicates/api"
import { FileIcon } from "@/shared/components/FileIcon"
import { formatRelativeTime } from "@/shared/utils/formatTime"
import { formatBytes } from "@/shared/utils/formatSize"

interface DuplicateMemberRowProps {
  member: DuplicateMember
  isSelected: boolean
  onToggleSelection: (fileId: string) => void
}

function openInProvider(href: string | null) {
  if (!href) return
  window.open(href, "_blank", "noopener,noreferrer")
}

export function DuplicateMemberRow({
  member,
  isSelected,
  onToggleSelection,
}: DuplicateMemberRowProps) {
  const disabled = !member.deletable
  const reason = member.deletableReason ?? ""
  const providerLabel = getProviderLabel(member.provider)
  const metaLine = [
    member.accountEmail,
    providerLabel,
    member.path,
    formatRelativeTime(member.modifiedAt),
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      className={`grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0 ${
        disabled ? "bg-warning-soft/30" : ""
      }`}
    >
      <label
        className={`flex items-center justify-center ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        title={disabled ? reason : ""}
      >
        <input
          type="checkbox"
          checked={isSelected}
          disabled={disabled}
          onChange={() => onToggleSelection(member.fileId)}
          className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={disabled ? reason : `Pilih ${member.name}`}
        />
      </label>

      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius-sm] bg-panel-soft text-ink-soft">
          <FileIcon type={member.type} mimeType={member.mimeType} size={18} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{member.name}</p>
          <p className="truncate text-xs text-muted">{metaLine}</p>
          {disabled && (
            <p className="mt-0.5 text-[11px] font-medium text-warning-strong">{reason}</p>
          )}
        </div>
      </div>

      <span className="whitespace-nowrap text-sm text-ink-soft">
        {formatBytes(member.sizeBytes)}
      </span>

      <button
        type="button"
        onClick={() => openInProvider(member.webViewLink)}
        disabled={!member.webViewLink}
        className="inline-flex items-center gap-1 rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ArrowSquareOut size={13} weight="bold" />
        <span>Buka file</span>
      </button>
    </div>
  )
}
