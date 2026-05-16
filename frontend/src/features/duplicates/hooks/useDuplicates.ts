import { useCallback, useEffect, useState } from "react"

import {
  batchDeleteFiles,
  listDuplicateGroups,
  scanDuplicates,
  type BatchDeleteResult,
  type DuplicateGroup,
  type DuplicateTypeFilter,
} from "@/features/duplicates/api"
import { getErrorMessage } from "@/shared/api/errors"

interface UseDuplicatesOptions {
  typeFilter: DuplicateTypeFilter
}

interface UseDuplicatesResult {
  groups: DuplicateGroup[]
  total: number
  scanAt: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  scan: () => Promise<void>
  batchDelete: (fileIds: string[]) => Promise<BatchDeleteResult>
}

export function useDuplicates({ typeFilter }: UseDuplicatesOptions): UseDuplicatesResult {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [scanAt, setScanAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = useCallback(
    async (filter: DuplicateTypeFilter) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listDuplicateGroups({ type: filter })
        setGroups(result.groups)
        setTotal(result.total)
        setScanAt(result.scanAt)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listDuplicateGroups({ type: typeFilter })
      .then((result) => {
        if (cancelled) return
        setGroups(result.groups)
        setTotal(result.total)
        setScanAt(result.scanAt)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [typeFilter])

  const refetch = useCallback(() => fetchGroups(typeFilter), [fetchGroups, typeFilter])

  const scan = useCallback(async () => {
    await scanDuplicates()
    await fetchGroups(typeFilter)
  }, [fetchGroups, typeFilter])

  const batchDelete = useCallback(
    async (fileIds: string[]): Promise<BatchDeleteResult> => {
      const result = await batchDeleteFiles(fileIds)
      await fetchGroups(typeFilter)
      return result
    },
    [fetchGroups, typeFilter],
  )

  return {
    groups,
    total,
    scanAt,
    isLoading,
    error,
    refetch,
    scan,
    batchDelete,
  }
}
