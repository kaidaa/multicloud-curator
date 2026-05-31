import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type {
  DuplicateProviderFilter,
  DuplicateTypeFilter,
} from "@/features/duplicates/api"

interface DuplicatesUiStateValue {
  typeFilter: DuplicateTypeFilter
  setTypeFilter: (value: DuplicateTypeFilter) => void
  providerFilter: DuplicateProviderFilter
  setProviderFilter: (value: DuplicateProviderFilter) => void
  selectedFileIds: ReadonlySet<string>
  hasRequestedScan: boolean
  markScanRequested: () => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  removeFromSelection: (ids: string[]) => void
  openGroupIds: ReadonlySet<string>
  toggleOpenGroup: (groupId: string) => void
  resetOpenGroups: () => void
}

const DuplicatesUiStateContext = createContext<DuplicatesUiStateValue | undefined>(
  undefined,
)

// AppLayout owns this so filters, selection, and expanded groups survive route changes.
export function DuplicatesUiStateProvider({ children }: { children: ReactNode }) {
  const [typeFilter, setTypeFilter] = useState<DuplicateTypeFilter>("all")
  const [providerFilter, setProviderFilter] = useState<DuplicateProviderFilter>("all")
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set())
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

  const toggleOpenGroup = useCallback((groupId: string) => {
    setOpenGroupIds((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  const resetOpenGroups = useCallback(() => {
    setOpenGroupIds(new Set())
  }, [])

  const value = useMemo<DuplicatesUiStateValue>(
    () => ({
      typeFilter,
      setTypeFilter,
      providerFilter,
      setProviderFilter,
      selectedFileIds,
      hasRequestedScan,
      markScanRequested,
      toggleSelection,
      clearSelection,
      removeFromSelection,
      openGroupIds,
      toggleOpenGroup,
      resetOpenGroups,
    }),
    [
      typeFilter,
      providerFilter,
      selectedFileIds,
      hasRequestedScan,
      markScanRequested,
      toggleSelection,
      clearSelection,
      removeFromSelection,
      openGroupIds,
      toggleOpenGroup,
      resetOpenGroups,
    ],
  )

  return (
    <DuplicatesUiStateContext.Provider value={value}>
      {children}
    </DuplicatesUiStateContext.Provider>
  )
}

export function useDuplicatesUiState() {
  const ctx = useContext(DuplicatesUiStateContext)
  if (!ctx) {
    throw new Error(
      "useDuplicatesUiState harus dipanggil di dalam <DuplicatesUiStateProvider>",
    )
  }
  return ctx
}
