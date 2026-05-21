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
  refreshAccount as apiRefreshAccount,
  type Account,
  type Provider,
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
  refetch: () => Promise<void>
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
  const pendingControllers = useRef<Set<AbortController>>(new Set())

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await listAccounts()
      setAccounts(result.accounts)
      setSnapshotAt(result.snapshotAt)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

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

  // Refresh menampilkan transisi syncing → active di UI. Optimistic patch
  // pertama supaya badge langsung berubah, lalu replace dengan hasil final
  // saat promise resolve.
  const refreshAccount = useCallback(async (accountId: string) => {
    const controller = new AbortController()
    pendingControllers.current.add(controller)
    let previousAccount: Account | undefined

    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id !== accountId) return a
        previousAccount = a
        return { ...a, status: "syncing" }
      }),
    )
    try {
      const result = await apiRefreshAccount(accountId, {
        signal: controller.signal,
      })
      setAccounts(result.accounts)
      setSnapshotAt(result.snapshotAt)
      const updated = result.accounts.find((a) => a.id === accountId)
      if (!updated) {
        throw new Error("Akun tidak ditemukan setelah refresh selesai.")
      }
      return updated
    } catch (err) {
      if (!(err instanceof Error && err.name === "AbortError")) {
        const accountToRestore = previousAccount
        if (accountToRestore) {
          setAccounts((prev) =>
            prev.map((a) => (a.id === accountId ? accountToRestore : a)),
          )
        }
        await refetch()
      }
      throw err
    } finally {
      pendingControllers.current.delete(controller)
    }
  }, [refetch])

  const refreshAllAccounts = useCallback(async (): Promise<RefreshAllSummary> => {
    const controller = new AbortController()
    pendingControllers.current.add(controller)
    setIsRefreshingAll(true)

    try {
      const operations = await apiRefreshAllAccounts({ signal: controller.signal })
      const accountIds = new Set(operations.map((operation) => operation.accountId))

      if (accountIds.size > 0) {
        setAccounts((prev) =>
          prev.map((account) =>
            accountIds.has(account.id)
              ? { ...account, status: "syncing" }
              : account,
          ),
        )
      }

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
          }
        }),
      )

      await refetch()
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
        await refetch()
      }
      throw err
    } finally {
      setIsRefreshingAll(false)
      pendingControllers.current.delete(controller)
    }
  }, [refetch])

  const reauthorizeAccount = useCallback(async (accountId: string) => {
    await apiReauthorizeAccount(accountId)
  }, [])

  const disconnectAccount = useCallback(async (accountId: string) => {
    await apiDisconnectAccount(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }, [])

  const value = useMemo<AccountsContextValue>(
    () => ({
      accounts,
      isLoading,
      isRefreshingAll,
      error,
      snapshotAt,
      globalRefreshVersion,
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
