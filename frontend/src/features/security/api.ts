import { api } from "@/shared/api/client"
import { parseScanCoverage, type ScanCoverage } from "@/shared/api/coverage"
import { waitForOperation } from "@/shared/api/operations"
import type { LocationType } from "@/shared/files/location"

export type SecurityMode = "sensitive" | "public"
export type Provider = "google" | "dropbox"
export type SecurityProviderFilter = "all" | Provider

interface SecurityScanResponse {
  operation_id: string
  operation_type: "security_scan"
  status: "queued" | "running"
}

interface SecurityFileResponse {
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
  is_sensitive: boolean
  matched_keywords: string[]
  deletable: boolean
  deletable_reason: string | null
  path: string | null
  location_type: LocationType | null
  open_url: string | null
  open_url_type: string | null
}

interface BatchRevokeSuccessResponse {
  id: string
  success: true
}

interface BatchRevokeFailureResponse {
  id: string
  success: false
  error_code: string
  message: string
}

interface BatchRevokeResponse {
  revoked: BatchRevokeSuccessResponse[]
  failed: BatchRevokeFailureResponse[]
}

export interface SecurityFile {
  id: string
  fileId: string
  name: string
  type: string
  mimeType: string | null
  sizeBytes: number
  modifiedAt: string
  accountId: string
  accountEmail: string
  provider: Provider
  isSensitive: boolean
  matchedKeywords: string[]
  isOwned: boolean
  deletable: boolean
  deletableReason: string | null
  path: string | null
  locationType: LocationType | null
  openUrl: string | null
  openUrlType: string | null
}

export interface ListPublicFilesResult {
  files: SecurityFile[]
  scanAt: string | null
  coverage: ScanCoverage | null
}

export interface BatchRevokeEntry {
  id: string
  success: boolean
  errorCode?: string
  message?: string
}

export interface BatchRevokeResult {
  revoked: BatchRevokeEntry[]
  failed: BatchRevokeEntry[]
}

function mapFile(raw: SecurityFileResponse): SecurityFile {
  return {
    id: raw.id,
    fileId: raw.file_id,
    name: raw.name,
    type: raw.type,
    mimeType: raw.mime_type,
    sizeBytes: raw.size_bytes ?? 0,
    modifiedAt: raw.modified_at,
    accountId: raw.account_id,
    accountEmail: raw.account_email,
    provider: raw.provider,
    isSensitive: raw.is_sensitive,
    matchedKeywords: [...raw.matched_keywords],
    isOwned: raw.is_owned,
    deletable: raw.deletable,
    deletableReason: raw.deletable_reason,
    path: raw.path,
    locationType: raw.location_type,
    openUrl: raw.open_url,
    openUrlType: raw.open_url_type,
  }
}

export async function listPublicFiles(
  params: { mode?: SecurityMode; provider?: SecurityProviderFilter } = {},
): Promise<ListPublicFilesResult> {
  const { mode = "sensitive", provider = "all" } = params
  const response = await api.get<SecurityFileResponse[]>("/security/public-files", {
    params: { mode, provider },
  })

  return {
    files: response.data.map(mapFile),
    scanAt:
      typeof response.meta?.scan_at === "string"
        ? response.meta.scan_at
        : null,
    coverage: parseScanCoverage(response.meta?.coverage),
  }
}

export async function scanSecurity(): Promise<void> {
  const response = await api.post<SecurityScanResponse>("/scan/security")
  await waitForOperation(response.data.operation_id)
}

export async function batchRevokeFiles(ids: string[]): Promise<BatchRevokeResult> {
  const response = await api.post<BatchRevokeResponse>("/files/batch-revoke", {
    ids,
  })

  return {
    revoked: response.data.revoked.map((entry) => ({
      id: entry.id,
      success: entry.success,
    })),
    failed: response.data.failed.map((entry) => ({
      id: entry.id,
      success: entry.success,
      errorCode: entry.error_code,
      message: entry.message,
    })),
  }
}
