import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  LargeStaleCategoryFilter,
  LargeStaleProviderFilter,
  LargeStaleSort,
  LargeStaleTypeFilter,
} from "@/features/large_stale/api"

interface LargeStaleUiStateValue {
  typeFilter: LargeStaleTypeFilter
  setTypeFilter: (value: LargeStaleTypeFilter) => void
  providerFilter: LargeStaleProviderFilter
  setProviderFilter: (value: LargeStaleProviderFilter) => void
  categoryFilter: LargeStaleCategoryFilter
  setCategoryFilter: (value: LargeStaleCategoryFilter) => void
  sortBy: LargeStaleSort
  setSortBy: (value: LargeStaleSort) => void
  selectedFileIds: ReadonlySet<string>
  hasRequestedScan: boolean
  markScanRequested: () => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  removeFromSelection: (ids: string[]) => void
}

const LargeStaleUiStateContext = createContext<LargeStaleUiStateValue | undefined>(
  undefined,
)

// AppLayout owns UI state; page data stays local and refetches on remount.
export function LargeStaleUiStateProvider({ children }: { children: ReactNode }) {
  const [typeFilter, setTypeFilter] = useState<LargeStaleTypeFilter>("all")
  const [providerFilter, setProviderFilter] = useState<LargeStaleProviderFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<LargeStaleCategoryFilter>("all")
  const [sortBy, setSortBy] = useState<LargeStaleSort>("size_desc")
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

  const value = useMemo<LargeStaleUiStateValue>(
    () => ({
      typeFilter,
      setTypeFilter,
      providerFilter,
      setProviderFilter,
      categoryFilter,
      setCategoryFilter,
      sortBy,
      setSortBy,
      selectedFileIds,
      hasRequestedScan,
      markScanRequested,
      toggleSelection,
      clearSelection,
      removeFromSelection,
    }),
    [
      typeFilter,
      providerFilter,
      categoryFilter,
      sortBy,
      selectedFileIds,
      hasRequestedScan,
      markScanRequested,
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
