import { useEffect, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { X } from "@phosphor-icons/react"

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  // Modal destructive (konfirmasi delete/disconnect) pakai size sm,
  // modal informasi (provider chooser) pakai size md.
  size?: "sm" | "md"
  // Saat busy (mid-async action), backdrop click dan tombol close di-disable
  // supaya user tidak menutup modal di tengah operasi yang sedang berjalan.
  busy?: boolean
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  busy = false,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose()
    }
    window.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [open, busy, onClose])

  if (!open) return null

  const widthClass = size === "sm" ? "max-w-md" : "max-w-xl"

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 py-8 backdrop-blur-sm"
      onClick={() => {
        if (!busy) onClose()
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`w-full ${widthClass} rounded-[--radius] border border-line bg-panel shadow-soft`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="space-y-1">
            <h2 id="modal-title" className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Tutup"
            className="rounded-sm p-1.5 text-muted transition hover:bg-panel-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} weight="bold" />
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-3 border-t border-line bg-panel-soft/40 px-6 py-4">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
