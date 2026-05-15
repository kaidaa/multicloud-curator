import {
  generateMockAccount,
  generateRefreshedQuota,
  mockAccountsResponse,
  simulateDelay,
  type AccountResponse,
} from "@/shared/api/mocks/accounts"

export type AccountStatus =
  | "active"
  | "never_synced"
  | "syncing"
  | "token_invalid"
  | "revoked"

export type Provider = "google" | "dropbox"

export type DataState = "BelumTersedia" | "Parsial" | "Lengkap"

export interface Account {
  id: string
  provider: Provider
  email: string
  status: AccountStatus
  quotaUsedBytes: number
  quotaTotalBytes: number
  lastSyncAt: string | null
  lastGoodSyncAt: string | null
  dataState: DataState
}

// Backend response pakai snake_case (konvensi JSON di Interface Contract),
// state internal TypeScript pakai camelCase. Mapper ini single point of
// translation — saat M4 swap ke api.get(...), payload real lewat sini juga.
function mapAccountResponse(raw: AccountResponse): Account {
  return {
    id: raw.id,
    provider: raw.provider,
    email: raw.email,
    status: raw.status,
    quotaUsedBytes: raw.quota_used_bytes,
    quotaTotalBytes: raw.quota_total_bytes,
    lastSyncAt: raw.last_sync_at,
    lastGoodSyncAt: raw.last_good_sync_at,
    dataState: raw.data_state,
  }
}

// In-memory mutable snapshot dari mock dataset. Setiap call mutate copy ini
// supaya behavior connect/refresh/disconnect terlihat persistent dalam satu
// sesi browser. Hard refresh akan reset ke seed awal — expected di M2.
let mockState: AccountResponse[] = mockAccountsResponse.data.map((a) => ({ ...a }))
const MOCK_SNAPSHOT_AT = mockAccountsResponse.meta?.snapshot_at ?? null

export interface AccountsListResult {
  accounts: Account[]
  snapshotAt: string | null
}

// M4: replace body dengan `api.get<AccountResponse[]>('/accounts')`. Mapper
// dan signature di luar tetap.
export async function listAccounts(): Promise<AccountsListResult> {
  await simulateDelay(700)
  return {
    accounts: mockState.map(mapAccountResponse),
    snapshotAt: MOCK_SNAPSHOT_AT,
  }
}

// M4: replace dengan `api.post<{authorization_url, state}>('/accounts/connect/initiate', { provider })`
// lalu redirect ke window.location dan handle callback di AccountsPage.
export async function connectAccount(provider: Provider): Promise<Account> {
  await simulateDelay(1500)
  const existing = new Set(mockState.map((a) => a.email))
  const newAccount = generateMockAccount(provider, existing)
  mockState = [...mockState, newAccount]
  return mapAccountResponse(newAccount)
}

// M4: replace dengan POST /accounts/{id}/refresh + polling operation_id.
// Mock simulasi langsung transisi syncing → active tanpa real polling.
export async function refreshAccount(accountId: string): Promise<Account> {
  const target = mockState.find((a) => a.id === accountId)
  if (!target) {
    throw new Error(`Akun ${accountId} tidak ditemukan`)
  }
  target.status = "syncing"
  target.last_sync_at = new Date().toISOString()
  await simulateDelay(1500)
  const refreshed = generateRefreshedQuota(target.quota_total_bytes)
  target.status = "active"
  target.quota_used_bytes = refreshed.quotaUsedBytes
  target.last_sync_at = refreshed.lastSyncAt
  target.last_good_sync_at = refreshed.lastSyncAt
  target.data_state = "Lengkap"
  return mapAccountResponse(target)
}

// M4: replace dengan POST /accounts/{id}/reauthorize + redirect ke
// authorization_url. Mock anggap user langsung sukses re-authorize.
export async function reauthorizeAccount(accountId: string): Promise<Account> {
  const target = mockState.find((a) => a.id === accountId)
  if (!target) {
    throw new Error(`Akun ${accountId} tidak ditemukan`)
  }
  await simulateDelay(1500)
  target.status = "active"
  target.last_sync_at = new Date().toISOString()
  target.last_good_sync_at = target.last_sync_at
  target.data_state = "Lengkap"
  return mapAccountResponse(target)
}

// M4: replace dengan DELETE /accounts/{id}. Real backend cascade delete
// files + scan results + operations row.
export async function disconnectAccount(accountId: string): Promise<void> {
  await simulateDelay(700)
  mockState = mockState.filter((a) => a.id !== accountId)
}
