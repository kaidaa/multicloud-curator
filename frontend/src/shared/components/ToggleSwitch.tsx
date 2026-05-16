interface ToggleSwitchProps {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  "aria-label"?: string
}

// Toggle switch ringan untuk pengaturan boolean. Pill rounded + knob putih
// dengan transisi. Pakai token primary untuk on state, line-strong saat off.
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-line-strong/40"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-soft transition-transform duration-150 ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
        aria-hidden
      />
    </button>
  )
}
