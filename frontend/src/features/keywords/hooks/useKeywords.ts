import { useCallback, useEffect, useState } from "react"

import {
  addKeyword,
  deleteKeyword,
  listKeywords,
  toggleKeyword,
  type Keyword,
} from "@/features/keywords/api"
import { getErrorMessage } from "@/shared/api/errors"

interface UseKeywordsResult {
  keywords: Keyword[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
  add: (word: string) => Promise<Keyword>
  toggle: (id: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export function useKeywords(): UseKeywordsResult {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await listKeywords()
      setKeywords(result)
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
    listKeywords()
      .then((result) => {
        if (!cancelled) setKeywords(result)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const add = useCallback(async (word: string): Promise<Keyword> => {
    const created = await addKeyword(word)
    await refetch()
    return created
  }, [refetch])

  const toggle = useCallback(async (id: string) => {
    // Apply the toggle immediately, then revert on failure.
    setKeywords((prev) =>
      prev.map((kw) => (kw.id === id ? { ...kw, active: !kw.active } : kw)),
    )
    try {
      await toggleKeyword(id)
    } catch (err) {
      setKeywords((prev) =>
        prev.map((kw) => (kw.id === id ? { ...kw, active: !kw.active } : kw)),
      )
      throw err
    }
  }, [])

  const remove = useCallback(async (id: string) => {
    await deleteKeyword(id)
    await refetch()
  }, [refetch])

  return { keywords, isLoading, error, refetch, add, toggle, remove }
}
