import { ArrowSquareOut } from "@phosphor-icons/react"

import { getProviderLabel } from "@/features/accounts/components/ProviderLogo"
import type { SecurityFile } from "@/features/security/api"
import { FileIcon } from "@/shared/components/FileIcon"
import { formatFileLocation } from "@/shared/files/location"
import {
  OPEN_FILE_UNAVAILABLE_MESSAGE,
  openInProvider,
} from "@/shared/files/openFile"
import { formatRelativeTime } from "@/shared/utils/formatTime"

interface SecurityRowProps {
  file: SecurityFile
  isSelected: boolean
  onToggleSelection: (id: string) => void
}

export function SecurityRow({ file, isSelected, onToggleSelection }: SecurityRowProps) {
  const disabled = !file.deletable
  const reason = file.deletableReason ?? ""
  const providerLabel = getProviderLabel(file.provider)
  const locationLabel = formatFileLocation(file.path, file.locationType)
  const openLabel = file.openUrl
    ? `Buka ${file.name}`
    : `${file.name}: ${OPEN_FILE_UNAVAILABLE_MESSAGE}`

  return (
    <tr
      className={`border-b border-line transition last:border-b-0 hover:bg-panel-soft/60 ${
        disabled ? "bg-warning-soft/30" : ""
      }`}
    >
      <td className="px-4 py-3 align-top">
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
            onChange={() => onToggleSelection(file.id)}
            className="h-4 w-4 accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={disabled ? reason : `Pilih ${file.name}`}
          />
        </label>
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius-sm] bg-panel-soft text-ink-soft">
            <FileIcon type={file.type} mimeType={file.mimeType} size={18} />
          </span>
          <p className="truncate text-sm font-medium text-ink">{file.name}</p>
        </div>
      </td>

      <td className="px-4 py-3 align-top text-sm">
        <p className="truncate text-ink-soft">
          {file.accountEmail} <span className="text-muted-2">·</span>{" "}
          <span className="text-muted">{providerLabel}</span>
        </p>
        <p className="truncate text-xs text-muted">{locationLabel}</p>
        {disabled && (
          <p className="mt-1 text-[11px] font-medium text-warning-strong">{reason}</p>
        )}
      </td>

      <td className="px-4 py-3 align-top">
        {file.matchedKeywords.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {file.matchedKeywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning-strong"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-2">—</span>
        )}
      </td>

      <td className="whitespace-nowrap px-4 py-3 align-top text-sm text-muted">
        {formatRelativeTime(file.modifiedAt)}
      </td>

      <td className="px-4 py-3 align-top">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => openInProvider(file.openUrl)}
            disabled={!file.openUrl}
            title={!file.openUrl ? OPEN_FILE_UNAVAILABLE_MESSAGE : undefined}
            aria-label={openLabel}
            className="inline-flex items-center gap-1 rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowSquareOut size={13} weight="bold" />
            <span>Buka</span>
          </button>
        </div>
      </td>
    </tr>
  )
}
