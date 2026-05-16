import { useCallback, useEffect, useState } from "react"

import {
  batchDeleteFiles,
  listLargeStaleFiles,
  refreshLargeStale,
  type BatchDeleteResult,
  type LargeStaleFile,
  type LargeStaleSort,
  type LargeStaleTypeFilter,
} from "@/features/large_stale/api"
import type { LargeStaleThresholds } from "@/shared/api/mocks/largeStale"
import { getErrorMessage } from "@/shared/api/errors"

interface UseLargeStaleOptions {
  typeFilter: LargeStaleTypeFilter
  sortBy: LargeStaleSort
}

interface UseLargeStaleResult {
  files: LargeStaleFile[]
  total: number
  thresholds: LargeStaleThresholds | null
  snapshotAt: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  refresh: () => Promise<void>
  batchDelete: (fileIds: string[]) => Promise<BatchDeleteResult>
}

const INITIAL_THRESHOLDS: LargeStaleThresholds = {
  large_percent_of_quota: 0.5,
  stale_months: 12,
}

export function useLargeStale({
  typeFilter,
  sortBy,
}: UseLargeStaleOptions): UseLargeStaleResult {
  const [files, setFiles] = useState<LargeStaleFile[]>([])
  const [total, setTotal] = useState(0)
  const [thresholds, setThresholds] = useState<LargeStaleThresholds | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(
    async (type: LargeStaleTypeFilter, sort: LargeStaleSort) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listLargeStaleFiles({ type, sort })
        setFiles(result.files)
        setTotal(result.total)
        setThresholds(result.thresholds)
        setSnapshotAt(result.snapshotAt)
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
    listLargeStaleFiles({ type: typeFilter, sort: sortBy })
      .then((result) => {
        if (cancelled) return
        setFiles(result.files)
        setTotal(result.total)
        setThresholds(result.thresholds)
        setSnapshotAt(result.snapshotAt)
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
  }, [typeFilter, sortBy])

  const refetch = useCallback(
    () => fetchFiles(typeFilter, sortBy),
    [fetchFiles, typeFilter, sortBy],
  )

  // "Scan ulang" di UI: re-run on-demand query. Bukan async scan operation.
  const refresh = useCallback(async () => {
    await refreshLargeStale()
    await fetchFiles(typeFilter, sortBy)
  }, [fetchFiles, typeFilter, sortBy])

  const batchDelete = useCallback(
    async (fileIds: string[]): Promise<BatchDeleteResult> => {
      const result = await batchDeleteFiles(fileIds)
      await fetchFiles(typeFilter, sortBy)
      return result
    },
    [fetchFiles, typeFilter, sortBy],
  )

  return {
    files,
    total,
    thresholds: thresholds ?? INITIAL_THRESHOLDS,
    snapshotAt,
    isLoading,
    error,
    refetch,
    refresh,
    batchDelete,
  }
}
