import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  listAccounts,
  refreshAllAccounts as apiRefreshAllAccounts,
  startRefreshAccount,
  type Account,
  type RefreshAllOperation,
} from "@/features/accounts/api"
import {
  OperationFailedError,
  waitForOperation,
  type OperationResponse,
} from "@/shared/api/operations"
import {
  AccountsProvider,
  useAccountsContext,
} from "@/shared/contexts/AccountsContext"
import { isAccountEffectivelyLoading } from "@/shared/utils/accountLifecycle"

vi.mock("@/features/accounts/api", () => ({
  connectAccount: vi.fn(),
  disconnectAccount: vi.fn(),
  listAccounts: vi.fn(),
  reauthorizeAccount: vi.fn(),
  refreshAllAccounts: vi.fn(),
  startRefreshAccount: vi.fn(),
}))

vi.mock("@/shared/api/operations", () => {
  class MockOperationFailedError extends Error {
    constructor(public readonly operation: OperationResponse) {
      super(operation.error_message || "Operasi gagal diproses.")
      this.name = "OperationFailedError"
    }
  }

  return {
    OperationFailedError: MockOperationFailedError,
    waitForOperation: vi.fn(),
  }
})

const mockListAccounts = vi.mocked(listAccounts)
const mockRefreshAllAccounts = vi.mocked(apiRefreshAllAccounts)
const mockStartRefreshAccount = vi.mocked(startRefreshAccount)
const mockWaitForOperation = vi.mocked(waitForOperation)

function account(id: string, status: Account["status"] = "active"): Account {
  return {
    id,
    provider: "google",
    email: `${id}@example.com`,
    status,
    quotaUsedBytes: 10,
    quotaTotalBytes: 100,
    lastSyncAt: null,
    lastGoodSyncAt: status === "active" ? "2026-01-01T00:00:00Z" : null,
    dataState: status === "active" ? "Lengkap" : "Parsial",
  }
}

function refreshOperation(accountId: string, operationId: string): RefreshAllOperation {
  return {
    accountId,
    operationId,
    operationType: "refresh",
    status: "queued",
  }
}

function operationResponse(
  operationId: string,
  status: OperationResponse["status"] = "completed",
): OperationResponse {
  return {
    operation_id: operationId,
    operation_type: "refresh",
    status,
    started_at: "2026-01-01T00:00:00Z",
    completed_at: status === "queued" || status === "running" ? null : "2026-01-01T00:00:01Z",
    progress: null,
    context: null,
    error_message: status === "failed" ? "Provider gagal" : null,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function labelFor(accountItem: Account, loadingAccountIds: string[]) {
  if (isAccountEffectivelyLoading(accountItem, loadingAccountIds)) {
    return "Memuat data"
  }
  if (accountItem.status === "load_failed") {
    return "Gagal memuat"
  }
  if (accountItem.status === "active") {
    return "Aktif"
  }
  return accountItem.status
}

function Probe() {
  const accountsApi = useAccountsContext()
  const loadingLabelCount = accountsApi.accounts.filter((accountItem) =>
    isAccountEffectivelyLoading(accountItem, accountsApi.loadingAccountIds),
  ).length

  return (
    <div>
      <div data-testid="indicator-count">{accountsApi.loadingAccountIds.length}</div>
      <div data-testid="loading-label-count">{loadingLabelCount}</div>
      {accountsApi.accounts.map((accountItem) => (
        <div key={accountItem.id} data-testid={`account-${accountItem.id}`}>
          {labelFor(accountItem, accountsApi.loadingAccountIds)}
        </div>
      ))}
      <button
        type="button"
        onClick={() => {
          void accountsApi.refreshAllAccounts()
        }}
      >
        Refresh all
      </button>
      <button
        type="button"
        onClick={() => {
          void accountsApi.refreshAccount("acc-1").catch(() => undefined)
        }}
      >
        Retry acc-1
      </button>
    </div>
  )
}

function renderProbe() {
  return render(
    <AccountsProvider>
      <Probe />
    </AccountsProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("AccountsProvider loading overlay", () => {
  it("keeps refresh-all queued accounts loading and decrements monotonically per finished operation", async () => {
    const user = userEvent.setup()
    let accounts = [account("acc-1"), account("acc-2"), account("acc-3")]
    const operations = [
      refreshOperation("acc-1", "op-1"),
      refreshOperation("acc-2", "op-2"),
      refreshOperation("acc-3", "op-3"),
    ]
    const waits = {
      "op-1": deferred<OperationResponse>(),
      "op-2": deferred<OperationResponse>(),
      "op-3": deferred<OperationResponse>(),
    }

    mockListAccounts.mockImplementation(async () => ({
      accounts,
      snapshotAt: null,
    }))
    mockRefreshAllAccounts.mockResolvedValue(operations)
    mockWaitForOperation.mockImplementation((operationId) => {
      return waits[operationId as keyof typeof waits].promise
    })

    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("0")
    })

    await user.click(screen.getByRole("button", { name: /refresh all/i }))

    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("3")
      expect(screen.getByTestId("loading-label-count")).toHaveTextContent("3")
    })
    expect(screen.getByTestId("account-acc-2")).toHaveTextContent("Memuat data")

    await act(async () => {
      waits["op-1"].resolve(operationResponse("op-1"))
    })
    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("2")
      expect(screen.getByTestId("loading-label-count")).toHaveTextContent("2")
    })

    await act(async () => {
      waits["op-2"].resolve(operationResponse("op-2"))
    })
    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("1")
      expect(screen.getByTestId("loading-label-count")).toHaveTextContent("1")
    })

    accounts = accounts.map((item) => ({ ...item, status: "active" }))
    await act(async () => {
      waits["op-3"].resolve(operationResponse("op-3"))
    })
    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("0")
      expect(screen.getByTestId("loading-label-count")).toHaveTextContent("0")
    })
  })

  it("removes failed loading operations from the overlay and shows failed state", async () => {
    const user = userEvent.setup()
    let accounts = [account("acc-1", "load_failed")]
    const retryOperation = refreshOperation("acc-1", "retry-op")
    const retryWait = deferred<OperationResponse>()

    mockListAccounts.mockImplementation(async () => ({
      accounts,
      snapshotAt: null,
    }))
    mockStartRefreshAccount.mockResolvedValue(retryOperation)
    mockWaitForOperation.mockReturnValue(retryWait.promise)

    renderProbe()

    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("0")
      expect(screen.getByTestId("account-acc-1")).toHaveTextContent("Gagal memuat")
    })

    await user.click(screen.getByRole("button", { name: /retry acc-1/i }))

    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("1")
      expect(screen.getByTestId("loading-label-count")).toHaveTextContent("1")
      expect(screen.getByTestId("account-acc-1")).toHaveTextContent("Memuat data")
    })

    accounts = [account("acc-1", "load_failed")]
    await act(async () => {
      retryWait.reject(new OperationFailedError(operationResponse("retry-op", "failed")))
    })

    await waitFor(() => {
      expect(screen.getByTestId("indicator-count")).toHaveTextContent("0")
      expect(screen.getByTestId("loading-label-count")).toHaveTextContent("0")
      expect(screen.getByTestId("account-acc-1")).toHaveTextContent("Gagal memuat")
    })
  })
})
