export interface ScanCoverage {
  coveredAccountIds: string[]
  coveredAccountCount: number
  eligibleAccountCount: number
}

interface ScanCoverageResponse {
  covered_account_ids?: unknown
  covered_account_count?: unknown
  eligible_account_count?: unknown
}

export function parseScanCoverage(value: unknown): ScanCoverage | null {
  if (!value || typeof value !== "object") return null
  const raw = value as ScanCoverageResponse
  if (!Array.isArray(raw.covered_account_ids)) return null
  if (typeof raw.eligible_account_count !== "number") return null

  const coveredAccountIds = raw.covered_account_ids
    .filter((item): item is string => typeof item === "string")

  return {
    coveredAccountIds,
    coveredAccountCount:
      typeof raw.covered_account_count === "number"
        ? raw.covered_account_count
        : coveredAccountIds.length,
    eligibleAccountCount: raw.eligible_account_count,
  }
}
