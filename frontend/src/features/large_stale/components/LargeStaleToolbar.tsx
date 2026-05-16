import { ArrowsClockwise, CircleNotch, Trash } from "@phosphor-icons/react"

import type {
  LargeStaleSort,
  LargeStaleTypeFilter,
} from "@/features/large_stale/api"
import { FilterChip } from "@/shared/components/FilterChip"
import { formatBytes } from "@/shared/utils/formatSize"

interface LargeStaleToolbarProps {
  typeFilter: LargeStaleTypeFilter
  onTypeFilterChange: (value: LargeStaleTypeFilter) => void
  sortBy: LargeStaleSort
  onSortChange: (value: LargeStaleSort) => void
  isRefreshing: boolean
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
  { value: "size_desc", label: "Ukuran (besar ke kecil)" },
  { value: "size_asc", label: "Ukuran (kecil ke besar)" },
  { value: "modified_asc", label: "Modifikasi terlama dulu" },
  { value: "modified_desc", label: "Modifikasi terbaru dulu" },
]

export function LargeStaleToolbar({
  typeFilter,
  onTypeFilterChange,
  sortBy,
  onSortChange,
  isRefreshing,
  onScanRefreshClick,
  selectedCount,
  selectedTotalSize,
  onDeleteClick,
}: LargeStaleToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={onScanRefreshClick}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isRefreshing ? (
            <CircleNotch size={14} className="animate-spin" weight="bold" />
          ) : (
            <ArrowsClockwise size={14} weight="bold" />
          )}
          <span>Scan ulang</span>
        </button>

        <div className="flex flex-wrap items-center gap-1.5">
          {TYPE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={typeFilter === opt.value}
              onClick={() => onTypeFilterChange(opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="font-medium uppercase tracking-[0.14em] text-muted-2">
            Urutkan
          </span>
          <select
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as LargeStaleSort)}
            className="rounded-[--radius-sm] border border-line bg-panel px-2.5 py-1.5 text-xs text-ink-soft transition hover:border-line-strong focus:border-line-strong focus:outline-none"
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
          className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash size={14} weight="bold" />
          <span>Hapus terpilih</span>
        </button>
      </div>
    </div>
  )
}
