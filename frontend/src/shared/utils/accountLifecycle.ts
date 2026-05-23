import type { Account } from "@/features/accounts/api"

export type LoadingAccountIds = Iterable<string>

export interface AccountLifecycleSummary {
  activeAccounts: Account[]
  loadingAccounts: Account[]
  failedLoadAccounts: Account[]
  problemAccounts: Account[]
  hasAccounts: boolean
  hasActiveAccounts: boolean
  hasLoadingAccounts: boolean
  hasLoadFailures: boolean
  hasOnlyLoadingAccounts: boolean
}

export function isAccountEffectivelyLoading(
  account: Account,
  loadingAccountIds: LoadingAccountIds = [],
): boolean {
  if (account.status === "syncing" || account.status === "never_synced") {
    return true
  }
  return new Set(loadingAccountIds).has(account.id)
}

export function getAccountLifecycleSummary(
  accounts: Account[],
  options: { loadingAccountIds?: LoadingAccountIds } = {},
): AccountLifecycleSummary {
  const loadingAccountIdSet = new Set(options.loadingAccountIds ?? [])
  const isLoading = (account: Account) =>
    account.status === "syncing" ||
    account.status === "never_synced" ||
    loadingAccountIdSet.has(account.id)
  const activeAccounts = accounts.filter(
    (account) => account.status === "active" && !loadingAccountIdSet.has(account.id),
  )
  const loadingAccounts = accounts.filter(isLoading)
  const failedLoadAccounts = accounts.filter(
    (account) => account.status === "load_failed" && !isLoading(account),
  )
  const problemAccounts = accounts.filter(
    (account) => account.status === "token_invalid" || account.status === "revoked",
  )
  const hasAccounts = accounts.length > 0

  return {
    activeAccounts,
    loadingAccounts,
    failedLoadAccounts,
    problemAccounts,
    hasAccounts,
    hasActiveAccounts: activeAccounts.length > 0,
    hasLoadingAccounts: loadingAccounts.length > 0,
    hasLoadFailures: failedLoadAccounts.length > 0,
    hasOnlyLoadingAccounts:
      hasAccounts && activeAccounts.length === 0 && loadingAccounts.length === accounts.length,
  }
}
