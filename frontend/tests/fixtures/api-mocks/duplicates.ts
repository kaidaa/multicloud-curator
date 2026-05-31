import type { ApiResponse, EnvelopeMeta } from "@/shared/api/types"

// Member entity dalam grup duplikat. Snake_case sesuai Interface Contract §4.2.
// match_basis dan deletable_reason dijaga di mock supaya shape identik dengan
// payload M4, tapi match_basis sengaja TIDAK dirender ke UI (FPS §2.6).
export interface DuplicateMemberResponse {
  id: string
  file_id: string
  name: string
  size_bytes: number
  modified_at: string
  account_id: string
  account_email: string
  provider: "google" | "dropbox"
  is_owned: boolean
  deletable: boolean
  deletable_reason: string | null
  path: string | null
  mime_type: string
  type: string
  open_url: string | null
}

export interface DuplicateGroupResponse {
  id: string
  representative_name: string
  members_count: number
  total_size_bytes: number
  match_basis: "hash" | "name_size"
  members: DuplicateMemberResponse[]
}

interface DuplicatesEnvelopeMeta extends EnvelopeMeta {
  scan_at: string | null
  coverage: {
    covered_account_ids: string[]
    covered_account_count: number
    eligible_account_count: number
  }
}

const NOW = Date.now()
const DAY = 24 * 60 * 60 * 1000
const MONTH = 30 * DAY

function isoFromOffset(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString()
}

// Initial scan timestamp — sengaja sedikit lebih lama dari "now" supaya
// label "Scan terakhir" terlihat realistis sebagai snapshot data.
const INITIAL_SCAN_AT = isoFromOffset(2 * 60 * 60 * 1000)

