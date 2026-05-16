import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { SecurityMode } from "@/features/security/api"

interface SecurityUiStateValue {
  mode: SecurityMode
  setMode: (value: SecurityMode) => void
  selectedFileIds: ReadonlySet<string>
  toggleSelection: (fileId: string) => void
  clearSelection: () => void
  removeFromSelection: (fileIds: string[]) => void
}

const SecurityUiStateContext = createContext<SecurityUiStateValue | undefined>(
  undefined,
)

// Provider mount di AppLayout supaya mode + selection survive route change
// (FPS §4.1). State fetch (files, scanAt, isLoading) tetap lokal di
// SecurityPage — re-fetch otomatis saat page mount lagi.
export function SecurityUiStateProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SecurityMode>("sensitive")
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())

  const toggleSelection = useCallback((fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev)
      if (next.has(fileId)) next.delete(fileId)
      else next.add(fileId)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFileIds(new Set())
  }, [])

  const removeFromSelection = useCallback((fileIds: string[]) => {
    if (fileIds.length === 0) return
    setSelectedFileIds((prev) => {
      const next = new Set(prev)
      for (const id of fileIds) next.delete(id)
      return next
    })
  }, [])

  const value = useMemo<SecurityUiStateValue>(
    () => ({
      mode,
      setMode,
      selectedFileIds,
      toggleSelection,
      clearSelection,
      removeFromSelection,
    }),
    [mode, selectedFileIds, toggleSelection, clearSelection, removeFromSelection],
  )

  return (
    <SecurityUiStateContext.Provider value={value}>
      {children}
    </SecurityUiStateContext.Provider>
  )
}

export function useSecurityUiState() {
  const ctx = useContext(SecurityUiStateContext)
  if (!ctx) {
    throw new Error(
      "useSecurityUiState harus dipanggil di dalam <SecurityUiStateProvider>",
    )
  }
  return ctx
}
