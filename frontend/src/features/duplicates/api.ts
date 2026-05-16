import { simulateDelay } from "@/shared/api/mocks/accounts"
import {
  applyMockBatchDelete,
  applyMockScanRefresh,
  getMockGroupsResponse,
  type DuplicateGroupResponse,
  type DuplicateMemberResponse,
} from "@/shared/api/mocks/duplicates"

export type DuplicateTypeFilter =
  | "all"
  | "photo"
  | "video"
  | "document"
  | "audio"
  | "other"

export type Provider = "google" | "dropbox"

export interface DuplicateMember {
  id: string
  fileId: string
  name: string
  sizeBytes: number
  modifiedAt: string
  accountId: string
  accountEmail: string
  provider: Provider
  isOwned: boolean
  deletable: boolean
  deletableReason: string | null
  path: string | null
  mimeType: string
  type: string
  webViewLink: string | null
}

export interface DuplicateGroup {
  id: string
  representativeName: string
  membersCount: number
  totalSizeBytes: number
  // match_basis sengaja tidak dimuat ke shape camelCase frontend karena
  // tidak boleh dirender ke UI (FPS §2.6). Backend tetap kirim field-nya
  // di response, mapper sengaja drop.
  members: DuplicateMember[]
}

export interface ListDuplicateGroupsResult {
  groups: DuplicateGroup[]
  total: number
  scanAt: string | null
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

function mapMember(raw: DuplicateMemberResponse): DuplicateMember {
  return {
    id: raw.id,
    fileId: raw.file_id,
    name: raw.name,
    sizeBytes: raw.size_bytes,
    modifiedAt: raw.modified_at,
    accountId: raw.account_id,
    accountEmail: raw.account_email,
    provider: raw.provider,
    isOwned: raw.is_owned,
    deletable: raw.deletable,
    deletableReason: raw.deletable_reason,
    path: raw.path,
    mimeType: raw.mime_type,
    type: raw.type,
    webViewLink: raw.web_view_link,
  }
}

function mapGroup(raw: DuplicateGroupResponse): DuplicateGroup {
  return {
    id: raw.id,
    representativeName: raw.representative_name,
    membersCount: raw.members_count,
    totalSizeBytes: raw.total_size_bytes,
    members: raw.members.map(mapMember),
  }
}

// Logic duplikasi singkat dari Feature 3 (sengaja inline untuk strict
// no-touch boundary Feature 3 per arahan Kai). Konsisten dengan mapping
// Interface Contract §3.2.
function categorizeFileType(mimeType: string): DuplicateTypeFilter {
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

export interface ListDuplicatesParams {
  type?: DuplicateTypeFilter
  limit?: number
  offset?: number
}

// M4: replace body dengan
//   `api.get<DuplicateGroupResponse[]>('/duplicates', { params: { type, limit, offset } })`.
// Mapper dan signature dipertahankan.
export async function listDuplicateGroups(
  params: ListDuplicatesParams = {},
): Promise<ListDuplicateGroupsResult> {
  const { type = "all", limit = 50, offset = 0 } = params
  await simulateDelay(600)

  const response = getMockGroupsResponse()
  let groups = response.data.map(mapGroup)

  if (type !== "all") {
    groups = groups.filter((group) => {
      // Filter berdasar member pertama (mengikuti spec implementasi backend
      // §3.3). Grup hanya muncul jika ada member yang tipe-nya match.
      const firstMember = group.members[0]
      if (!firstMember) return false
      return categorizeFileType(firstMember.mimeType) === type
    })
  }

  const total = groups.length
  const sliced = groups.slice(offset, offset + limit)

  return {
    groups: sliced,
    total,
    scanAt: response.meta && "scan_at" in response.meta
      ? (response.meta.scan_at as string | null)
      : null,
  }
}

// M4: replace dengan `api.post('/scan/duplicates')` + polling
// `api.get('/operations/{operation_id}')` sampai status completed.
// Saat ini mock cukup delay 1.5s lalu refresh timestamp.
export async function scanDuplicates(): Promise<void> {
  await simulateDelay(1500)
  applyMockScanRefresh()
}

// M4: replace dengan `api.delete('/files/batch', { file_ids })`. Response
// shape sama (deleted + failed arrays). Mapper convert ke camelCase.
export async function batchDeleteFiles(fileIds: string[]): Promise<BatchDeleteResult> {
  await simulateDelay(700)
  const result = applyMockBatchDelete(fileIds)
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
