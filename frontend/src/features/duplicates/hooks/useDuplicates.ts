import { useCallback, useEffect, useState } from "react"

import {
  batchDeleteFiles,
  listDuplicateGroups,
  scanDuplicates,
  type BatchDeleteResult,
  type DuplicateGroup,
  type DuplicateProviderFilter,
  type DuplicateTypeFilter,
  type ListDuplicateGroupsResult,
} from "@/features/duplicates/api"
import type { ScanCoverage } from "@/shared/api/coverage"
import { getErrorMessage } from "@/shared/api/errors"

interface UseDuplicatesOptions {
  typeFilter: DuplicateTypeFilter
  providerFilter: DuplicateProviderFilter
  limit?: number
  offset?: number
  enabled?: boolean
}

interface UseDuplicatesResult {
  groups: DuplicateGroup[]
  total: number
  scanAt: string | null
  coverage: ScanCoverage | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  scan: () => Promise<ListDuplicateGroupsResult | null>
  batchDelete: (ids: string[]) => Promise<BatchDeleteResult>
}

export function useDuplicates({
  typeFilter,
  providerFilter,
  limit = 50,
  offset = 0,
  enabled = true,
}: UseDuplicatesOptions): UseDuplicatesResult {
  const [groups, setGroups] = useState<DuplicateGroup[]>([])
  const [total, setTotal] = useState(0)
  const [scanAt, setScanAt] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<ScanCoverage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyResult = useCallback((result: ListDuplicateGroupsResult) => {
    setGroups(result.groups)
    setTotal(result.total)
    setScanAt(result.scanAt)
    setCoverage(result.coverage)
  }, [])

  const fetchGroups = useCallback(
    async (
      filter: DuplicateTypeFilter,
      provider: DuplicateProviderFilter,
      pageOffset: number,
    ): Promise<ListDuplicateGroupsResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listDuplicateGroups({
          type: filter,
          provider,
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
    [applyResult, limit],
  )

  useEffect(() => {
    if (!enabled) {
      setGroups([])
      setTotal(0)
      setScanAt(null)
      setCoverage(null)
      setError(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listDuplicateGroups({ type: typeFilter, provider: providerFilter, limit, offset })
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
  }, [applyResult, enabled, typeFilter, providerFilter, limit, offset])

  const refetch = useCallback(async () => {
    await fetchGroups(typeFilter, providerFilter, offset)
  }, [fetchGroups, typeFilter, providerFilter, offset])

  const scan = useCallback(async (): Promise<ListDuplicateGroupsResult | null> => {
    await scanDuplicates()
    return fetchGroups(typeFilter, providerFilter, offset)
  }, [fetchGroups, typeFilter, providerFilter, offset])

  const batchDelete = useCallback(
    async (ids: string[]): Promise<BatchDeleteResult> => {
      const result = await batchDeleteFiles(ids)
      await fetchGroups(typeFilter, providerFilter, offset)
      return result
    },
    [fetchGroups, typeFilter, providerFilter, offset],
  )

  return {
    groups,
    total,
    scanAt,
    coverage,
    isLoading,
    error,
    refetch,
    scan,
    batchDelete,
  }
}
