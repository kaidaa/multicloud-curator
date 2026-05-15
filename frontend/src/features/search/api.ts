import type { ActivityFile, Provider } from "@/features/explore/api"
import { simulateDelay } from "@/shared/api/mocks/accounts"
import {
  mockSearchableFiles,
  type FileResponse,
} from "@/shared/api/mocks/files"

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

export const DEFAULT_SEARCH_LIMIT = 50
export const MIN_SEARCH_QUERY_LENGTH = 2

function mapFileResponse(raw: FileResponse): ActivityFile {
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

function categorizeFileType(file: FileResponse): SearchTypeFilter {
  const mime = file.mime_type.toLowerCase()
  if (mime.startsWith("image/")) return "photo"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  if (mime === "application/pdf") return "document"
  if (mime.startsWith("application/vnd.openxmlformats-officedocument")) return "document"
  if (mime.startsWith("application/vnd.google-apps")) return "document"
  if (mime.startsWith("text/")) return "document"
  return "other"
}

function matchQuery(file: FileResponse, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  const haystack = `${file.name} ${file.path ?? ""}`.toLowerCase()
  return haystack.includes(normalizedQuery)
}

function compareFiles(a: FileResponse, b: FileResponse, sort: SearchSort): number {
  switch (sort) {
    case "modified_asc":
      return new Date(a.modified_at).getTime() - new Date(b.modified_at).getTime()
    case "name_asc":
      return a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" })
    case "modified_desc":
    default:
      return new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime()
  }
}

const MOCK_SNAPSHOT_AT = new Date().toISOString()

// M4: replace body dengan
//   `api.get<FileResponse[]>('/files/search', { params: { q, owned_only, provider, type, sort, limit, offset } })`
// kemudian map snake_case→camelCase pakai mapFileResponse. Signature
// SearchParams/SearchResult dipertahankan supaya consumer (useSearch + page)
// tidak perlu diubah.
export async function searchFiles(params: SearchParams): Promise<SearchResult> {
  await simulateDelay(350)

  const normalizedQuery = params.query.trim().toLowerCase()

  let candidates = mockSearchableFiles.filter((file) => matchQuery(file, normalizedQuery))

  if (params.ownedOnly) {
    candidates = candidates.filter((f) => f.is_owned)
  }
  if (params.provider !== "all") {
    candidates = candidates.filter((f) => f.provider === params.provider)
  }
  if (params.fileType !== "all") {
    candidates = candidates.filter((f) => categorizeFileType(f) === params.fileType)
  }

  candidates.sort((a, b) => compareFiles(a, b, params.sort))

  const total = candidates.length
  const sliced = candidates.slice(params.offset, params.offset + params.limit)

  return {
    files: sliced.map(mapFileResponse),
    total,
    snapshotAt: MOCK_SNAPSHOT_AT,
  }
}
