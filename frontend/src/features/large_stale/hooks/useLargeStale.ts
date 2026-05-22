import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  batchDeleteFiles,
  listLargeStaleFiles,
  type BatchDeleteResult,
  type LargeStaleFile,
  type LargeStaleSort,
  type LargeStaleThresholds,
  type LargeStaleTypeFilter,
} from "@/features/large_stale/api"
import { getErrorMessage } from "@/shared/api/errors"
import { useAccountsContext } from "@/shared/contexts/AccountsContext"

interface UseLargeStaleOptions {
  typeFilter: LargeStaleTypeFilter
  sortBy: LargeStaleSort
  limit?: number
  offset?: number
  enabled?: boolean
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
  batchDelete: (ids: string[]) => Promise<BatchDeleteResult>
}

const INITIAL_THRESHOLDS: LargeStaleThresholds = {
  large_percent_of_quota: 0.5,
  stale_months: 12,
}

export function useLargeStale({
  typeFilter,
  sortBy,
  limit = 50,
  offset = 0,
  enabled = true,
}: UseLargeStaleOptions): UseLargeStaleResult {
  const { globalRefreshVersion } = useAccountsContext()
  const lastManualFetchKeyRef = useRef<string | null>(null)
  const [files, setFiles] = useState<LargeStaleFile[]>([])
  const [total, setTotal] = useState(0)
  const [thresholds, setThresholds] = useState<LargeStaleThresholds | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(
    async (type: LargeStaleTypeFilter, sort: LargeStaleSort, pageOffset: number) => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listLargeStaleFiles({
          type,
          sort,
          limit,
          offset: pageOffset,
        })
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
    [limit],
  )

  const requestKey = useMemo(
    () => `${typeFilter}|${sortBy}|${limit}|${offset}|${globalRefreshVersion}`,
    [typeFilter, sortBy, limit, offset, globalRefreshVersion],
  )

  useEffect(() => {
    if (!enabled) {
      setFiles([])
      setTotal(0)
      setThresholds(null)
      setSnapshotAt(null)
      setError(null)
      setIsLoading(false)
      return
    }
    if (lastManualFetchKeyRef.current === requestKey) {
      lastManualFetchKeyRef.current = null
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listLargeStaleFiles({ type: typeFilter, sort: sortBy, limit, offset })
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
  }, [enabled, requestKey, typeFilter, sortBy, limit, offset])

  const refetch = useCallback(
    () => fetchFiles(typeFilter, sortBy, offset),
    [fetchFiles, typeFilter, sortBy, offset],
  )

  // "Scan ulang" di UI: re-run on-demand query. Bukan async scan operation.
  const refresh = useCallback(async () => {
    await fetchFiles(typeFilter, sortBy, offset)
    lastManualFetchKeyRef.current = requestKey
  }, [fetchFiles, typeFilter, sortBy, offset, requestKey])

  const batchDelete = useCallback(
    async (ids: string[]): Promise<BatchDeleteResult> => {
      const result = await batchDeleteFiles(ids)
      await fetchFiles(typeFilter, sortBy, offset)
      return result
    },
    [fetchFiles, typeFilter, sortBy, offset],
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
