import { simulateDelay } from "@/shared/api/mocks/accounts"
import {
  applyMockLargeStaleBatchDelete,
  applyMockLargeStaleRefresh,
  getMockLargeStaleResponse,
  type LargeStaleFileResponse,
  type LargeStaleThresholds,
} from "@/shared/api/mocks/largeStale"

export type LargeStaleTypeFilter =
  | "all"
  | "photo"
  | "video"
  | "document"
  | "audio"
  | "other"

export type LargeStaleSort =
  | "size_desc"
  | "size_asc"
  | "modified_asc"
  | "modified_desc"

export type Provider = "google" | "dropbox"

export type TriggerReason = "large" | "stale" | "both"

export interface LargeStaleFile {
  id: string
  fileId: string
  name: string
  type: string
  mimeType: string
  sizeBytes: number
  modifiedAt: string
  modifiedAgeMonths: number
  accountId: string
  accountEmail: string
  provider: Provider
  isOwned: boolean
  deletable: boolean
  deletableReason: string | null
  triggerReason: TriggerReason
  path: string | null
  webViewLink: string | null
}

export interface ListLargeStaleResult {
  files: LargeStaleFile[]
  total: number
  snapshotAt: string | null
  thresholds: LargeStaleThresholds
}

export interface BatchDeleteEntry {
  fileId: string
  success: boolean
  errorCode?: string
  message?: string
}

export interface BatchDeleteResult {
  deleted: BatchDeleteEntry[]
  failed: BatchDeleteEntry[]
}

function mapFile(raw: LargeStaleFileResponse): LargeStaleFile {
  return {
    id: raw.id,
    fileId: raw.file_id,
    name: raw.name,
    type: raw.type,
    mimeType: raw.mime_type,
    sizeBytes: raw.size_bytes,
    modifiedAt: raw.modified_at,
    modifiedAgeMonths: raw.modified_age_months,
    accountId: raw.account_id,
    accountEmail: raw.account_email,
    provider: raw.provider,
    isOwned: raw.is_owned,
    deletable: raw.deletable,
    deletableReason: raw.deletable_reason,
    triggerReason: raw.trigger_reason,
    path: raw.path,
    webViewLink: raw.web_view_link,
  }
}

// Duplikasi lokal logic categorize dari Feature 3/4 supaya boundary strict
// no-touch terjaga. Saat Feature 6 selesai, evaluasi promote ke shared.
function categorizeFileType(mimeType: string): LargeStaleTypeFilter {
  const mime = mimeType.toLowerCase()
  if (mime.startsWith("image/")) return "photo"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "application/pdf") return "document"
  if (mime.startsWith("application/vnd.openxmlformats-officedocument")) return "document"
  if (mime.startsWith("application/vnd.google-apps")) return "document"
  if (mime.startsWith("text/")) return "document"
  return "other"
}

function compareFiles(
  a: LargeStaleFile,
  b: LargeStaleFile,
  sort: LargeStaleSort,
): number {
  switch (sort) {
    case "size_asc":
      return a.sizeBytes - b.sizeBytes
    case "modified_asc":
      return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime()
    case "modified_desc":
      return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
    case "size_desc":
    default:
      return b.sizeBytes - a.sizeBytes
  }
}

export interface ListLargeStaleParams {
  type?: LargeStaleTypeFilter
  sort?: LargeStaleSort
  limit?: number
  offset?: number
}

// M4: replace body dengan
//   `api.get<LargeStaleFileResponse[]>('/files/large-stale', { params: { type, sort, limit, offset } })`.
// Endpoint adalah on-demand query — tombol "Scan ulang" di UI call function
// ini lagi (re-evaluate), bukan trigger async scan operation.
export async function listLargeStaleFiles(
  params: ListLargeStaleParams = {},
): Promise<ListLargeStaleResult> {
  const { type = "all", sort = "size_desc", limit = 50, offset = 0 } = params
  await simulateDelay(600)

  const response = getMockLargeStaleResponse()
  let files = response.data.map(mapFile)

  if (type !== "all") {
    files = files.filter((file) => categorizeFileType(file.mimeType) === type)
  }

  files.sort((a, b) => compareFiles(a, b, sort))

  const total = files.length
  const sliced = files.slice(offset, offset + limit)

  return {
    files: sliced,
    total,
    snapshotAt: response.meta.snapshot_at,
    thresholds: response.meta.thresholds,
  }
}

// Re-run on-demand query (UI label "Scan ulang"), bukan async scan job.
// Mock cuma update timestamp supaya snapshot terbaru.
export async function refreshLargeStale(): Promise<void> {
  await simulateDelay(600)
  applyMockLargeStaleRefresh()
}

// M4: replace dengan `api.delete('/files/batch', { file_ids })` — shared
// endpoint dengan Feature 4.
export async function batchDeleteFiles(fileIds: string[]): Promise<BatchDeleteResult> {
  await simulateDelay(700)
  const result = applyMockLargeStaleBatchDelete(fileIds)
  return {
    deleted: result.deleted.map((entry) => ({
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
