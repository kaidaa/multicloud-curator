import {
  mapFileResponse,
  type ActivityFile,
  type FileResponse,
  type Provider,
} from "@/features/explore/api"
import { api } from "@/shared/api/client"

export type SearchSort = "modified_desc" | "modified_asc" | "name_asc"
export type SearchProviderFilter = "all" | Provider
export type SearchTypeFilter = "all" | "photo" | "video" | "document" | "audio" | "other"

export interface SearchParams {
  query: string
  ownedOnly: boolean
  provider: SearchProviderFilter
  fileType: SearchTypeFilter
  sort: SearchSort
  limit: number
  offset: number
}

export interface SearchResult {
  files: ActivityFile[]
  total: number
  snapshotAt: string | null
}

export const DEFAULT_SEARCH_LIMIT = 10
export const MIN_SEARCH_QUERY_LENGTH = 2

export async function searchFiles(
  params: SearchParams,
  options: { signal?: AbortSignal } = {},
): Promise<SearchResult> {
  const query = params.query.trim()
  if (query.length < MIN_SEARCH_QUERY_LENGTH) {
    return { files: [], total: 0, snapshotAt: null }
  }

  const response = await api.get<FileResponse[]>("/files/search", {
    params: {
      q: query,
      owned_only: params.ownedOnly,
      provider: params.provider,
      type: params.fileType,
      sort: params.sort,
      limit: params.limit,
      offset: params.offset,
    },
    signal: options.signal,
  })

  const pagination = response.meta?.pagination
  return {
    files: response.data.map(mapFileResponse),
    total:
      typeof pagination?.total === "number"
        ? pagination.total
        : response.data.length,
    snapshotAt: response.meta?.snapshot_at ?? null,
  }
}
