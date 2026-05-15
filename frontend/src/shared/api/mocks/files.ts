import type { ApiResponse } from "@/shared/api/types"

export interface FileResponse {
  id: string
  file_id: string
  name: string
  type: string
  mime_type: string
  size_bytes: number | null
  modified_at: string
  account_id: string
  account_email: string
  provider: "google" | "dropbox"
  is_owned: boolean
  path: string | null
  web_view_link: string | null
}

// Snapshot waktu untuk activity mock. Dibuat relatif terhadap "now" supaya
// label "2 jam lalu" tetap masuk akal kapanpun aplikasi dibuka.
const NOW = Date.now()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function isoFromOffset(msAgo: number): string {
  return new Date(NOW - msAgo).toISOString()
}

// Referensi account_id mengikuti seed di mocks/accounts.ts. Saat user
// connect akun baru atau disconnect, mock activity tidak ikut berubah —
// expected di M2 karena activity adalah snapshot data yang sudah ada di DB.
export const mockActivityFiles: FileResponse[] = [
  {
    id: "fil-act-001",
    file_id: "1AbcGoogle001",
    name: "Laporan Keuangan Q1 2026.xlsx",
    type: "xlsx",
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size_bytes: 824320,
    modified_at: isoFromOffset(2 * HOUR),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderProjects",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle001/view",
  },
  {
    id: "fil-act-002",
    file_id: "1AbcGoogle002",
    name: "Skripsi_Bab4_v3.docx",
    type: "docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size_bytes: 1547821,
    modified_at: isoFromOffset(8 * HOUR),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderTA",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle002/view",
  },
  {
    id: "fil-act-003",
    file_id: "id:dropbox.invoice.2026.001",
    name: "Invoice INV-202604-001.pdf",
    type: "pdf",
    mime_type: "application/pdf",
    size_bytes: 312504,
    modified_at: isoFromOffset(DAY + 4 * HOUR),
    account_id: "acc-7f3a-002",
    account_email: "rifki.work@outlook.com",
    provider: "dropbox",
    is_owned: true,
    path: "/Work/Invoices",
    web_view_link: "https://www.dropbox.com/home/Work/Invoices",
  },
  {
    id: "fil-act-004",
    file_id: "1AbcGoogle004",
    name: "Pitch Deck Aksara Digital v2.pptx",
    type: "pptx",
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size_bytes: 6843900,
    modified_at: isoFromOffset(2 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderProjects",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle004/view",
  },
  {
    id: "fil-act-005",
    file_id: "1AbcGoogle005",
    name: "screenshot_dashboard_2026-04.png",
    type: "png",
    mime_type: "image/png",
    size_bytes: 458123,
    modified_at: isoFromOffset(3 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderScreenshots",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle005/view",
  },
  {
    id: "fil-act-006",
    file_id: "id:dropbox.notes.0001",
    name: "catatan_meeting_klien.md",
    type: "md",
    mime_type: "text/markdown",
    size_bytes: 12450,
    modified_at: isoFromOffset(4 * DAY),
    account_id: "acc-7f3a-002",
    account_email: "rifki.work@outlook.com",
    provider: "dropbox",
    is_owned: true,
    path: "/Work/Notes",
    web_view_link: "https://www.dropbox.com/home/Work/Notes",
  },
  {
    id: "fil-act-007",
    file_id: "1AbcGoogle007",
    name: "Foto Pernikahan Adit Sarah.zip",
    type: "zip",
    mime_type: "application/zip",
    size_bytes: 487329810,
    modified_at: isoFromOffset(5 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderArchive",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle007/view",
  },
  {
    id: "fil-act-008",
    file_id: "id:dropbox.bukti.0001",
    name: "bukti_transfer_pajak.jpg",
    type: "jpg",
    mime_type: "image/jpeg",
    size_bytes: 2153890,
    modified_at: isoFromOffset(6 * DAY),
    account_id: "acc-7f3a-002",
    account_email: "rifki.work@outlook.com",
    provider: "dropbox",
    is_owned: true,
    path: "/Work/Finance",
    web_view_link: "https://www.dropbox.com/home/Work/Finance",
  },
  {
    id: "fil-act-009",
    file_id: "1AbcGoogle009",
    name: "presentasi_onboarding.pptx",
    type: "pptx",
    mime_type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size_bytes: 4732190,
    modified_at: isoFromOffset(13 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderProjects",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle009/view",
  },
  {
    id: "fil-act-010",
    file_id: "1AbcGoogle010",
    name: "README.md",
    type: "md",
    mime_type: "text/markdown",
    size_bytes: 4823,
    modified_at: isoFromOffset(22 * DAY),
    account_id: "acc-7f3a-001",
    account_email: "rifki.kaida@gmail.com",
    provider: "google",
    is_owned: true,
    path: "1FolderTA",
    web_view_link: "https://drive.google.com/file/d/1AbcGoogle010/view",
  },
]

export const mockActivityResponse: ApiResponse<FileResponse[]> = {
  data: mockActivityFiles,
  meta: { snapshot_at: new Date(NOW).toISOString() },
}
