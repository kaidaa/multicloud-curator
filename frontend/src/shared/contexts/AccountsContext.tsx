import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  connectAccount as apiConnectAccount,
  disconnectAccount as apiDisconnectAccount,
  listAccounts,
  reauthorizeAccount as apiReauthorizeAccount,
  refreshAllAccounts as apiRefreshAllAccounts,
  startRefreshAccount as apiStartRefreshAccount,
  type Account,
  type AccountsListResult,
  type Provider,
  type RefreshAllOperation,
} from "@/features/accounts/api"
import { getErrorMessage } from "@/shared/api/errors"
import { OperationFailedError, waitForOperation } from "@/shared/api/operations"

export interface RefreshAllFailure {
  accountId: string
  operationId: string
  message: string
}

export interface RefreshAllSummary {
  total: number
  completed: number
  failed: RefreshAllFailure[]
}

interface AccountsContextValue {
  accounts: Account[]
  isLoading: boolean
  isRefreshingAll: boolean
  error: string | null
  snapshotAt: string | null
  globalRefreshVersion: number
  loadingAccountIds: string[]
  refetch: (options?: { silent?: boolean }) => Promise<void>
  connectAccount: (provider: Provider) => Promise<void>
  refreshAccount: (accountId: string) => Promise<Account>
  refreshAllAccounts: () => Promise<RefreshAllSummary>
  reauthorizeAccount: (accountId: string) => Promise<void>
  disconnectAccount: (accountId: string) => Promise<void>
}

