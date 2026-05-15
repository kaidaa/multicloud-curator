import { useEffect, useState } from "react"

import type { ActivityFile } from "@/features/explore/api"
import {
  MIN_SEARCH_QUERY_LENGTH,
  searchFiles,
  type SearchParams,
} from "@/features/search/api"
import { getErrorMessage } from "@/shared/api/errors"
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
  const debouncedQuery = useDebouncedValue(params.query, DEBOUNCE_MS)

  const [files, setFiles] = useState<ActivityFile[]>([])
  const [total, setTotal] = useState(0)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = debouncedQuery.trim()
  const isBelowMinLength = trimmed.length < MIN_SEARCH_QUERY_LENGTH

  useEffect(() => {
    if (isBelowMinLength) {
      setFiles([])
      setTotal(0)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    searchFiles({ ...params, query: trimmed })
      .then((result) => {
        if (cancelled) return
        setFiles(result.files)
        setTotal(result.total)
        setSnapshotAt(result.snapshotAt)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(getErrorMessage(err))
        setFiles([])
        setTotal(0)
      })
      .finally(() => {
        if (cancelled) return
        setIsLoading(false)
      })

    return () => {
      cancelled = true
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
  ])

  return { files, total, snapshotAt, isLoading, error, isBelowMinLength }
}
