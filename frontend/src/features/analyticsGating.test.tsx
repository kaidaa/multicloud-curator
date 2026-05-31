import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { Account } from "@/features/accounts/api"
import { listDuplicateGroups, type DuplicateGroup } from "@/features/duplicates/api"
import { DuplicatesUiStateProvider } from "@/features/duplicates/contexts/DuplicatesUiStateContext"
import { DuplicatesPage } from "@/features/duplicates/pages/DuplicatesPage"
import { listLargeStaleFiles, type LargeStaleFile } from "@/features/large_stale/api"
import { LargeStaleUiStateProvider } from "@/features/large_stale/contexts/LargeStaleUiStateContext"
import { LargeStalePage } from "@/features/large_stale/pages/LargeStalePage"
import { listPublicFiles, type SecurityFile } from "@/features/security/api"
import { SecurityUiStateProvider } from "@/features/security/contexts/SecurityUiStateContext"
import { SecurityPage } from "@/features/security/pages/SecurityPage"
import { useAccountsContext } from "@/shared/contexts/AccountsContext"
import { ToastProvider } from "@/shared/hooks/useToast"

vi.mock("@/shared/contexts/AccountsContext", () => ({
  useAccountsContext: vi.fn(),
}))

vi.mock("@/features/duplicates/api", () => ({
  batchDeleteFiles: vi.fn(),
  listDuplicateGroups: vi.fn(),
  scanDuplicates: vi.fn(),
}))

vi.mock("@/features/security/api", () => ({
  batchRevokeFiles: vi.fn(),
  listPublicFiles: vi.fn(),
  scanSecurity: vi.fn(),
}))

vi.mock("@/features/large_stale/api", () => ({
  batchDeleteFiles: vi.fn(),
  listLargeStaleFiles: vi.fn(),
  scanLargeStaleFiles: vi.fn(),
}))

const activeAccount: Account = {
  id: "acc-1",
  provider: "google",
  email: "kai@example.com",
  status: "active",
  quotaUsedBytes: 10,
  quotaTotalBytes: 100,
  lastSyncAt: null,
  lastGoodSyncAt: "2026-01-01T00:00:00Z",
  dataState: "Lengkap",
}

const secondActiveAccount: Account = {
  ...activeAccount,
  id: "acc-2",
  email: "baru@example.com",
}

const loadingAccount: Account = {
  ...secondActiveAccount,
  status: "syncing",
}

const storedDuplicateGroup: DuplicateGroup = {
  id: "dup-1",
  representativeName: "KTP_scan.pdf",
  membersCount: 2,
  totalSizeBytes: 2000,
  members: [
    {
      id: "file-1",
      fileId: "provider-file-1",
      name: "KTP_scan.pdf",
      sizeBytes: 1000,
      modifiedAt: "2026-01-01T00:00:00Z",
      accountId: "acc-1",
      accountEmail: "kai@example.com",
      provider: "google",
      isOwned: true,
      deletable: true,
      deletableReason: null,
      path: null,
      locationType: "MY_DRIVE",
      mimeType: "application/pdf",
      type: "document",
      openUrl: null,
      openUrlType: null,
    },
    {
      id: "file-2",
      fileId: "provider-file-2",
      name: "KTP_scan_copy.pdf",
      sizeBytes: 1000,
      modifiedAt: "2026-01-01T00:00:00Z",
      accountId: "acc-1",
      accountEmail: "kai@example.com",
      provider: "google",
      isOwned: true,
      deletable: true,
      deletableReason: null,
      path: null,
      locationType: "MY_DRIVE",
      mimeType: "application/pdf",
      type: "document",
      openUrl: null,
      openUrlType: null,
    },
  ],
}

const storedSecurityFile: SecurityFile = {
  id: "sec-1",
  fileId: "provider-sec-1",
  name: "KTP_publik.pdf",
  type: "document",
  mimeType: "application/pdf",
  sizeBytes: 1000,
  modifiedAt: "2026-01-01T00:00:00Z",
  accountId: "acc-1",
  accountEmail: "kai@example.com",
  provider: "google",
  isSensitive: true,
  matchedKeywords: ["KTP"],
  isOwned: true,
  deletable: true,
  deletableReason: null,
  path: null,
  locationType: "MY_DRIVE",
  openUrl: null,
  openUrlType: null,
}

const storedLargeStaleFile: LargeStaleFile = {
  id: "lst-1",
  fileId: "provider-large-1",
  name: "Backup lama.zip",
  type: "zip",
  mimeType: "application/zip",
  sizeBytes: 1000,
  modifiedAt: "2024-01-01T00:00:00Z",
  modifiedAgeMonths: 24,
  accountId: "acc-1",
  accountEmail: "kai@example.com",
  provider: "google",
  isOwned: true,
  deletable: true,
  deletableReason: null,
  triggerReason: "both",
  path: "/Work",
  locationType: null,
  openUrl: null,
  openUrlType: null,
}

