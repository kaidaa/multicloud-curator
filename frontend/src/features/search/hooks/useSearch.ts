import { useEffect, useState } from "react"

import type { ActivityFile } from "@/features/explore/api"
import {
  MIN_SEARCH_QUERY_LENGTH,
  searchFiles,
  type SearchParams,
} from "@/features/search/api"
import { getErrorMessage } from "@/shared/api/errors"
import { useAccountsContext } from "@/shared/contexts/AccountsContext"
import { useDebouncedValue } from "@/shared/hooks/useDebouncedValue"

interface UseSearchResult {
  files: ActivityFile[]
  total: number
  snapshotAt: string | null
  isLoading: boolean
  error: string | null
  isBelowMinLength: boolean
}

const DEBOUNCE_MS = 300

export function useSearch(params: SearchParams): UseSearchResult {
  const { globalRefreshVersion } = useAccountsContext()
  const debouncedQuery = useDebouncedValue(params.query, DEBOUNCE_MS)

  const [files, setFiles] = useState<ActivityFile[]>([])
  const [total, setTotal] = useState(0)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = debouncedQuery.trim()
  const isBelowMinLength = trimmed.length < MIN_SEARCH_QUERY_LENGTH

  function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === "AbortError"
  }

  useEffect(() => {
    if (isBelowMinLength) {
      setFiles([])
      setTotal(0)
      setIsLoading(false)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    searchFiles({ ...params, query: trimmed }, { signal: controller.signal })
      .then((result) => {
        setFiles(result.files)
        setTotal(result.total)
        setSnapshotAt(result.snapshotAt)
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setError(getErrorMessage(err))
        setFiles([])
        setTotal(0)
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nilai dependent
    // sengaja di-spread supaya filter berubah trigger fetch ulang. params.query
    // diganti dengan debouncedQuery via `trimmed`.
  }, [
    trimmed,
    isBelowMinLength,
    params.ownedOnly,
    params.provider,
    params.fileType,
    params.sort,
    params.limit,
    params.offset,
    globalRefreshVersion,
  ])

  return { files, total, snapshotAt, isLoading, error, isBelowMinLength }
}
