import { ArrowsClockwise, CircleNotch, Trash } from "@phosphor-icons/react"

import type { DuplicateTypeFilter } from "@/features/duplicates/api"
import { FilterChip } from "@/shared/components/FilterChip"
import { formatBytes } from "@/shared/utils/formatSize"

interface DuplicatesToolbarProps {
  typeFilter: DuplicateTypeFilter
  onTypeFilterChange: (value: DuplicateTypeFilter) => void
  isScanning: boolean
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

export function DuplicatesToolbar({
  typeFilter,
  onTypeFilterChange,
  isScanning,
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
          className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isScanning ? (
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
