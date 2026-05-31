import { ArrowsClockwise, CircleNotch, Trash } from "@phosphor-icons/react"

import type {
  LargeStaleCategoryFilter,
  LargeStaleProviderFilter,
  LargeStaleSort,
  LargeStaleTypeFilter,
} from "@/features/large_stale/api"
import { formatBytes } from "@/shared/utils/formatSize"

interface LargeStaleToolbarProps {
  typeFilter: LargeStaleTypeFilter
  onTypeFilterChange: (value: LargeStaleTypeFilter) => void
  providerFilter: LargeStaleProviderFilter
  onProviderFilterChange: (value: LargeStaleProviderFilter) => void
  categoryFilter: LargeStaleCategoryFilter
  onCategoryFilterChange: (value: LargeStaleCategoryFilter) => void
  sortBy: LargeStaleSort
  onSortChange: (value: LargeStaleSort) => void
  isRefreshing: boolean
  scanLabel: string
  onScanRefreshClick: () => void
  selectedCount: number
  selectedTotalSize: number
  onDeleteClick: () => void
}

const TYPE_OPTIONS: Array<{ value: LargeStaleTypeFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "photo", label: "Foto" },
  { value: "video", label: "Video" },
  { value: "document", label: "Dokumen" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Lainnya" },
]

const SORT_OPTIONS: Array<{ value: LargeStaleSort; label: string }> = [
  { value: "size_desc", label: "Ukuran terbesar" },
  { value: "size_asc", label: "Ukuran terkecil" },
  { value: "modified_asc", label: "Modifikasi terlama" },
  { value: "modified_desc", label: "Modifikasi terbaru" },
]

const PROVIDER_OPTIONS: Array<{ value: LargeStaleProviderFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "google", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
]

const CATEGORY_OPTIONS: Array<{ value: LargeStaleCategoryFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "large", label: "File besar" },
  { value: "stale", label: "Usang" },
]

export function LargeStaleToolbar({
  typeFilter,
  onTypeFilterChange,
  providerFilter,
  onProviderFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortChange,
  isRefreshing,
  scanLabel,
  onScanRefreshClick,
  selectedCount,
  selectedTotalSize,
  onDeleteClick,
}: LargeStaleToolbarProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onScanRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? (
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
              onProviderFilterChange(event.target.value as LargeStaleProviderFilter)
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
          <span className="font-medium text-muted">Kategori</span>
          <select
            value={categoryFilter}
            onChange={(event) =>
              onCategoryFilterChange(event.target.value as LargeStaleCategoryFilter)
            }
            className="rounded-[--radius-sm] border border-line bg-bg px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
          >
            {CATEGORY_OPTIONS.map((opt) => (
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
              onTypeFilterChange(event.target.value as LargeStaleTypeFilter)
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

        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-muted">Urutkan</span>
          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as LargeStaleSort)}
            className="rounded-[--radius-sm] border border-line bg-bg px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
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
