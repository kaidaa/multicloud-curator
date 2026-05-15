import type { ReactNode } from "react"

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-[--radius] border border-line bg-panel px-8 py-12 text-center shadow-soft">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-panel-soft text-muted">
        {icon}
      </div>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">{description}</p>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  )
}