const mockUseAccountsContext = vi.mocked(useAccountsContext)
const mockListDuplicateGroups = vi.mocked(listDuplicateGroups)
const mockListPublicFiles = vi.mocked(listPublicFiles)
const mockListLargeStaleFiles = vi.mocked(listLargeStaleFiles)

function renderDuplicatesPage() {
  return render(
    <ToastProvider>
      <DuplicatesUiStateProvider>
        <DuplicatesPage />
      </DuplicatesUiStateProvider>
    </ToastProvider>,
  )
}

function renderSecurityPage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SecurityUiStateProvider>
          <SecurityPage />
        </SecurityUiStateProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function renderLargeStalePage() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <LargeStaleUiStateProvider>
          <LargeStalePage />
        </LargeStaleUiStateProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function mockAccounts(accounts: Account[]) {
  mockUseAccountsContext.mockReturnValue({
    accounts,
    isLoading: false,
    isRefreshingAll: false,
    error: null,
    snapshotAt: null,
    globalRefreshVersion: 0,
    loadingAccountIds: [],
    refetch: vi.fn(),
    connectAccount: vi.fn(),
    refreshAccount: vi.fn(),
    refreshAllAccounts: vi.fn(),
    reauthorizeAccount: vi.fn(),
    disconnectAccount: vi.fn(),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAccounts([activeAccount])
  mockListDuplicateGroups.mockResolvedValue({
    groups: [],
    total: 0,
    scanAt: null,
    coverage: null,
  })
  mockListPublicFiles.mockResolvedValue({
    files: [],
    scanAt: null,
    coverage: null,
  })
  mockListLargeStaleFiles.mockResolvedValue({
    files: [],
    total: 0,
    snapshotAt: null,
    thresholds: {
      large_percent_of_quota: 0.5,
      stale_months: 12,
    },
    coverage: null,
  })
})

describe("analytics stored scan gating", () => {
  it("shows stored duplicate results after a fresh render", async () => {
    mockListDuplicateGroups.mockResolvedValue({
      groups: [storedDuplicateGroup],
      total: 1,
      scanAt: "2026-01-02T00:00:00Z",
      coverage: null,
    })

    const { unmount } = renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText("KTP_scan.pdf")).toBeInTheDocument()
    })

    unmount()
    renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText("KTP_scan.pdf")).toBeInTheDocument()
    })

    expect(mockListDuplicateGroups).toHaveBeenCalledTimes(2)
  })

  it("shows duplicate empty state only when no stored result exists", async () => {
    renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText("Belum ada hasil scan")).toBeInTheDocument()
    })

    expect(mockListDuplicateGroups).toHaveBeenCalled()
    expect(screen.queryByText("Scan ulang")).not.toBeInTheDocument()
  })

  it("shows stored security results after a fresh render", async () => {
    mockListPublicFiles.mockResolvedValue({
      files: [storedSecurityFile],
      scanAt: "2026-01-02T00:00:00Z",
      coverage: null,
    })

    const { unmount } = renderSecurityPage()

    await waitFor(() => {
      expect(screen.getByText("KTP_publik.pdf")).toBeInTheDocument()
    })

    unmount()
    renderSecurityPage()

    await waitFor(() => {
      expect(screen.getByText("KTP_publik.pdf")).toBeInTheDocument()
    })

    expect(mockListPublicFiles).toHaveBeenCalledTimes(2)
  })

  it("does not treat an empty scanned sensitive mode as never scanned", async () => {
    mockListPublicFiles.mockResolvedValue({
      files: [],
      scanAt: "2026-01-02T00:00:00Z",
      coverage: null,
    })

    renderSecurityPage()

    await waitFor(() => {
      expect(screen.getByText("Tidak ada file publik yang perlu ditinjau")).toBeInTheDocument()
    })

    expect(screen.queryByText("Belum ada audit keamanan")).not.toBeInTheDocument()
    expect(screen.queryByText("Scan ulang")).toBeInTheDocument()
  })

  it("does not show stored scan results when all accounts are disconnected", async () => {
    mockAccounts([])
    mockListDuplicateGroups.mockResolvedValue({
      groups: [storedDuplicateGroup],
      total: 1,
      scanAt: "2026-01-02T00:00:00Z",
      coverage: null,
    })
    mockListPublicFiles.mockResolvedValue({
      files: [storedSecurityFile],
      scanAt: "2026-01-02T00:00:00Z",
      coverage: null,
    })

    const { unmount } = renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText("Belum ada akun dengan data lengkap")).toBeInTheDocument()
    })
    expect(screen.queryByText("KTP_scan.pdf")).not.toBeInTheDocument()
    expect(mockListDuplicateGroups).not.toHaveBeenCalled()

    unmount()
    renderSecurityPage()

    await waitFor(() => {
      expect(screen.getByText("Belum ada akun terhubung")).toBeInTheDocument()
    })
    expect(screen.queryByText("KTP_publik.pdf")).not.toBeInTheDocument()
    expect(mockListPublicFiles).not.toHaveBeenCalled()
  })

  it("shows factual coverage ratio when stored duplicate scan covered fewer accounts than the snapshot", async () => {
    mockListDuplicateGroups.mockResolvedValue({
      groups: [storedDuplicateGroup],
      total: 1,
      scanAt: "2026-01-02T00:00:00Z",
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 2,
      },
    })

    renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText(/Hasil scan ini mencakup/)).toHaveTextContent(
        "Hasil scan ini mencakup 1 dari 2 akun",
      )
    })
  })

  it("shows staleness nudge after a new active account is outside duplicate scan coverage", async () => {
    mockAccounts([activeAccount, secondActiveAccount])
    mockListDuplicateGroups.mockResolvedValue({
      groups: [storedDuplicateGroup],
      total: 1,
      scanAt: "2026-01-02T00:00:00Z",
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 1,
      },
    })

    renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText("Belum mencakup akun terbaru")).toBeInTheDocument()
    })
  })

  it("does not show staleness nudge while a new account is still loading", async () => {
    mockAccounts([activeAccount, loadingAccount])
    mockListDuplicateGroups.mockResolvedValue({
      groups: [storedDuplicateGroup],
      total: 1,
      scanAt: "2026-01-02T00:00:00Z",
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 1,
      },
    })

    renderDuplicatesPage()

    await waitFor(() => {
      expect(screen.getByText("KTP_scan.pdf")).toBeInTheDocument()
    })
    expect(screen.queryByText("Belum mencakup akun terbaru")).not.toBeInTheDocument()
  })

  it("shows factual coverage ratio for stored security scan results", async () => {
    mockListPublicFiles.mockResolvedValue({
      files: [storedSecurityFile],
      scanAt: "2026-01-02T00:00:00Z",
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 2,
      },
    })

    renderSecurityPage()

    await waitFor(() => {
      expect(screen.getByText(/Hasil scan ini mencakup/)).toHaveTextContent(
        "Hasil scan ini mencakup 1 dari 2 akun",
      )
    })
  })

  it("shows stored large-stale results after a fresh render", async () => {
    mockListLargeStaleFiles.mockResolvedValue({
      files: [storedLargeStaleFile],
      total: 1,
      snapshotAt: "2026-01-02T00:00:00Z",
      thresholds: {
        large_percent_of_quota: 0.5,
        stale_months: 12,
      },
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 1,
      },
    })

    const { unmount } = renderLargeStalePage()

    await waitFor(() => {
      expect(screen.getByText("Backup lama.zip")).toBeInTheDocument()
    })

    unmount()
    renderLargeStalePage()

    await waitFor(() => {
      expect(screen.getByText("Backup lama.zip")).toBeInTheDocument()
    })

    expect(mockListLargeStaleFiles).toHaveBeenCalledTimes(2)
  })

  it("keeps stored large-stale results visible after a new active account appears", async () => {
    mockAccounts([activeAccount, secondActiveAccount])
    mockListLargeStaleFiles.mockResolvedValue({
      files: [storedLargeStaleFile],
      total: 1,
      snapshotAt: "2026-01-02T00:00:00Z",
      thresholds: {
        large_percent_of_quota: 0.5,
        stale_months: 12,
      },
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 1,
      },
    })

    renderLargeStalePage()

    await waitFor(() => {
      expect(screen.getByText("Backup lama.zip")).toBeInTheDocument()
    })
    expect(screen.getByText("Belum mencakup akun terbaru")).toBeInTheDocument()
  })

  it("treats an empty stored large-stale scan as scanned, not never scanned", async () => {
    mockListLargeStaleFiles.mockResolvedValue({
      files: [],
      total: 0,
      snapshotAt: "2026-01-02T00:00:00Z",
      thresholds: {
        large_percent_of_quota: 0.5,
        stale_months: 12,
      },
      coverage: {
        coveredAccountIds: ["acc-1"],
        coveredAccountCount: 1,
        eligibleAccountCount: 1,
      },
    })

    renderLargeStalePage()

    await waitFor(() => {
      expect(screen.getByText("Tidak ada file besar atau usang")).toBeInTheDocument()
    })
    expect(screen.queryByText("Belum ada hasil scan")).not.toBeInTheDocument()
  })

  it("does not show stored large-stale results when all accounts are disconnected", async () => {
    mockAccounts([])
    mockListLargeStaleFiles.mockResolvedValue({
      files: [storedLargeStaleFile],
      total: 1,
      snapshotAt: "2026-01-02T00:00:00Z",
      thresholds: {
        large_percent_of_quota: 0.5,
        stale_months: 12,
      },
      coverage: null,
    })

    renderLargeStalePage()

    await waitFor(() => {
      expect(screen.getByText("Belum ada akun terhubung")).toBeInTheDocument()
    })
    expect(screen.queryByText("Backup lama.zip")).not.toBeInTheDocument()
    expect(mockListLargeStaleFiles).not.toHaveBeenCalled()
  })
})
