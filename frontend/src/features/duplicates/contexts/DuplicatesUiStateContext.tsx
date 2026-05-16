import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { DuplicateTypeFilter } from "@/features/duplicates/api"

interface DuplicatesUiStateValue {
  typeFilter: DuplicateTypeFilter
  setTypeFilter: (value: DuplicateTypeFilter) => void
  selectedFileIds: ReadonlySet<string>
  toggleSelection: (fileId: string) => void
  clearSelection: () => void
  removeFromSelection: (fileIds: string[]) => void
  openGroupIds: ReadonlySet<string>
  toggleOpenGroup: (groupId: string) => void
  resetOpenGroups: () => void
}

const DuplicatesUiStateContext = createContext<DuplicatesUiStateValue | undefined>(
  undefined,
)

// Provider mounted di AppLayout supaya selection / open accordion / type
// filter survive route change (FPS §4.1: state pengelolaan persist saat
// user pindah halaman dan kembali).
export function DuplicatesUiStateProvider({ children }: { children: ReactNode }) {
  const [typeFilter, setTypeFilter] = useState<DuplicateTypeFilter>("all")
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set())
  const [openGroupIds, setOpenGroupIds] = useState<Set<string>>(new Set())

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
      selectedFileIds,
      toggleSelection,
      clearSelection,
      removeFromSelection,
      openGroupIds,
      toggleOpenGroup,
      resetOpenGroups,
    }),
    [
      typeFilter,
      selectedFileIds,
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
