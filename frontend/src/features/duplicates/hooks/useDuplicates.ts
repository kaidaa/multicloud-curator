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
  limit?: number
  offset?: number
}

interface UseDuplicatesResult {
  groups: DuplicateGroup[]
  total: number
  scanAt: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  scan: () => Promise<void>
  batchDelete: (ids: string[]) => Promise<BatchDeleteResult>
}

export function useDuplicates({
  typeFilter,
  limit = 50,
  offset = 0,
}: UseDuplicatesOptions): UseDuplicatesResult {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [scanAt, setScanAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchGroups = useCallback(
    async (filter: DuplicateTypeFilter, pageOffset: number) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listDuplicateGroups({
          type: filter,
          limit,
          offset: pageOffset,
        })
        setGroups(result.groups)
        setTotal(result.total)
        setScanAt(result.scanAt)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    },
    [limit],
  )

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listDuplicateGroups({ type: typeFilter, limit, offset })
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
  }, [typeFilter, limit, offset])

  const refetch = useCallback(
    () => fetchGroups(typeFilter, offset),
    [fetchGroups, typeFilter, offset],
  )

  const scan = useCallback(async () => {
    await scanDuplicates()
    await fetchGroups(typeFilter, offset)
  }, [fetchGroups, typeFilter, offset])

  const batchDelete = useCallback(
    async (ids: string[]): Promise<BatchDeleteResult> => {
      const result = await batchDeleteFiles(ids)
      await fetchGroups(typeFilter, offset)
      return result
    },
    [fetchGroups, typeFilter, offset],
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
