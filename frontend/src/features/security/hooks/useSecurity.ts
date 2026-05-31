import { useCallback, useEffect, useState } from "react"

import {
  batchRevokeFiles,
  listPublicFiles,
  scanSecurity,
  type BatchRevokeResult,
  type ListPublicFilesResult,
  type SecurityFile,
  type SecurityMode,
  type SecurityProviderFilter,
} from "@/features/security/api"
import type { ScanCoverage } from "@/shared/api/coverage"
import { getErrorMessage } from "@/shared/api/errors"

interface UseSecurityOptions {
  mode: SecurityMode
  providerFilter: SecurityProviderFilter
  enabled?: boolean
}

interface UseSecurityResult {
  files: SecurityFile[]
  scanAt: string | null
  coverage: ScanCoverage | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  scan: () => Promise<ListPublicFilesResult | null>
  batchRevoke: (ids: string[]) => Promise<BatchRevokeResult>
}

export function useSecurity({
  mode,
  providerFilter,
  enabled = true,
}: UseSecurityOptions): UseSecurityResult {
  const [files, setFiles] = useState<SecurityFile[]>([])
  const [scanAt, setScanAt] = useState<string | null>(null)
  const [coverage, setCoverage] = useState<ScanCoverage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applyResult = useCallback((result: ListPublicFilesResult) => {
    setFiles(result.files)
    setScanAt(result.scanAt)
    setCoverage(result.coverage)
  }, [])

  const fetchFiles = useCallback(
    async (currentMode: SecurityMode): Promise<ListPublicFilesResult | null> => {
      setIsLoading(true)
      setError(null)
      try {
        const result = await listPublicFiles({
          mode: currentMode,
          provider: providerFilter,
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
    [applyResult, providerFilter],
  )

  useEffect(() => {
    if (!enabled) {
      setFiles([])
      setScanAt(null)
      setCoverage(null)
      setError(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listPublicFiles({ mode, provider: providerFilter })
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
  }, [applyResult, enabled, mode, providerFilter])

  const refetch = useCallback(async () => {
    await fetchFiles(mode)
  }, [fetchFiles, mode])

  const scan = useCallback(async (): Promise<ListPublicFilesResult | null> => {
    await scanSecurity()
    return fetchFiles(mode)
  }, [fetchFiles, mode])

  const batchRevoke = useCallback(
    async (ids: string[]): Promise<BatchRevokeResult> => {
      const result = await batchRevokeFiles(ids)
      await fetchFiles(mode)
      return result
    },
    [fetchFiles, mode],
  )

  return { files, scanAt, coverage, isLoading, error, refetch, scan, batchRevoke }
}
