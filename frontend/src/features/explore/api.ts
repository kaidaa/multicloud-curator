import {
  mockActivityFiles,
  mockActivityResponse,
  type FileResponse,
} from "@/shared/api/mocks/files"
import { simulateDelay } from "@/shared/api/mocks/accounts"

export type Provider = "google" | "dropbox"

export interface ActivityFile {
  id: string
  fileId: string
  name: string
  type: string
  mimeType: string
  sizeBytes: number | null
  modifiedAt: string
  accountId: string
  accountEmail: string
  provider: Provider
  isOwned: boolean
  path: string | null
  webViewLink: string | null
}

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

export interface ActivityResult {
  files: ActivityFile[]
  snapshotAt: string | null
}

// Backend filter activity dengan join ke accounts dan skip account yang
// belum pernah sync. Di mock, simulasi dengan menerima daftar account_id
// yang sudah punya data (caller pass dari AccountsContext).
//
// M4: replace body dengan `api.get<FileResponse[]>('/files/activity?limit=...')`.
// Backend yang melakukan filtering, parameter accountIds tidak dikirim — itu
// hanya untuk mock simulation.
export async function listActivity(
  options: { limit?: number; eligibleAccountIds?: Set<string> } = {},
): Promise<ActivityResult> {
  const { limit = 10, eligibleAccountIds } = options
  await simulateDelay(450)
  const filtered = eligibleAccountIds
    ? mockActivityFiles.filter((f) => eligibleAccountIds.has(f.account_id))
    : mockActivityFiles
  return {
    files: filtered.slice(0, limit).map(mapFileResponse),
    snapshotAt: mockActivityResponse.meta?.snapshot_at ?? null,
  }
}
