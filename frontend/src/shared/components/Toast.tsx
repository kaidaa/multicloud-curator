import { createPortal } from "react-dom"
import { CheckCircle, Info, WarningCircle, X } from "@phosphor-icons/react"
import { useToast, type ToastVariant } from "@/shared/hooks/useToast"

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-success-strong/30 bg-success-soft text-success-strong",
  error: "border-danger-strong/30 bg-danger-soft text-danger-strong",
  info: "border-line-strong bg-panel text-ink-soft",
}

function ToastIcon({ variant }: { variant: ToastVariant }) {
  if (variant === "success") return <CheckCircle size={20} weight="fill" />
  if (variant === "error") return <WarningCircle size={20} weight="fill" />
  return <Info size={20} weight="fill" />
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return createPortal(
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-3 rounded-[--radius-sm] border px-4 py-3 shadow-soft ${VARIANT_CLASSES[toast.variant]}`}
        >
          <ToastIcon variant={toast.variant} />
          <p className="flex-1 text-sm leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Tutup notifikasi"
            className="rounded-sm p-0.5 opacity-70 transition hover:bg-black/5 hover:opacity-100"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      ))}
    </div>,
    document.body,
  )
}
