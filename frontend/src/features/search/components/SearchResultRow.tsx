import { getProviderLabel } from "@/features/accounts/components/ProviderLogo"
import type { ActivityFile } from "@/features/explore/api"
import { FileIcon } from "@/shared/components/FileIcon"
import { formatFileLocation } from "@/shared/files/location"
import {
  OPEN_FILE_UNAVAILABLE_MESSAGE,
  openInProvider,
} from "@/shared/files/openFile"
import { formatRelativeTime } from "@/shared/utils/formatTime"

interface SearchResultRowProps {
  file: ActivityFile
}

export function SearchResultRow({ file }: SearchResultRowProps) {
  const providerLabel = getProviderLabel(file.provider)
  const locationLabel = formatFileLocation(file.path, file.locationType)
  const metaLine = [file.accountEmail, providerLabel, locationLabel]
    .filter(Boolean)
    .join(" - ")
  const openLabel = file.openUrl
    ? `Buka ${file.name}`
    : `${file.name}: ${OPEN_FILE_UNAVAILABLE_MESSAGE}`

  return (
    <button
      type="button"
      onClick={() => openInProvider(file.openUrl)}
      disabled={!file.openUrl}
      title={!file.openUrl ? OPEN_FILE_UNAVAILABLE_MESSAGE : undefined}
      aria-label={openLabel}
      className="flex w-full items-center gap-3 rounded-[--radius-sm] border border-line bg-panel px-3 py-2.5 text-left transition hover:border-line-strong hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius-sm] bg-panel-soft text-ink-soft">
        <FileIcon type={file.type} mimeType={file.mimeType} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{file.name}</p>
        <p className="truncate text-xs text-muted">{metaLine}</p>
      </div>
      <span className="flex-shrink-0 text-xs text-muted-2">
        {formatRelativeTime(file.modifiedAt)}
      </span>
    </button>
  )
}
