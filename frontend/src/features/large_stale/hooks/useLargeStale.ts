import { useCallback, useEffect, useState } from "react"

import {
  batchDeleteFiles,
  listLargeStaleFiles,
  scanLargeStaleFiles,
  type BatchDeleteResult,
  type LargeStaleCategoryFilter,
  type LargeStaleFile,
  type LargeStaleProviderFilter,
  type LargeStaleSort,
  type LargeStaleThresholds,
  type LargeStaleTypeFilter,
  type ListLargeStaleResult,
} from "@/features/large_stale/api"
import type { ScanCoverage } from "@/shared/api/coverage"
import { getErrorMessage } from "@/shared/api/errors"

interface UseLargeStaleOptions {
  typeFilter: LargeStaleTypeFilter
  providerFilter: LargeStaleProviderFilter
  categoryFilter: LargeStaleCategoryFilter
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
  coverage: ScanCoverage | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  refresh: () => Promise<ListLargeStaleResult | null>
  batchDelete: (ids: string[]) => Promise<BatchDeleteResult>
}

const INITIAL_THRESHOLDS: LargeStaleThresholds = {
  large_percent_of_quota: 0.5,
  stale_months: 12,
}

export function useLargeStale({
  typeFilter,
  providerFilter,
  categoryFilter,
  sortBy,
  limit = 50,
  offset = 0,
  enabled = true,
}: UseLargeStaleOptions): UseLargeStaleResult {
  const [files, setFiles] = useState<LargeStaleFile[]>([])
  const [total, setTotal] = useState(0)
  const [thresholds, setThresholds] = useState<LargeStaleThresholds | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<ScanCoverage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyResult = useCallback((result: ListLargeStaleResult) => {
    setFiles(result.files)
    setTotal(result.total)
    setThresholds(result.thresholds)
    setSnapshotAt(result.snapshotAt)
    setCoverage(result.coverage)
  }, [])

  const fetchFiles = useCallback(
    async (
      type: LargeStaleTypeFilter,
      category: LargeStaleCategoryFilter,
      sort: LargeStaleSort,
      pageOffset: number,
    ): Promise<ListLargeStaleResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listLargeStaleFiles({
          type,
          provider: providerFilter,
          category,
          sort,
          limit,
          offset: pageOffset,
        })
        applyResult(result)
        return result
      } catch (err) {
        setError(getErrorMessage(err))
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [applyResult, limit, providerFilter],
  )

  useEffect(() => {
    if (!enabled) {
      setFiles([])
      setTotal(0)
      setThresholds(null)
      setSnapshotAt(null)
      setCoverage(null)
      setError(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listLargeStaleFiles({
      type: typeFilter,
      provider: providerFilter,
      category: categoryFilter,
      sort: sortBy,
      limit,
      offset,
    })
      .then((result) => {
        if (cancelled) return
        applyResult(result)
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
  }, [applyResult, enabled, typeFilter, providerFilter, categoryFilter, sortBy, limit, offset])

  const refetch = useCallback(async () => {
    await fetchFiles(typeFilter, categoryFilter, sortBy, offset)
  }, [fetchFiles, typeFilter, categoryFilter, sortBy, offset])

  // Rescan overwrites stored results, then reads the latest snapshot.
  const refresh = useCallback(async (): Promise<ListLargeStaleResult | null> => {
    await scanLargeStaleFiles()
    return fetchFiles(typeFilter, categoryFilter, sortBy, offset)
  }, [fetchFiles, typeFilter, categoryFilter, sortBy, offset])

  const batchDelete = useCallback(
    async (ids: string[]): Promise<BatchDeleteResult> => {
      const result = await batchDeleteFiles(ids)
      await fetchFiles(typeFilter, categoryFilter, sortBy, offset)
      return result
    },
    [fetchFiles, typeFilter, categoryFilter, sortBy, offset],
  )

  return {
    files,
    total,
    thresholds: thresholds ?? INITIAL_THRESHOLDS,
    snapshotAt,
    coverage,
    isLoading,
    error,
    refetch,
    refresh,
    batchDelete,
  }
}
