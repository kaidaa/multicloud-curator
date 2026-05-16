import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  LargeStaleSort,
  LargeStaleTypeFilter,
} from "@/features/large_stale/api"

interface LargeStaleUiStateValue {
  typeFilter: LargeStaleTypeFilter
  setTypeFilter: (value: LargeStaleTypeFilter) => void
  sortBy: LargeStaleSort
  setSortBy: (value: LargeStaleSort) => void
  selectedFileIds: ReadonlySet<string>
  toggleSelection: (fileId: string) => void
  clearSelection: () => void
  removeFromSelection: (fileIds: string[]) => void
}

const LargeStaleUiStateContext = createContext<LargeStaleUiStateValue | undefined>(
  undefined,
)

// Provider mount di AppLayout supaya filter / sort / selection survive
// route change (FPS §4.1). State data fetch (files, thresholds, snapshot)
// tetap lokal di LargeStalePage — re-fetch otomatis saat page mount lagi.
export function LargeStaleUiStateProvider({ children }: { children: ReactNode }) {
  const [typeFilter, setTypeFilter] = useState<LargeStaleTypeFilter>("all")
  const [sortBy, setSortBy] = useState<LargeStaleSort>("size_desc")
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

  const value = useMemo<LargeStaleUiStateValue>(
    () => ({
      typeFilter,
      setTypeFilter,
      sortBy,
      setSortBy,
      selectedFileIds,
      toggleSelection,
      clearSelection,
      removeFromSelection,
    }),
    [
      typeFilter,
      sortBy,
      selectedFileIds,
      toggleSelection,
      clearSelection,
      removeFromSelection,
    ],
  )

  return (
    <LargeStaleUiStateContext.Provider value={value}>
      {children}
    </LargeStaleUiStateContext.Provider>
  )
}

export function useLargeStaleUiState() {
  const ctx = useContext(LargeStaleUiStateContext)
  if (!ctx) {
    throw new Error(
      "useLargeStaleUiState harus dipanggil di dalam <LargeStaleUiStateProvider>",
    )
  }
  return ctx
}
