import { ArrowsClockwise, CircleNotch, Trash } from "@phosphor-icons/react"

import type {
  DuplicateProviderFilter,
  DuplicateTypeFilter,
} from "@/features/duplicates/api"
import { formatBytes } from "@/shared/utils/formatSize"

interface DuplicatesToolbarProps {
  typeFilter: DuplicateTypeFilter
  onTypeFilterChange: (value: DuplicateTypeFilter) => void
  providerFilter: DuplicateProviderFilter
  onProviderFilterChange: (value: DuplicateProviderFilter) => void
  isScanning: boolean
  scanLabel: string
  onScanClick: () => void
  selectedCount: number
  selectedTotalSize: number
  onDeleteClick: () => void
}

const TYPE_OPTIONS: Array<{ value: DuplicateTypeFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "photo", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "document", label: "Dokumen" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Lainnya" },
]

const PROVIDER_OPTIONS: Array<{ value: DuplicateProviderFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "google", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
]

export function DuplicatesToolbar({
  typeFilter,
  onTypeFilterChange,
  providerFilter,
  onProviderFilterChange,
  isScanning,
  scanLabel,
  onScanClick,
  selectedCount,
  selectedTotalSize,
  onDeleteClick,
}: DuplicatesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onScanClick}
          disabled={isScanning}
          className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isScanning ? (
            <CircleNotch size={15} className="animate-spin" weight="bold" />
          ) : (
            <ArrowsClockwise size={15} weight="bold" />
          )}
          <span>{scanLabel}</span>
        </button>

        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-muted">Provider</span>
          <select
            value={providerFilter}
            onChange={(event) =>
              onProviderFilterChange(event.target.value as DuplicateProviderFilter)
            }
            className="rounded-[--radius-sm] border border-line bg-bg px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
          >
            {PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-muted">Tipe file</span>
          <select
            value={typeFilter}
            onChange={(event) =>
              onTypeFilterChange(event.target.value as DuplicateTypeFilter)
            }
            className="rounded-[--radius-sm] border border-line bg-bg px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`text-xs ${
            selectedCount > 0 ? "text-ink-soft" : "text-muted-2"
          }`}
        >
          <strong className="font-semibold">{selectedCount}</strong> dipilih
          {selectedCount > 0 && ` · ${formatBytes(selectedTotalSize)}`}
        </span>
        <button
          type="button"
          onClick={onDeleteClick}
          disabled={selectedCount === 0}
          className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-danger px-3.5 py-2 text-sm font-medium text-white transition hover:bg-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash size={15} weight="bold" />
          <span>Hapus terpilih</span>
        </button>
      </div>
    </div>
  )
}
