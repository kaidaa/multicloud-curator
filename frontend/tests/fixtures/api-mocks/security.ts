// Shape snake_case mirror Interface Contract §6.2. `path` dan `open_url`
// belum di-cantumkan eksplisit di contract — pending clarification untuk M4
// karena UI butuh keduanya (lokasi + tombol "Buka file" mandatory).
export interface SecurityFileResponse {
  id: string
  file_id: string
  name: string
  type: string
  mime_type: string
  size_bytes: number
  modified_at: string
  account_id: string
  account_email: string
  provider: "google" | "dropbox"
  is_sensitive: boolean
  matched_keywords: string[]
  deletable: boolean
  deletable_reason: string | null
  path: string | null
  open_url: string | null
}

export interface SecurityResponse {
  data: SecurityFileResponse[]
  meta: {
    scan_at: string | null
    coverage: {
      covered_account_ids: string[]
      covered_account_count: number
      eligible_account_count: number
    }
  }
}

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000

function isoFromOffset(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString()
}

const INITIAL_SCAN_AT = isoFromOffset(35 * 60 * 1000)

const initialFiles: SecurityFileResponse[] = [
  {
    id: "sec-001",
    file_id: "fil-sec-001",
    name: "KTP_andi.pdf",
    type: "pdf",
    mime_type: "application/pdf",
    size_bytes: 854_320,
    modified_at: isoFromOffset(45 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_sensitive: true,
    matched_keywords: ["KTP"],
    deletable: true,
    deletable_reason: null,
    path: "1FolderArchive",
    open_url: "https://drive.google.com/file/d/fil-sec-001/view",
  },
  {
    id: "sec-002",
    file_id: "fil-sec-002",
    name: "NPWP_2024.xlsx",
    type: "xlsx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size_bytes: 421_876,
    modified_at: isoFromOffset(28 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_sensitive: true,
    matched_keywords: ["NPWP"],
    deletable: true,
    deletable_reason: null,
    path: "1FolderFinance",
    open_url: "https://drive.google.com/file/d/fil-sec-002/view",
  },
  {
    id: "sec-003",
    file_id: "fil-sec-003",
    name: "BPJS_kartu.jpg",
    type: "jpg",
    mime_type: "image/jpeg",
    size_bytes: 1_245_678,
    modified_at: isoFromOffset(60 * DAY),
    account_id: "acc-7f3a-002",
    account_email: "rifki.work@outlook.com",
    provider: "dropbox",
    is_sensitive: true,
    matched_keywords: ["BPJS"],
    deletable: false,
    deletable_reason: "Akun perlu otorisasi ulang sebelum akses publik bisa dicabut",
    path: "/Personal/Documents",
    open_url: "https://www.dropbox.com/home/Personal/Documents",
  },
  {
    id: "sec-004",
    file_id: "fil-sec-004",
    name: "Surat Pengantar 2024.pdf",
    type: "pdf",
    mime_type: "application/pdf",
    size_bytes: 287_120,
    modified_at: isoFromOffset(18 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_sensitive: false,
    matched_keywords: [],
    deletable: true,
    deletable_reason: null,
    path: "1FolderArchive",
    open_url: "https://drive.google.com/file/d/fil-sec-004/view",
  },
  {
    id: "sec-005",
    file_id: "fil-sec-005",
    name: "Pricelist Public.pdf",
    type: "pdf",
    mime_type: "application/pdf",
    size_bytes: 612_354,
    modified_at: isoFromOffset(8 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_sensitive: false,
    matched_keywords: [],
    deletable: true,
    deletable_reason: null,
    path: "1FolderMarketing",
    open_url: "https://drive.google.com/file/d/fil-sec-005/view",
  },
  {
    id: "sec-006",
    file_id: "fil-sec-006",
    name: "KTP_npwp_data.zip",
    type: "zip",
    mime_type: "application/zip",
    size_bytes: 2_340_120,
    modified_at: isoFromOffset(75 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_sensitive: true,
    matched_keywords: ["KTP", "NPWP"],
    deletable: true,
    deletable_reason: null,
    path: "1FolderArchive",
    open_url: "https://drive.google.com/file/d/fil-sec-006/view",
  },
]

// Mutable in-memory state — pattern sama dengan mockAccountsState dan
// mockDuplicateGroupsState. Saat revoke sukses, file di-remove dari state
// supaya saat refetch tidak muncul lagi (mirror backend behavior: update
// sharing_status = "private" + remove scan_result entry).
let mockSecurityFilesState: SecurityFileResponse[] = initialFiles.map((file) => ({
  ...file,
  matched_keywords: [...file.matched_keywords],
}))

let mockSecurityScanAt: string | null = INITIAL_SCAN_AT

export type SecurityMode = "sensitive" | "public"

export function getMockSecurityResponse(mode: SecurityMode): SecurityResponse {
  const filtered =
    mode === "sensitive"
      ? mockSecurityFilesState.filter((f) => f.is_sensitive)
      : mockSecurityFilesState

  return {
    data: filtered.map((file) => ({
      ...file,
      matched_keywords: [...file.matched_keywords],
    })),
    meta: {
      scan_at: mockSecurityScanAt,
      coverage: {
        covered_account_ids: ["acc-7f3a-001", "acc-7f3a-002"],
        covered_account_count: 2,
        eligible_account_count: 2,
      },
    },
  }
}

// "Scan ulang" mock: tidak menambah file, hanya update timestamp.
export function applyMockSecurityScanRefresh(): void {
  mockSecurityScanAt = new Date().toISOString()
}

export interface BatchRevokeResultEntry {
  file_id: string
  success: boolean
  error_code?: string
  message?: string
}

export interface BatchRevokeResult {
  revoked: BatchRevokeResultEntry[]
  failed: BatchRevokeResultEntry[]
}

export function applyMockBatchRevoke(fileIds: string[]): BatchRevokeResult {
  const revoked: BatchRevokeResultEntry[] = []
  const failed: BatchRevokeResultEntry[] = []
  const idsToRevoke = new Set<string>()

  for (const fileId of fileIds) {
    const found = mockSecurityFilesState.find((f) => f.file_id === fileId)
    if (!found) {
      failed.push({
        file_id: fileId,
        success: false,
        error_code: "not_found",
        message: "File tidak ditemukan di hasil audit saat ini",
      })
      continue
    }
    if (!found.deletable) {
      failed.push({
        file_id: fileId,
        success: false,
        error_code: "not_deletable",
        message: found.deletable_reason ?? "Akses tidak dapat dicabut",
      })
      continue
    }
    revoked.push({ file_id: fileId, success: true })
    idsToRevoke.add(fileId)
  }

  // File yang sukses dicabut di-remove dari state supaya tidak muncul lagi
  // saat refetch (mirror backend: sharing_status → private + scan_result
  // entry dihapus).
  mockSecurityFilesState = mockSecurityFilesState.filter(
    (file) => !idsToRevoke.has(file.file_id),
  )

  return { revoked, failed }
}

export function __resetMockSecurity(): void {
  mockSecurityFilesState = initialFiles.map((file) => ({
    ...file,
    matched_keywords: [...file.matched_keywords],
  }))
  mockSecurityScanAt = INITIAL_SCAN_AT
}
