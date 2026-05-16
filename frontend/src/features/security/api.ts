import { simulateDelay } from "@/shared/api/mocks/accounts"
import {
  applyMockBatchRevoke,
  applyMockSecurityScanRefresh,
  getMockSecurityResponse,
  type SecurityFileResponse,
  type SecurityMode,
} from "@/shared/api/mocks/security"

export type { SecurityMode }
export type Provider = "google" | "dropbox"

export interface SecurityFile {
  id: string
  fileId: string
  name: string
  type: string
  mimeType: string
  sizeBytes: number
  modifiedAt: string
  accountId: string
  accountEmail: string
  provider: Provider
  isSensitive: boolean
  matchedKeywords: string[]
  // Derived dinamis di SecurityPage dari AccountsContext — field di sini
  // hanya snapshot mock seed yang akan di-override.
  isOwned: boolean
  deletable: boolean
  deletableReason: string | null
  path: string | null
  webViewLink: string | null
}

export interface ListPublicFilesResult {
  files: SecurityFile[]
  scanAt: string | null
}

export interface BatchRevokeEntry {
  fileId: string
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
    sizeBytes: raw.size_bytes,
    modifiedAt: raw.modified_at,
    accountId: raw.account_id,
    accountEmail: raw.account_email,
    provider: raw.provider,
    isSensitive: raw.is_sensitive,
    matchedKeywords: [...raw.matched_keywords],
    // Mock seed semua public file owned (specs/05 §1.1 cakupan owned only).
    // Field is_owned tidak di-expose di SecurityFileResponse mock — set true
    // by default. M4 backend kirim eksplisit.
    isOwned: true,
    deletable: raw.deletable,
    deletableReason: raw.deletable_reason,
    path: raw.path,
    webViewLink: raw.web_view_link,
  }
}

// M4: replace body dengan
//   `api.get<SecurityFileResponse[]>('/security/public-files', { params: { mode } })`.
// Mapper dan signature dipertahankan.
export async function listPublicFiles(
  params: { mode?: SecurityMode } = {},
): Promise<ListPublicFilesResult> {
  const { mode = "sensitive" } = params
  await simulateDelay(600)

  const response = getMockSecurityResponse(mode)
  return {
    files: response.data.map(mapFile),
    scanAt: response.meta.scan_at,
  }
}

// "Scan ulang" Security adalah async operation real di Interface Contract §6.1
// (POST /api/scan/security return operation_id, frontend poll).
// M2 mock: simulate dengan simulateDelay 1.5s + update scan_at, tanpa real
// polling. M4: replace dengan POST + polling GET /api/operations/{id}.
export async function scanSecurity(): Promise<void> {
  await simulateDelay(1500)
  applyMockSecurityScanRefresh()
}

// M4: replace dengan `api.post('/files/batch-revoke', { file_ids })`.
// Catatan contract clarification (pending M4): nama field response `revoked`
// vs `deleted` belum eksplisit di §6.3 (hanya "struktur sama dengan batch
// delete"). M2 mock pakai `revoked` untuk semantic akurat — saat M4
// integration, klarifikasi contract supaya match.
export async function batchRevokeFiles(fileIds: string[]): Promise<BatchRevokeResult> {
  await simulateDelay(700)
  const result = applyMockBatchRevoke(fileIds)
  return {
    revoked: result.revoked.map((entry) => ({
      fileId: entry.file_id,
      success: entry.success,
      errorCode: entry.error_code,
      message: entry.message,
    })),
    failed: result.failed.map((entry) => ({
      fileId: entry.file_id,
      success: entry.success,
      errorCode: entry.error_code,
      message: entry.message,
    })),
  }
}
