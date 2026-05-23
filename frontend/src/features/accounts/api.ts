import { api } from "@/shared/api/client"
import { waitForOperation } from "@/shared/api/operations"

export type AccountStatus =
  | "active"
  | "never_synced"
  | "syncing"
  | "token_invalid"
  | "revoked"
  | "load_failed"

export type Provider = "google" | "dropbox"

export type DataState = "BelumTersedia" | "Parsial" | "Lengkap"

interface AccountResponse {
  id: string
  provider: Provider
  email: string
  status: AccountStatus
  quota_used_bytes: number
  quota_total_bytes: number
  last_sync_at: string | null
  last_good_sync_at: string | null
  data_state: DataState
}

interface OAuthInitiateResponse {
  authorization_url: string
  state: string
}

interface RefreshOperationResponse {
  operation_id: string
  operation_type: "refresh"
  account_id: string
  status: "queued" | "running"
}

interface RefreshAllResponse {
  operations: RefreshOperationResponse[]
}

export interface RefreshAllOperation {
  accountId: string
  operationId: string
  operationType: "refresh"
  status: "queued" | "running"
}

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

function redirectToProvider(authorizationUrl: string): void {
  window.location.assign(authorizationUrl)
}

export interface AccountsListResult {
  accounts: Account[]
  snapshotAt: string | null
}

export async function listAccounts(
  options: { signal?: AbortSignal } = {},
): Promise<AccountsListResult> {
  const response = await api.get<AccountResponse[]>("/accounts", {
    signal: options.signal,
  })
  return {
    accounts: response.data.map(mapAccountResponse),
    snapshotAt: response.meta?.snapshot_at ?? null,
  }
}

export async function connectAccount(provider: Provider): Promise<void> {
  const response = await api.post<OAuthInitiateResponse>(
    "/accounts/connect/initiate",
    { provider },
  )
  redirectToProvider(response.data.authorization_url)
}

export async function refreshAccount(
  accountId: string,
  options: { signal?: AbortSignal } = {},
): Promise<AccountsListResult> {
  const operation = await startRefreshAccount(accountId, options)
  await waitForOperation(operation.operationId, { signal: options.signal })
  return listAccounts({ signal: options.signal })
}

export async function startRefreshAccount(
  accountId: string,
  options: { signal?: AbortSignal } = {},
): Promise<RefreshAllOperation> {
  const response = await api.post<RefreshOperationResponse>(
    `/accounts/${accountId}/refresh`,
    undefined,
    { signal: options.signal },
  )
  return {
    accountId: response.data.account_id,
    operationId: response.data.operation_id,
    operationType: response.data.operation_type,
    status: response.data.status,
  }
}

export async function refreshAllAccounts(
  options: { signal?: AbortSignal } = {},
): Promise<RefreshAllOperation[]> {
  const response = await api.post<RefreshAllResponse>(
    "/accounts/refresh-all",
    undefined,
    { signal: options.signal },
  )
  return response.data.operations.map((operation) => ({
    accountId: operation.account_id,
    operationId: operation.operation_id,
    operationType: operation.operation_type,
    status: operation.status,
  }))
}

export async function reauthorizeAccount(accountId: string): Promise<void> {
  const response = await api.post<OAuthInitiateResponse>(
    `/accounts/${accountId}/reauthorize`,
  )
  redirectToProvider(response.data.authorization_url)
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await api.delete<null>(`/accounts/${accountId}`)
}
