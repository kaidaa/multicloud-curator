// Shape snake_case mirror Interface Contract §5.1. `trigger_reason` wajib
// dirender di UI sebagai badge. `match_basis`-style metadata tidak ada
// di endpoint ini (berbeda dengan Duplicates).
export interface LargeStaleFileResponse {
  id: string
  file_id: string
  name: string
  type: string
  mime_type: string
  size_bytes: number
  modified_at: string
  modified_age_months: number
  account_id: string
  account_email: string
  provider: "google" | "dropbox"
  is_owned: boolean
  deletable: boolean
  deletable_reason: string | null
  trigger_reason: "large" | "stale" | "both"
  path: string | null
  web_view_link: string | null
}

export interface LargeStaleThresholds {
  large_percent_of_quota: number
  stale_months: number
}

export interface LargeStaleEnvelopeMeta {
  snapshot_at: string | null
  thresholds: LargeStaleThresholds
  pagination: {
    limit: number
    offset: number
    total: number
  }
}

export interface LargeStaleResponse {
  data: LargeStaleFileResponse[]
  meta: LargeStaleEnvelopeMeta
}

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000
const MONTH = 30 * DAY

function isoFromOffset(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString()
}

const INITIAL_SCAN_AT = isoFromOffset(45 * 60 * 1000)

const INITIAL_THRESHOLDS: LargeStaleThresholds = {
  large_percent_of_quota: 0.5,
  stale_months: 12,
}

const initialFiles: LargeStaleFileResponse[] = [
  {
    id: "lst-001",
    file_id: "fil-lst-001",
    name: "backup_database_old.sql",
    type: "sql",
    mime_type: "application/sql",
    size_bytes: 891_289_600,
    modified_at: isoFromOffset(52 * MONTH),
    modified_age_months: 52,
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    deletable: true,
    deletable_reason: null,
    trigger_reason: "both",
    path: "1FolderArchive",
    web_view_link: "https://drive.google.com/file/d/fil-lst-001/view",
  },
  {
    id: "lst-002",
    file_id: "fil-lst-002",
    name: "Video Kuliah 2023 - Full.mp4",
    type: "mp4",
    mime_type: "video/mp4",
    size_bytes: 1_287_654_400,
    modified_at: isoFromOffset(26 * MONTH),
    modified_age_months: 26,
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    deletable: true,
    deletable_reason: null,
    trigger_reason: "both",
    path: "1FolderVideos",
    web_view_link: "https://drive.google.com/file/d/fil-lst-002/view",
  },
  {
    id: "lst-003",
    file_id: "fil-lst-003",
    name: "ISO Ubuntu 22.04.iso",
    type: "iso",
    mime_type: "application/x-iso9660-image",
    size_bytes: 4_831_838_208,
    modified_at: isoFromOffset(8 * MONTH),
    modified_age_months: 8,
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    deletable: true,
    deletable_reason: null,
    trigger_reason: "large",
    path: "1FolderDownloads",
    web_view_link: "https://drive.google.com/file/d/fil-lst-003/view",
  },
  {
    id: "lst-004",
    file_id: "fil-lst-004",
    name: "Rekaman Webinar Mei 2024.mp4",
    type: "mp4",
    mime_type: "video/mp4",
    size_bytes: 398_458_880,
    modified_at: isoFromOffset(14 * MONTH),
    modified_age_months: 14,
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    deletable: true,
    deletable_reason: null,
    trigger_reason: "both",
    path: "1FolderWebinars",
    web_view_link: "https://drive.google.com/file/d/fil-lst-004/view",
  },
  {
    id: "lst-005",
    file_id: "fil-lst-005",
    name: "Archive Foto 2022.zip",
    type: "zip",
    mime_type: "application/zip",
    size_bytes: 47_185_920,
    modified_at: isoFromOffset(38 * MONTH),
    modified_age_months: 38,
    account_id: "acc-7f3a-002",
    account_email: "rifki.work@outlook.com",
    provider: "dropbox",
    is_owned: true,
    deletable: false,
    deletable_reason: "Akun perlu otorisasi ulang sebelum file bisa dihapus",
    trigger_reason: "both",
    path: "/Personal/Archive",
    web_view_link: "https://www.dropbox.com/home/Personal/Archive",
  },
  {
    id: "lst-006",
    file_id: "fil-lst-006",
    name: "Skripsi Bab 1 Lama.docx",
    type: "docx",
    mime_type:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: 389_120,
    modified_at: isoFromOffset(18 * MONTH),
    modified_age_months: 18,
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    deletable: true,
    deletable_reason: null,
    trigger_reason: "stale",
    path: "1FolderTA",
    web_view_link: "https://drive.google.com/file/d/fil-lst-006/view",
  },
  {
    id: "lst-007",
    file_id: "fil-lst-007",
    name: "Catatan Kuliah Lama.md",
    type: "md",
    mime_type: "text/markdown",
    size_bytes: 28_672,
    modified_at: isoFromOffset(24 * MONTH),
    modified_age_months: 24,
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    deletable: true,
    deletable_reason: null,
    trigger_reason: "stale",
    path: "1FolderNotes",
    web_view_link: "https://drive.google.com/file/d/fil-lst-007/view",
  },
]

