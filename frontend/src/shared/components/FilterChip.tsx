import type { ReactNode } from "react"

interface FilterChipProps {
  active: boolean
  onClick: () => void
  children: ReactNode
  disabled?: boolean
}

// Pill button untuk filter group. Inactive = panel-soft + ink-soft;
// Active = primary-soft + primary-strong dengan border yang lebih tegas.
export function FilterChip({ active, onClick, children, disabled = false }: FilterChipProps) {
  const baseClass =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
  const stateClass = active
    ? "border-primary-strong/30 bg-primary-soft text-primary-strong"
    : "border-line bg-panel-soft text-ink-soft hover:border-line-strong hover:bg-panel-strong/40"

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClass} ${stateClass}`}
    >
      {children}
    </button>
  )
}
