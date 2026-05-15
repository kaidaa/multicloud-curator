import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"

export type ToastVariant = "success" | "error" | "info"

export interface ToastItem {
  id: string
  variant: ToastVariant
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  pushToast: (message: string, variant?: ToastVariant) => void
  dismissToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const TOAST_TTL_MS = 3500

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismissToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`
      setToasts((prev) => [...prev, { id, variant, message }])
      const timer = setTimeout(() => dismissToast(id), TOAST_TTL_MS)
      timers.current.set(id, timer)
    },
    [dismissToast],
  )

  const value = useMemo<ToastContextValue>(
    () => ({ toasts, pushToast, dismissToast }),
    [toasts, pushToast, dismissToast],
  )

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast harus dipanggil di dalam <ToastProvider>")
  }
  return ctx
}
