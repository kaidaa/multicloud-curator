import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { SecurityMode, SecurityProviderFilter } from "@/features/security/api"

interface SecurityUiStateValue {
  mode: SecurityMode
  setMode: (value: SecurityMode) => void
  providerFilter: SecurityProviderFilter
  setProviderFilter: (value: SecurityProviderFilter) => void
  selectedFileIds: ReadonlySet<string>
  hasRequestedScan: boolean
  markScanRequested: () => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  removeFromSelection: (ids: string[]) => void
}

const SecurityUiStateContext = createContext<SecurityUiStateValue | undefined>(
  undefined,
)

// AppLayout owns UI state; page data stays local and refetches on remount.
export function SecurityUiStateProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SecurityMode>("sensitive")
  const [providerFilter, setProviderFilter] = useState<SecurityProviderFilter>("all")
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [hasRequestedScan, setHasRequestedScan] = useState(false)

  const markScanRequested = useCallback(() => {
    setHasRequestedScan(true)
  }, [])

  const toggleSelection = useCallback((id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedFileIds(new Set())
  }, [])

  const removeFromSelection = useCallback((ids: string[]) => {
    if (ids.length === 0) return
    setSelectedFileIds((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [])

  const value = useMemo<SecurityUiStateValue>(
    () => ({
      mode,
      setMode,
      providerFilter,
      setProviderFilter,
      selectedFileIds,
      hasRequestedScan,
      markScanRequested,
      toggleSelection,
      clearSelection,
      removeFromSelection,
    }),
    [
      mode,
      providerFilter,
      selectedFileIds,
      hasRequestedScan,
      markScanRequested,
      toggleSelection,
      clearSelection,
      removeFromSelection,
    ],
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
