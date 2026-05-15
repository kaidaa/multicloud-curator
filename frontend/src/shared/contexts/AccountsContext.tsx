import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  connectAccount as apiConnectAccount,
  disconnectAccount as apiDisconnectAccount,
  listAccounts,
  reauthorizeAccount as apiReauthorizeAccount,
  refreshAccount as apiRefreshAccount,
  type Account,
  type Provider,
} from "@/features/accounts/api"
import { getErrorMessage } from "@/shared/api/errors"

interface AccountsContextValue {
  accounts: Account[]
  isLoading: boolean
  error: string | null
  snapshotAt: string | null
  refetch: () => Promise<void>
  connectAccount: (provider: Provider) => Promise<Account>
  refreshAccount: (accountId: string) => Promise<Account>
  reauthorizeAccount: (accountId: string) => Promise<Account>
  disconnectAccount: (accountId: string) => Promise<void>
}

const AccountsContext = createContext<AccountsContextValue | undefined>(undefined)

export function AccountsProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null)

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

  const connectAccount = useCallback(async (provider: Provider) => {
    const newAccount = await apiConnectAccount(provider)
    setAccounts((prev) => [...prev, newAccount])
    return newAccount
  }, [])

  // Refresh menampilkan transisi syncing → active di UI. Optimistic patch
  // pertama supaya badge langsung berubah, lalu replace dengan hasil final
  // saat promise resolve.
  const refreshAccount = useCallback(async (accountId: string) => {
    setAccounts((prev) =>
      prev.map((a) => (a.id === accountId ? { ...a, status: "syncing" } : a)),
    )
    try {
      const updated = await apiRefreshAccount(accountId)
      setAccounts((prev) => prev.map((a) => (a.id === accountId ? updated : a)))
      return updated
    } catch (err) {
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId ? { ...a, status: "token_invalid" } : a,
        ),
      )
      throw err
    }
  }, [])

  const reauthorizeAccount = useCallback(async (accountId: string) => {
    const updated = await apiReauthorizeAccount(accountId)
    setAccounts((prev) => prev.map((a) => (a.id === accountId ? updated : a)))
    return updated
  }, [])

  const disconnectAccount = useCallback(async (accountId: string) => {
    await apiDisconnectAccount(accountId)
    setAccounts((prev) => prev.filter((a) => a.id !== accountId))
  }, [])

  const value = useMemo<AccountsContextValue>(
    () => ({
      accounts,
      isLoading,
      error,
      snapshotAt,
      refetch,
      connectAccount,
      refreshAccount,
      reauthorizeAccount,
      disconnectAccount,
    }),
    [
      accounts,
      isLoading,
      error,
      snapshotAt,
      refetch,
      connectAccount,
      refreshAccount,
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
