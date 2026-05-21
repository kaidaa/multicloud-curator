import { api } from "@/shared/api/client"
import { waitForOperation } from "@/shared/api/operations"

export type DuplicateTypeFilter =
  | "all"
  | "photo"
  | "video"
  | "document"
  | "audio"
  | "other"

export type Provider = "google" | "dropbox"

interface DuplicateMemberResponse {
  id: string
  file_id: string
  name: string
  size_bytes: number | null
  modified_at: string
  account_id: string
  account_email: string
  provider: Provider
  is_owned: boolean
  deletable: boolean
  deletable_reason: string | null
  path: string | null
  mime_type: string | null
  type: string
  web_view_link: string | null
}

interface DuplicateGroupResponse {
  id: string
  representative_name: string
  members_count: number
  total_size_bytes: number
  match_basis: "hash" | "name_size"
  members: DuplicateMemberResponse[]
}

interface DuplicatesScanResponse {
  operation_id: string
  operation_type: "duplicates_scan"
  status: "queued" | "running"
}

interface BatchDeleteSuccessResponse {
  id: string
  success: true
}

interface BatchDeleteFailureResponse {
  id: string
  success: false
  error_code: string
  message: string
}

interface BatchDeleteResponse {
  deleted: BatchDeleteSuccessResponse[]
  failed: BatchDeleteFailureResponse[]
}

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
  mimeType: string | null
  type: string
  webViewLink: string | null
}

export interface DuplicateGroup {
  id: string
  representativeName: string
  membersCount: number
  totalSizeBytes: number
  members: DuplicateMember[]
}

export interface ListDuplicateGroupsResult {
  groups: DuplicateGroup[]
  total: number
  scanAt: string | null
}

export interface BatchDeleteEntry {
  id: string
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
    sizeBytes: raw.size_bytes ?? 0,
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

export interface ListDuplicatesParams {
  type?: DuplicateTypeFilter
  limit?: number
  offset?: number
}

export async function listDuplicateGroups(
  params: ListDuplicatesParams = {},
): Promise<ListDuplicateGroupsResult> {
  const { type = "all", limit = 50, offset = 0 } = params
  const response = await api.get<DuplicateGroupResponse[]>("/duplicates", {
    params: { type, limit, offset },
  })

  return {
    groups: response.data.map(mapGroup),
    total:
      typeof response.meta?.pagination?.total === "number"
        ? response.meta.pagination.total
        : response.data.length,
    scanAt:
      typeof response.meta?.scan_at === "string"
        ? response.meta.scan_at
        : null,
  }
}

export async function scanDuplicates(): Promise<void> {
  const response = await api.post<DuplicatesScanResponse>("/scan/duplicates")
  await waitForOperation(response.data.operation_id)
}

export async function batchDeleteFiles(ids: string[]): Promise<BatchDeleteResult> {
  const response = await api.post<BatchDeleteResponse>("/files/batch-delete", {
    ids,
  })
  return {
    deleted: response.data.deleted.map((entry) => ({
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
