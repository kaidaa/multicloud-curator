import { useCallback, useEffect, useState } from "react"

import { getQuotaSummary, type QuotaSummary } from "@/features/explore/api"
import { getErrorMessage } from "@/shared/api/errors"
import { useAccountsContext } from "@/shared/contexts/AccountsContext"

interface UseQuotaSummaryResult {
  summary: QuotaSummary | null
  isLoading: boolean
  error: string | null
  snapshotAt: string | null
  refetch: () => void
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export function useQuotaSummary(): UseQuotaSummaryResult {
  const { globalRefreshVersion } = useAccountsContext()
  const [summary, setSummary] = useState<QuotaSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)

  const refetch = useCallback(() => {
    setRequestVersion((version) => version + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    getQuotaSummary({ signal: controller.signal })
      .then((result) => {
        setSummary(result.summary)
        setSnapshotAt(result.snapshotAt)
      })
      .catch((err: unknown) => {
        if (isAbortError(err)) return
        setSummary(null)
        setError(getErrorMessage(err))
      })
      .finally(() => {
        if (controller.signal.aborted) return
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [requestVersion, globalRefreshVersion])

  return { summary, isLoading, error, snapshotAt, refetch }
}
