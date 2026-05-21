import { getProviderLabel } from "@/features/accounts/components/ProviderLogo"
import type { ActivityFile } from "@/features/explore/api"
import { FileIcon } from "@/shared/components/FileIcon"
import { formatRelativeTime } from "@/shared/utils/formatTime"

interface SearchResultRowProps {
  file: ActivityFile
}

function openInProvider(href: string | null) {
  if (!href) return
  window.open(href, "_blank", "noopener,noreferrer")
}

export function SearchResultRow({ file }: SearchResultRowProps) {
  const providerLabel = getProviderLabel(file.provider)
  return (
    <button
      type="button"
      onClick={() => openInProvider(file.webViewLink)}
      disabled={!file.webViewLink}
      className="flex w-full items-center gap-3 rounded-[--radius-sm] border border-line bg-panel px-3 py-2.5 text-left transition hover:border-line-strong hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius-sm] bg-panel-soft text-ink-soft">
        <FileIcon type={file.type} mimeType={file.mimeType} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{file.name}</p>
        <p className="truncate text-xs text-muted">
          {file.accountEmail} - {providerLabel}
          {file.path ? ` - ${file.path}` : " -"}
        </p>
      </div>
      <span className="flex-shrink-0 text-xs text-muted-2">
        {formatRelativeTime(file.modifiedAt)}
      </span>
    </button>
  )
}