const AccountsContext = createContext<AccountsContextValue | undefined>(undefined)

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshingAll, setIsRefreshingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)
  const [globalRefreshVersion, setGlobalRefreshVersion] = useState(0)
  const [trackedLoadingOperations, setTrackedLoadingOperations] = useState<
    Record<string, string[]>
  >({})
  const pendingControllers = useRef<Set<AbortController>>(new Set())

  const loadAccountSnapshot = useCallback(async (
    options: { silent?: boolean } = {},
  ): Promise<AccountsListResult | null> => {
    if (!options.silent) {
      setIsLoading(true)
    }
    setError(null)
    try {
      const result = await listAccounts()
      setAccounts(result.accounts)
      setSnapshotAt(result.snapshotAt)
      return result
    } catch (err) {
      setError(getErrorMessage(err))
      return null
    } finally {
      if (!options.silent) {
        setIsLoading(false)
      }
    }
  }, [])

  const refetch = useCallback(
    async (options: { silent?: boolean } = {}) => {
      await loadAccountSnapshot(options)
    },
    [loadAccountSnapshot],
  )

  const addLoadingOperations = useCallback((operations: RefreshAllOperation[]) => {
    if (operations.length === 0) return
    setTrackedLoadingOperations((prev) => {
      let changed = false
      const next: Record<string, string[]> = { ...prev }
      for (const operation of operations) {
        const existing = next[operation.accountId] ?? []
        if (existing.includes(operation.operationId)) continue
        next[operation.accountId] = [...existing, operation.operationId]
        changed = true
      }
      return changed ? next : prev
    })
  }, [])

  const removeLoadingOperation = useCallback((operation: RefreshAllOperation) => {
    setTrackedLoadingOperations((prev) => {
      const existing = prev[operation.accountId]
      if (!existing) return prev
      const remaining = existing.filter((operationId) => operationId !== operation.operationId)
      if (remaining.length === existing.length) return prev
      const next = { ...prev }
      if (remaining.length > 0) {
        next[operation.accountId] = remaining
      } else {
        delete next[operation.accountId]
      }
      return next
    })
  }, [])

  const settleLoadingOperation = useCallback(
    async (operation: RefreshAllOperation) => {
      const result = await loadAccountSnapshot({ silent: true })
      removeLoadingOperation(operation)
      return result
    },
    [loadAccountSnapshot, removeLoadingOperation],
  )

  const loadingAccountIds = useMemo(() => {
    const trackedIds = new Set(Object.keys(trackedLoadingOperations))
    return accounts
      .filter(
        (account) =>
          account.status === "syncing" ||
          account.status === "never_synced" ||
          trackedIds.has(account.id),
      )
      .map((account) => account.id)
  }, [accounts, trackedLoadingOperations])

  useEffect(() => {
    void refetch()
  }, [refetch])

  useEffect(() => {
    if (loadingAccountIds.length === 0) return

    const intervalId = window.setInterval(() => {
      void refetch({ silent: true })
    }, 2500)

    return () => window.clearInterval(intervalId)
  }, [loadingAccountIds.length, refetch])

  useEffect(
    () => () => {
      for (const controller of pendingControllers.current) {
        controller.abort()
      }
      pendingControllers.current.clear()
    },
    [],
  )

  const connectAccount = useCallback(async (provider: Provider) => {
    await apiConnectAccount(provider)
  }, [])

  // Track refresh operations before the database status flips to syncing.
  const refreshAccount = useCallback(async (accountId: string) => {
    const controller = new AbortController()
    pendingControllers.current.add(controller)
    let operation: RefreshAllOperation | null = null
    try {
      operation = await apiStartRefreshAccount(accountId, {
        signal: controller.signal,
      })
      addLoadingOperations([operation])
      await waitForOperation(operation.operationId, {
        signal: controller.signal,
      })
      const result = await settleLoadingOperation(operation)
      operation = null
      const updated = result?.accounts.find((a) => a.id === accountId)
      if (!updated) {
        throw new Error("Akun tidak ditemukan setelah refresh selesai.")
      }
      return updated
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        if (operation) {
          await settleLoadingOperation(operation)
          operation = null
        } else {
          await refetch({ silent: true })
        }
      }
      throw err
    } finally {
      if (operation) {
        removeLoadingOperation(operation)
      }
      pendingControllers.current.delete(controller)
    }
  }, [addLoadingOperations, refetch, removeLoadingOperation, settleLoadingOperation])

  const refreshAllAccounts = useCallback(async (): Promise<RefreshAllSummary> => {
    const controller = new AbortController()
    pendingControllers.current.add(controller)
    setIsRefreshingAll(true)

    try {
      const operations = await apiRefreshAllAccounts({ signal: controller.signal })
      addLoadingOperations(operations)

      const settled = await Promise.all(
        operations.map(async (operation) => {
          try {
            await waitForOperation(operation.operationId, {
              signal: controller.signal,
            })
            return { operation, success: true as const }
          } catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
              throw err
            }
            const message =
              err instanceof OperationFailedError
                ? err.operation.error_message || "Refresh akun gagal."
                : getErrorMessage(err)
            return { operation, success: false as const, message }
          } finally {
            await settleLoadingOperation(operation)
          }
        }),
      )

      await refetch({ silent: true })
      setGlobalRefreshVersion((version) => version + 1)

      const failed: RefreshAllFailure[] = []
      let completed = 0
      for (const item of settled) {
        if (item.success) {
          completed += 1
          continue
        }
        failed.push({
          accountId: item.operation.accountId,
          operationId: item.operation.operationId,
          message: item.message,
        })
      }

      return {
        total: operations.length,
        completed,
        failed,
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        await refetch({ silent: true })
      }
      throw err
    } finally {
      setIsRefreshingAll(false)
      pendingControllers.current.delete(controller)
    }
  }, [addLoadingOperations, refetch, settleLoadingOperation])

  const reauthorizeAccount = useCallback(async (accountId: string) => {
    await apiReauthorizeAccount(accountId)
  }, [])

  const disconnectAccount = useCallback(async (accountId: string) => {
    await apiDisconnectAccount(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
    setTrackedLoadingOperations((prev) => {
      if (!(accountId in prev)) return prev
      const next = { ...prev }
      delete next[accountId]
      return next
    })
  }, [])

  const value = useMemo<AccountsContextValue>(
    () => ({
      accounts,
      isLoading,
      isRefreshingAll,
      error,
      snapshotAt,
      globalRefreshVersion,
      loadingAccountIds,
      refetch,
      connectAccount,
      refreshAccount,
      refreshAllAccounts,
      reauthorizeAccount,
      disconnectAccount,
    }),
    [
      accounts,
      isLoading,
      isRefreshingAll,
      error,
      snapshotAt,
      globalRefreshVersion,
      loadingAccountIds,
      refetch,
      connectAccount,
      refreshAccount,
      refreshAllAccounts,
      reauthorizeAccount,
      disconnectAccount,
    ],
  )

  return <AccountsContext.Provider value={value}>{children}</AccountsContext.Provider>
}

export function useAccountsContext() {
  const ctx = useContext(AccountsContext)
  if (!ctx) {
    throw new Error("useAccountsContext harus dipanggil di dalam <AccountsProvider>")
  }
  return ctx
}
