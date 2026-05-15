import type { ApiResponse } from "@/shared/api/types"

export interface AccountResponse {
  id: string
  provider: "google" | "dropbox"
  email: string
  status: "active" | "never_synced" | "syncing" | "token_invalid" | "revoked"
  quota_used_bytes: number
  quota_total_bytes: number
  last_sync_at: string | null
  last_good_sync_at: string | null
  data_state: "BelumTersedia" | "Parsial" | "Lengkap"
}

export const mockAccountsResponse: ApiResponse<AccountResponse[]> = {
  data: [
    {
      id: "acc-7f3a-001",
      provider: "google",
      email: "rifki.kaida@gmail.com",
      status: "active",
      quota_used_bytes: 13314397696,
      quota_total_bytes: 16106127360,
      last_sync_at: "2026-05-15T03:15:22Z",
      last_good_sync_at: "2026-05-15T03:15:22Z",
      data_state: "Lengkap",
    },
    {
      id: "acc-7f3a-002",
      provider: "dropbox",
      email: "rifki.work@outlook.com",
      status: "token_invalid",
      quota_used_bytes: 2147483648,
      quota_total_bytes: 2147483648,
      last_sync_at: "2026-05-10T22:01:00Z",
      last_good_sync_at: "2026-05-09T08:30:00Z",
      data_state: "Parsial",
    },
    {
      id: "acc-7f3a-003",
      provider: "google",
      email: "kaida.dev@gmail.com",
      status: "never_synced",
      quota_used_bytes: 0,
      quota_total_bytes: 16106127360,
      last_sync_at: null,
      last_good_sync_at: null,
      data_state: "BelumTersedia",
    },
  ],
  meta: { snapshot_at: "2026-05-15T03:15:22Z" },
}

export function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Provider Google punya kuota default 15 GB free tier, Dropbox 2 GB. Saat user
// connect akun baru, kuota_total ditebak dari paket default supaya mock
// realistis tanpa perlu fetch metadata sebelum status berubah ke `active`.
const DEFAULT_TOTAL_BYTES: Record<"google" | "dropbox", number> = {
  google: 16106127360,
  dropbox: 2147483648,
}

export function generateMockAccount(
  provider: "google" | "dropbox",
  existingEmails: Set<string>,
): AccountResponse {
  const suffix = Math.floor(Math.random() * 9000 + 1000)
  const domain = provider === "google" ? "gmail.com" : "outlook.com"
  let email = `akun.demo.${suffix}@${domain}`
  while (existingEmails.has(email)) {
    const fresh = Math.floor(Math.random() * 9000 + 1000)
    email = `akun.demo.${fresh}@${domain}`
  }
  return {
    id: `acc-${Math.random().toString(16).slice(2, 6)}-${Date.now().toString(16).slice(-4)}`,
    provider,
    email,
    status: "never_synced",
    quota_used_bytes: 0,
    quota_total_bytes: DEFAULT_TOTAL_BYTES[provider],
    last_sync_at: null,
    last_good_sync_at: null,
    data_state: "BelumTersedia",
  }
}

// Saat user trigger refresh, mock simulasi metadata sukses fetched dengan
// kuota terisi nilai acak yang masih masuk akal terhadap total quota.
export function generateRefreshedQuota(totalBytes: number): {
  quotaUsedBytes: number
  lastSyncAt: string
} {
  const minRatio = 0.05
  const maxRatio = 0.85
  const ratio = minRatio + Math.random() * (maxRatio - minRatio)
  return {
    quotaUsedBytes: Math.floor(totalBytes * ratio),
    lastSyncAt: new Date().toISOString(),
  }
}
