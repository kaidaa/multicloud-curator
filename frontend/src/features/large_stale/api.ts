import { api } from "@/shared/api/client"
import { parseScanCoverage, type ScanCoverage } from "@/shared/api/coverage"
import type { LocationType } from "@/shared/files/location"

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
export type LargeStaleProviderFilter = "all" | Provider
export type LargeStaleCategoryFilter = "all" | "large" | "stale"

export type TriggerReason = "large" | "stale" | "both"

export interface LargeStaleThresholds {
  large_percent_of_quota: number
  stale_months: number
}

interface LargeStaleFileResponse {
  id: string
  file_id: string
  name: string
  type: string
  mime_type: string | null
  size_bytes: number | null
  modified_at: string | null
  modified_age_months: number
  account_id: string
  account_email: string
  provider: Provider
  is_owned: boolean
  deletable: boolean
  deletable_reason: string | null
  trigger_reason: TriggerReason
  path: string | null
  location_type: LocationType | null
  open_url: string | null
  open_url_type: string | null
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

interface LargeStaleScanResponse {
  operation_type: "large_stale_scan"
  scan_at: string
  total: number
}

export interface LargeStaleFile {
  id: string
  fileId: string
  name: string
  type: string
  mimeType: string | null
  sizeBytes: number
  modifiedAt: string | null
  modifiedAgeMonths: number
  accountId: string
  accountEmail: string
  provider: Provider
  isOwned: boolean
  deletable: boolean
  deletableReason: string | null
  triggerReason: TriggerReason
  path: string | null
  locationType: LocationType | null
  openUrl: string | null
  openUrlType: string | null
}

export interface ListLargeStaleResult {
  files: LargeStaleFile[]
  total: number
  snapshotAt: string | null
  thresholds: LargeStaleThresholds
  coverage: ScanCoverage | null
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

function mapFile(raw: LargeStaleFileResponse): LargeStaleFile {
  return {
    id: raw.id,
    fileId: raw.file_id,
    name: raw.name,
    type: raw.type,
    mimeType: raw.mime_type,
    sizeBytes: raw.size_bytes ?? 0,
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
    locationType: raw.location_type,
    openUrl: raw.open_url,
    openUrlType: raw.open_url_type,
  }
}

function parseThresholds(value: unknown): LargeStaleThresholds {
  if (!value || typeof value !== "object") {
    return { large_percent_of_quota: 0.5, stale_months: 12 }
  }
  const raw = value as Partial<LargeStaleThresholds>
  return {
    large_percent_of_quota:
      typeof raw.large_percent_of_quota === "number"
        ? raw.large_percent_of_quota
        : 0.5,
    stale_months:
      typeof raw.stale_months === "number" ? raw.stale_months : 12,
  }
}

export interface ListLargeStaleParams {
  type?: LargeStaleTypeFilter
  provider?: LargeStaleProviderFilter
  category?: LargeStaleCategoryFilter
  sort?: LargeStaleSort
  limit?: number
  offset?: number
}

export async function listLargeStaleFiles(
  params: ListLargeStaleParams = {},
): Promise<ListLargeStaleResult> {
  const {
    type = "all",
    provider = "all",
    category = "all",
    sort = "size_desc",
    limit = 50,
    offset = 0,
  } = params
  const response = await api.get<LargeStaleFileResponse[]>("/files/large-stale", {
    params: { type, provider, category, sort, limit, offset },
  })
  const pagination = response.meta?.pagination

  return {
    files: response.data.map(mapFile),
    total:
      typeof pagination?.total === "number"
        ? pagination.total
        : response.data.length,
    snapshotAt:
      typeof response.meta?.scan_at === "string"
        ? response.meta.scan_at
        : typeof response.meta?.snapshot_at === "string"
          ? response.meta.snapshot_at
          : null,
    thresholds: parseThresholds(response.meta?.thresholds),
    coverage: parseScanCoverage(response.meta?.coverage),
  }
}

export async function scanLargeStaleFiles(): Promise<void> {
  await api.post<LargeStaleScanResponse>("/scan/large-stale")
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
