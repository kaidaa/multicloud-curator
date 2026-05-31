import { ArrowsClockwise, CircleNotch, LockKey } from "@phosphor-icons/react"

import type { SecurityMode, SecurityProviderFilter } from "@/features/security/api"

interface SecurityToolbarProps {
  mode: SecurityMode
  onModeChange: (value: SecurityMode) => void
  providerFilter: SecurityProviderFilter
  onProviderFilterChange: (value: SecurityProviderFilter) => void
  isScanning: boolean
  scanLabel: string
  onScanClick: () => void
  selectedCount: number
  onRevokeClick: () => void
}

const MODE_OPTIONS: Array<{ value: SecurityMode; label: string }> = [
  { value: "sensitive", label: "File dengan keyword sensitif" },
  { value: "public", label: "Semua file publik" },
]

const PROVIDER_OPTIONS: Array<{ value: SecurityProviderFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "google", label: "Google Drive" },
  { value: "dropbox", label: "Dropbox" },
]

export function SecurityToolbar({
  mode,
  onModeChange,
  providerFilter,
  onProviderFilterChange,
  isScanning,
  scanLabel,
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
          className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-3.5 py-2 text-sm font-medium text-white transition hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isScanning ? (
            <CircleNotch size={15} className="animate-spin" weight="bold" />
          ) : (
            <ArrowsClockwise size={15} weight="bold" />
          )}
          <span>{scanLabel}</span>
        </button>

        <div className="flex flex-wrap items-center gap-1.5 rounded-[--radius-sm] border border-line bg-bg p-0.5">
          {MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={mode === opt.value}
              onClick={() => onModeChange(opt.value)}
              className={`rounded-[--radius-sm] px-2.5 py-1.5 text-xs font-medium transition ${
                mode === opt.value
                  ? "bg-primary-soft text-primary-strong"
                  : "text-muted hover:bg-panel-soft hover:text-ink-soft"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <span className="font-medium text-muted">Provider</span>
          <select
            value={providerFilter}
            onChange={(event) =>
              onProviderFilterChange(event.target.value as SecurityProviderFilter)
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
          className="inline-flex items-center gap-1.5 rounded-[--radius-sm] bg-danger px-3.5 py-2 text-sm font-medium text-white transition hover:bg-danger-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LockKey size={15} weight="bold" />
          <span>Cabut akses publik</span>
        </button>
      </div>
    </div>
  )
}
