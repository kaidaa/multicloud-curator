import type { Account } from "@/features/accounts/api"
import type { ScanCoverage } from "@/shared/api/coverage"

export function shouldShowCoverageRatio(coverage: ScanCoverage | null): boolean {
  return Boolean(
    coverage && coverage.coveredAccountCount < coverage.eligibleAccountCount,
  )
}

export function hasNewActiveAccountsOutsideCoverage(
  coverage: ScanCoverage | null,
  accounts: Account[],
): boolean {
  if (!coverage) return false
  const coveredIds = new Set(coverage.coveredAccountIds)
  return accounts.some(
    (account) => account.status === "active" && !coveredIds.has(account.id),
  )
}
