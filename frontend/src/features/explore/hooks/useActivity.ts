import { useEffect, useState } from "react"

import { listActivity, type ActivityFile } from "@/features/explore/api"
import { getErrorMessage } from "@/shared/api/errors"

interface UseActivityOptions {
  limit?: number
  eligibleAccountIds: Set<string>
}

interface UseActivityResult {
  files: ActivityFile[]
  isLoading: boolean
  error: string | null
  snapshotAt: string | null
}

export function useActivity({ limit = 10, eligibleAccountIds }: UseActivityOptions): UseActivityResult {
  const [files, setFiles] = useState<ActivityFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)

  // Serialize set ke string supaya useEffect dependency stabil saat parent
  // re-render dengan akun yang sama. Set baru tiap render akan trigger fetch
  // ulang yang tidak perlu.
  const accountIdsKey = Array.from(eligibleAccountIds).sort().join(",")

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const accountIds = new Set(accountIdsKey ? accountIdsKey.split(",") : [])

    listActivity({ limit, eligibleAccountIds: accountIds })
      .then((result) => {
        if (cancelled) return
        setFiles(result.files)
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
  }, [accountIdsKey, limit])

  return { files, isLoading, error, snapshotAt }
}
