import { api } from "@/shared/api/client"

export type Provider = "google" | "dropbox"

export interface FileResponse {
  id: string
  file_id: string
  name: string
  type: string
  mime_type: string | null
  size_bytes: number | null
  modified_at: string
  account_id: string
  account_email: string
  provider: Provider
  is_owned: boolean
  path: string | null
  web_view_link: string | null
}

interface QuotaAccountResponse {
  account_id: string
  provider: Provider
  email: string
  used_bytes: number
  total_bytes: number
}

interface QuotaSummaryResponse {
  total_used_bytes: number
  total_capacity_bytes: number
  per_account: QuotaAccountResponse[]
}

export interface ActivityFile {
  id: string
  fileId: string
  name: string
  type: string
  mimeType: string | null
  sizeBytes: number | null
  modifiedAt: string
  accountId: string
  accountEmail: string
  provider: Provider
  isOwned: boolean
  path: string | null
  webViewLink: string | null
}

export interface QuotaAccount {
  accountId: string
  provider: Provider
  email: string
  usedBytes: number
  totalBytes: number
}

export interface QuotaSummary {
  totalUsedBytes: number
  totalCapacityBytes: number
  perAccount: QuotaAccount[]
}

export function mapFileResponse(raw: FileResponse): ActivityFile {
  return {
    id: raw.id,
    fileId: raw.file_id,
    name: raw.name,
    type: raw.type,
    mimeType: raw.mime_type,
    sizeBytes: raw.size_bytes,
    modifiedAt: raw.modified_at,
    accountId: raw.account_id,
    accountEmail: raw.account_email,
    provider: raw.provider,
    isOwned: raw.is_owned,
    path: raw.path,
    webViewLink: raw.web_view_link,
  }
}

function mapQuotaSummary(raw: QuotaSummaryResponse): QuotaSummary {
  return {
    totalUsedBytes: raw.total_used_bytes,
    totalCapacityBytes: raw.total_capacity_bytes,
    perAccount: raw.per_account.map((account) => ({
      accountId: account.account_id,
      provider: account.provider,
      email: account.email,
      usedBytes: account.used_bytes,
      totalBytes: account.total_bytes,
    })),
  }
}

export interface ActivityResult {
  files: ActivityFile[]
  snapshotAt: string | null
}

export interface QuotaSummaryResult {
  summary: QuotaSummary
  snapshotAt: string | null
}

export async function listActivity(
  options: { limit?: number; signal?: AbortSignal } = {},
): Promise<ActivityResult> {
  const limit = Math.min(options.limit ?? 10, 50)
  const response = await api.get<FileResponse[]>("/files/activity", {
    params: { limit },
    signal: options.signal,
  })
  return {
    files: response.data.map(mapFileResponse),
    snapshotAt: response.meta?.snapshot_at ?? null,
  }
}

export async function getQuotaSummary(
  options: { signal?: AbortSignal } = {},
): Promise<QuotaSummaryResult> {
  const response = await api.get<QuotaSummaryResponse>("/quota", {
    signal: options.signal,
  })
  return {
    summary: mapQuotaSummary(response.data),
    snapshotAt: response.meta?.snapshot_at ?? null,
  }
}