const initialGroups: DuplicateGroupResponse[] = [
  {
    id: "dup-grp-001",
    representative_name: "KTP_scan.pdf",
    members_count: 2,
    total_size_bytes: 1_750_000,
    match_basis: "hash",
    members: [
      {
        id: "dup-mem-001-a",
        file_id: "fil-dup-001-a",
        name: "KTP_scan_lama.pdf",
        size_bytes: 870_000,
        modified_at: isoFromOffset(14 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderArchive",
        mime_type: "application/pdf",
        type: "pdf",
        open_url: "https://drive.google.com/file/d/fil-dup-001-a/view",
      },
      {
        id: "dup-mem-001-b",
        file_id: "fil-dup-001-b",
        name: "KTP_scan.pdf",
        size_bytes: 880_000,
        modified_at: isoFromOffset(8 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderProjects",
        mime_type: "application/pdf",
        type: "pdf",
        open_url: "https://drive.google.com/file/d/fil-dup-001-b/view",
      },
    ],
  },
  {
    id: "dup-grp-002",
    representative_name: "IMG_20240615_134522.jpg",
    members_count: 3,
    total_size_bytes: 11_400_000,
    match_basis: "hash",
    members: [
      {
        id: "dup-mem-002-a",
        file_id: "fil-dup-002-a",
        name: "IMG_20240615_134522.jpg",
        size_bytes: 3_800_000,
        modified_at: isoFromOffset(11 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderPhotos",
        mime_type: "image/jpeg",
        type: "jpg",
        open_url: "https://drive.google.com/file/d/fil-dup-002-a/view",
      },
      {
        id: "dup-mem-002-b",
        file_id: "fil-dup-002-b",
        name: "IMG_20240615_134522 (1).jpg",
        size_bytes: 3_800_000,
        modified_at: isoFromOffset(9 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderPhotos",
        mime_type: "image/jpeg",
        type: "jpg",
        open_url: "https://drive.google.com/file/d/fil-dup-002-b/view",
      },
      {
        id: "dup-mem-002-c",
        file_id: "fil-dup-002-c",
        name: "IMG_20240615_134522.jpg",
        size_bytes: 3_800_000,
        modified_at: isoFromOffset(10 * MONTH),
        account_id: "acc-7f3a-002",
        account_email: "rifki.work@outlook.com",
        provider: "dropbox",
        is_owned: false,
        deletable: false,
        deletable_reason: "Tidak dapat dihapus (file shared dari akun lain)",
        path: "/Shared/Personal",
        mime_type: "image/jpeg",
        type: "jpg",
        open_url: "https://www.dropbox.com/home/Shared/Personal",
      },
    ],
  },
  {
    id: "dup-grp-003",
    representative_name: "Notulensi Rapat Bulanan.docx",
    members_count: 2,
    total_size_bytes: 90_000,
    match_basis: "name_size",
    members: [
      {
        id: "dup-mem-003-a",
        file_id: "fil-dup-003-a",
        name: "Notulensi Rapat Bulanan.docx",
        size_bytes: 45_000,
        modified_at: isoFromOffset(3 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderMeetings",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        type: "docx",
        open_url: "https://drive.google.com/file/d/fil-dup-003-a/view",
      },
      {
        id: "dup-mem-003-b",
        file_id: "fil-dup-003-b",
        name: "Notulensi Rapat Bulanan.docx",
        size_bytes: 45_000,
        modified_at: isoFromOffset(3 * MONTH - 2 * DAY),
        account_id: "acc-7f3a-002",
        account_email: "rifki.work@outlook.com",
        provider: "dropbox",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "/Work/Meetings",
        mime_type:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        type: "docx",
        open_url: "https://www.dropbox.com/home/Work/Meetings",
      },
    ],
  },
  {
    id: "dup-grp-004",
    representative_name: "Screenshot 2024-08-12.png",
    members_count: 4,
    total_size_bytes: 2_400_000,
    match_basis: "hash",
    members: [
      {
        id: "dup-mem-004-a",
        file_id: "fil-dup-004-a",
        name: "Screenshot 2024-08-12.png",
        size_bytes: 600_000,
        modified_at: isoFromOffset(9 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderScreenshots",
        mime_type: "image/png",
        type: "png",
        open_url: "https://drive.google.com/file/d/fil-dup-004-a/view",
      },
      {
        id: "dup-mem-004-b",
        file_id: "fil-dup-004-b",
        name: "Screenshot 2024-08-12 (1).png",
        size_bytes: 600_000,
        modified_at: isoFromOffset(8 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderScreenshots",
        mime_type: "image/png",
        type: "png",
        open_url: "https://drive.google.com/file/d/fil-dup-004-b/view",
      },
      {
        id: "dup-mem-004-c",
        file_id: "fil-dup-004-c",
        name: "Screenshot 2024-08-12 - Copy.png",
        size_bytes: 600_000,
        modified_at: isoFromOffset(7 * MONTH),
        account_id: "acc-7f3a-001",
        account_email: "rifki.kaida@gmail.com",
        provider: "google",
        is_owned: true,
        deletable: true,
        deletable_reason: null,
        path: "1FolderDownloads",
        mime_type: "image/png",
        type: "png",
        open_url: "https://drive.google.com/file/d/fil-dup-004-c/view",
      },
      {
        id: "dup-mem-004-d",
        file_id: "fil-dup-004-d",
        name: "Screenshot 2024-08-12.png",
        size_bytes: 600_000,
        modified_at: isoFromOffset(7 * MONTH - 4 * DAY),
        account_id: "acc-7f3a-002",
        account_email: "rifki.work@outlook.com",
        provider: "dropbox",
        is_owned: true,
        deletable: false,
        deletable_reason:
          "Akun perlu otorisasi ulang sebelum file bisa dihapus",
        path: "/Personal/Screenshots",
        mime_type: "image/png",
        type: "png",
        open_url: "https://www.dropbox.com/home/Personal/Screenshots",
      },
    ],
  },
]

// Mutable mock state — copy mendalam supaya seed asli tidak berubah saat
// batch delete atau scan refresh. Pattern sama dengan mockAccountsState
// di mocks/accounts.ts.
let mockGroupsState: DuplicateGroupResponse[] = initialGroups.map((group) => ({
  ...group,
  members: group.members.map((member) => ({ ...member })),
}))

let mockScanAt: string | null = INITIAL_SCAN_AT

export function getMockGroupsResponse(): ApiResponse<DuplicateGroupResponse[]> {
  const meta: DuplicatesEnvelopeMeta = {
    scan_at: mockScanAt,
    coverage: {
      covered_account_ids: ["acc-7f3a-001", "acc-7f3a-002"],
      covered_account_count: 2,
      eligible_account_count: 2,
    },
    pagination: {
      limit: 50,
      offset: 0,
      total: mockGroupsState.length,
    },
  }
  return {
    data: mockGroupsState.map((group) => ({
      ...group,
      members: group.members.map((member) => ({ ...member })),
    })),
    meta,
  }
}

export function getMockScanAt(): string | null {
  return mockScanAt
}

// Mock "scan ulang": tidak menambah grup baru, hanya update timestamp
// supaya UI dapat sinyal scan selesai. M4 backend yang menghitung ulang.
export function applyMockScanRefresh(): void {
  mockScanAt = new Date().toISOString()
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

// Filter file_ids dari mockGroupsState. File yang ditemukan dan deletable
// masuk `deleted`; sisanya masuk `failed`. Setelah delete, cleanup grup
// yang member-nya tersisa < 2.
export function applyMockBatchDelete(fileIds: string[]): BatchDeleteResult {
  const deleted: BatchDeleteResultEntry[] = []
  const failed: BatchDeleteResultEntry[] = []
  const idsToDelete = new Set<string>()

  for (const fileId of fileIds) {
    let foundMember: DuplicateMemberResponse | undefined
    for (const group of mockGroupsState) {
      foundMember = group.members.find((m) => m.file_id === fileId)
      if (foundMember) break
    }
    if (!foundMember) {
      failed.push({
        file_id: fileId,
        success: false,
        error_code: "not_found",
        message: "File tidak ditemukan di hasil scan saat ini",
      })
      continue
    }
    if (!foundMember.deletable) {
      failed.push({
        file_id: fileId,
        success: false,
        error_code: "not_deletable",
        message: foundMember.deletable_reason ?? "File tidak dapat dihapus",
      })
      continue
    }
    deleted.push({ file_id: fileId, success: true })
    idsToDelete.add(fileId)
  }

  mockGroupsState = mockGroupsState
    .map((group) => {
      const remaining = group.members.filter((m) => !idsToDelete.has(m.file_id))
      return {
        ...group,
        members: remaining,
        members_count: remaining.length,
        total_size_bytes: remaining.reduce((sum, m) => sum + m.size_bytes, 0),
      }
    })
    .filter((group) => group.members.length >= 2)

  return { deleted, failed }
}

// Helper utility untuk test/debug — reset mock kembali ke seed awal. Tidak
// dipanggil dari UI produksi.
export function __resetMockDuplicates(): void {
  mockGroupsState = initialGroups.map((group) => ({
    ...group,
    members: group.members.map((member) => ({ ...member })),
  }))
  mockScanAt = INITIAL_SCAN_AT
}