// Mutable in-memory state — pattern sama dengan mockAccountsState dan
// mockDuplicateGroupsState. Refresh + batch delete bekerja terhadap array
// ini sehingga UI behavior persistent dalam 1 sesi browser.
let mockLargeStaleState: LargeStaleFileResponse[] = initialFiles.map((file) => ({
  ...file,
}))

let mockLargeStaleScanAt: string | null = INITIAL_SCAN_AT

export function getMockLargeStaleResponse(): LargeStaleResponse {
  return {
    data: mockLargeStaleState.map((file) => ({ ...file })),
    meta: {
      snapshot_at: mockLargeStaleScanAt,
      thresholds: INITIAL_THRESHOLDS,
      pagination: {
        limit: 50,
        offset: 0,
        total: mockLargeStaleState.length,
      },
    },
  }
}

// Trigger "Scan ulang" mock — re-evaluate on-demand. Tidak menambah/menghapus
// kandidat, hanya memperbarui timestamp supaya UI dapat sinyal evaluasi
// selesai. Technical layer: bukan async scan operation.
export function applyMockLargeStaleRefresh(): void {
  mockLargeStaleScanAt = new Date().toISOString()
}

export interface BatchDeleteResultEntry {
  file_id: string
  success: boolean
  error_code?: string
  message?: string
}

export interface BatchDeleteResult {
  deleted: BatchDeleteResultEntry[]
  failed: BatchDeleteResultEntry[]
}

export function applyMockLargeStaleBatchDelete(fileIds: string[]): BatchDeleteResult {
  const deleted: BatchDeleteResultEntry[] = []
  const failed: BatchDeleteResultEntry[] = []
  const idsToDelete = new Set<string>()

  for (const fileId of fileIds) {
    const found = mockLargeStaleState.find((file) => file.file_id === fileId)
    if (!found) {
      failed.push({
        file_id: fileId,
        success: false,
        error_code: "not_found",
        message: "File tidak ditemukan di hasil scan saat ini",
      })
      continue
    }
    if (!found.deletable) {
      failed.push({
        file_id: fileId,
        success: false,
        error_code: "not_deletable",
        message: found.deletable_reason ?? "File tidak dapat dihapus",
      })
      continue
    }
    deleted.push({ file_id: fileId, success: true })
    idsToDelete.add(fileId)
  }

  mockLargeStaleState = mockLargeStaleState.filter(
    (file) => !idsToDelete.has(file.file_id),
  )

  return { deleted, failed }
}

export function __resetMockLargeStale(): void {
  mockLargeStaleState = initialFiles.map((file) => ({ ...file }))
  mockLargeStaleScanAt = INITIAL_SCAN_AT
}
