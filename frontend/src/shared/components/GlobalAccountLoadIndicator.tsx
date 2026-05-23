import { CircleNotch, WarningCircle } from "@phosphor-icons/react"

import { useAccountsContext } from "@/shared/contexts/AccountsContext"
import { getAccountLifecycleSummary } from "@/shared/utils/accountLifecycle"

export function GlobalAccountLoadIndicator() {
  const { accounts, loadingAccountIds } = useAccountsContext()
  const { loadingAccounts, failedLoadAccounts } = getAccountLifecycleSummary(accounts, {
    loadingAccountIds,
  })

  if (loadingAccounts.length === 0 && failedLoadAccounts.length === 0) return null
  const hasLoading = loadingAccounts.length > 0
  const hasFailure = failedLoadAccounts.length > 0

  return (
    <div
      className={`sticky top-0 z-20 mb-5 rounded-[--radius-sm] border px-4 py-3 text-sm shadow-soft ${
        hasFailure
          ? "border-warning-strong/30 bg-warning-soft text-warning-strong"
          : "border-primary/20 bg-primary-soft text-primary-strong"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {hasLoading && (
          <span className="inline-flex items-center gap-2">
            <CircleNotch size={16} className="animate-spin" weight="bold" />
            <span className="font-medium">
              {loadingAccounts.length} akun sedang dimuat
            </span>
          </span>
        )}
        {hasFailure && (
          <span className="inline-flex items-center gap-2">
            <WarningCircle size={16} weight="fill" />
            <span className="font-medium">
              {failedLoadAccounts.length} akun gagal dimuat
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
