import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type { Account } from "@/features/accounts/api"
import { useAccountsContext } from "@/shared/contexts/AccountsContext"
import { GlobalAccountLoadIndicator } from "@/shared/components/GlobalAccountLoadIndicator"

vi.mock("@/shared/contexts/AccountsContext", () => ({
  useAccountsContext: vi.fn(),
}))

const mockUseAccountsContext = vi.mocked(useAccountsContext)

function account(id: string, status: Account["status"]): Account {
  return {
    id,
    provider: "google",
    email: `${id}@example.com`,
    status,
    quotaUsedBytes: 10,
    quotaTotalBytes: 100,
    lastSyncAt: null,
    lastGoodSyncAt: null,
    dataState: status === "active" ? "Lengkap" : "Parsial",
  }
}

describe("GlobalAccountLoadIndicator", () => {
  it("keeps showing a global failure state for load_failed accounts", () => {
    mockUseAccountsContext.mockReturnValue({
      accounts: [account("acc-1", "load_failed")],
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

    render(<GlobalAccountLoadIndicator />)

    expect(screen.getByText("1 akun gagal dimuat")).toBeInTheDocument()
  })

  it("counts queued loading accounts from the lifecycle overlay", () => {
    mockUseAccountsContext.mockReturnValue({
      accounts: [account("acc-1", "active"), account("acc-2", "active")],
      isLoading: false,
      isRefreshingAll: false,
      error: null,
      snapshotAt: null,
      globalRefreshVersion: 0,
      loadingAccountIds: ["acc-1", "acc-2"],
      refetch: vi.fn(),
      connectAccount: vi.fn(),
      refreshAccount: vi.fn(),
      refreshAllAccounts: vi.fn(),
      reauthorizeAccount: vi.fn(),
      disconnectAccount: vi.fn(),
    })

    render(<GlobalAccountLoadIndicator />)

    expect(screen.getByText("2 akun sedang dimuat")).toBeInTheDocument()
  })
})
