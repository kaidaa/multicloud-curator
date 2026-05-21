import { ArrowSquareOut } from "@phosphor-icons/react"

import type { ActivityFile } from "@/features/explore/api"
import { getProviderLabel } from "@/features/accounts/components/ProviderLogo"
import { FileIcon } from "@/shared/components/FileIcon"
import { formatRelativeTime } from "@/shared/utils/formatTime"

interface ActivityRowProps {
  file: ActivityFile
}

// "Buka" membuka link provider di tab baru jika backend menyediakan link.
function openInProvider(href: string | null) {
  if (!href) return
  window.open(href, "_blank", "noopener,noreferrer")
}

export function ActivityRow({ file }: ActivityRowProps) {
  const providerLabel = getProviderLabel(file.provider)
  return (
    <tr className="border-b border-line transition last:border-b-0 hover:bg-panel-soft/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius-sm] bg-panel-soft text-ink-soft">
            <FileIcon type={file.type} mimeType={file.mimeType} size={18} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{file.name}</p>
            <p className="truncate text-xs text-muted">{file.path ?? "-"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-ink-soft">
        <p className="truncate">{file.accountEmail}</p>
        <p className="text-xs text-muted">{providerLabel}</p>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-sm text-ink-soft">
        {formatRelativeTime(file.modifiedAt)}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => openInProvider(file.webViewLink)}
            disabled={!file.webViewLink}
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
