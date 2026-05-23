import { useCallback, useEffect, useState } from "react"

import {
  batchDeleteFiles,
  listLargeStaleFiles,
  scanLargeStaleFiles,
  type BatchDeleteResult,
  type LargeStaleFile,
  type LargeStaleSort,
  type LargeStaleThresholds,
  type LargeStaleTypeFilter,
  type ListLargeStaleResult,
} from "@/features/large_stale/api"
import type { ScanCoverage } from "@/shared/api/coverage"
import { getErrorMessage } from "@/shared/api/errors"

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
  coverage: ScanCoverage | null
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
        applyResult(result)
      } catch (err) {
        setError(getErrorMessage(err))
      } finally {
        setIsLoading(false)
      }
    },
    [applyResult, limit],
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
    listLargeStaleFiles({ type: typeFilter, sort: sortBy, limit, offset })
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
  }, [applyResult, enabled, typeFilter, sortBy, limit, offset])

  const refetch = useCallback(
    () => fetchFiles(typeFilter, sortBy, offset),
    [fetchFiles, typeFilter, sortBy, offset],
  )

  // "Scan ulang" menulis ulang hasil Large-Stale tersimpan, lalu membaca snapshot terbaru.
  const refresh = useCallback(async () => {
    await scanLargeStaleFiles()
    await fetchFiles(typeFilter, sortBy, offset)
  }, [fetchFiles, typeFilter, sortBy, offset])

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
    coverage,
    isLoading,
    error,
    refetch,
    refresh,
    batchDelete,
  }
}
