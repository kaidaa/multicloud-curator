import type { ReactNode } from "react"

export type BadgeVariant = "success" | "warning" | "danger" | "neutral"

interface StatusBadgeProps {
  variant: BadgeVariant
  children: ReactNode
  icon?: ReactNode
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  danger: "bg-danger-soft text-danger-strong",
  neutral: "bg-panel-soft text-ink-soft",
}

export function StatusBadge({ variant, children, icon }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {icon}
      {children}
    </span>
  )
}
