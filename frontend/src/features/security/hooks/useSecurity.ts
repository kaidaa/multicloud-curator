import { useCallback, useEffect, useState } from "react"

import {
  batchRevokeFiles,
  listPublicFiles,
  scanSecurity,
  type BatchRevokeResult,
  type SecurityFile,
  type SecurityMode,
} from "@/features/security/api"
import { getErrorMessage } from "@/shared/api/errors"

interface UseSecurityOptions {
  mode: SecurityMode
}

interface UseSecurityResult {
  files: SecurityFile[]
  scanAt: string | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  scan: () => Promise<void>
  batchRevoke: (fileIds: string[]) => Promise<BatchRevokeResult>
}

export function useSecurity({ mode }: UseSecurityOptions): UseSecurityResult {
  const [files, setFiles] = useState<SecurityFile[]>([])
  const [scanAt, setScanAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async (currentMode: SecurityMode) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await listPublicFiles({ mode: currentMode })
      setFiles(result.files)
      setScanAt(result.scanAt)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    listPublicFiles({ mode })
      .then((result) => {
        if (cancelled) return
        setFiles(result.files)
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
  }, [mode])

  const refetch = useCallback(() => fetchFiles(mode), [fetchFiles, mode])

  const scan = useCallback(async () => {
    await scanSecurity()
    await fetchFiles(mode)
  }, [fetchFiles, mode])

  const batchRevoke = useCallback(
    async (fileIds: string[]): Promise<BatchRevokeResult> => {
      const result = await batchRevokeFiles(fileIds)
      await fetchFiles(mode)
      return result
    },
    [fetchFiles, mode],
  )

  return { files, scanAt, isLoading, error, refetch, scan, batchRevoke }
}
