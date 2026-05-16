import { ArrowsClockwise, CircleNotch, LockKey } from "@phosphor-icons/react"

import type { SecurityMode } from "@/features/security/api"
import { FilterChip } from "@/shared/components/FilterChip"

interface SecurityToolbarProps {
  mode: SecurityMode
  onModeChange: (value: SecurityMode) => void
  isScanning: boolean
  onScanClick: () => void
  selectedCount: number
  onRevokeClick: () => void
}

const MODE_OPTIONS: Array<{ value: SecurityMode; label: string }> = [
  { value: "sensitive", label: "Perlu ditinjau" },
  { value: "public", label: "Semua file publik" },
]

export function SecurityToolbar({
  mode,
  onModeChange,
  isScanning,
  onScanClick,
  selectedCount,
  onRevokeClick,
}: SecurityToolbarProps) {
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
          {MODE_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={mode === opt.value}
              onClick={() => onModeChange(opt.value)}
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
        </span>
        <button
          type="button"
          onClick={onRevokeClick}
          disabled={selectedCount === 0}
          className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LockKey size={14} weight="bold" />
          <span>Cabut akses publik</span>
        </button>
      </div>
    </div>
  )
}
