import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import type { Account } from "@/features/accounts/api"
import { AccountRow } from "@/features/accounts/components/AccountRow"

const baseAccount: Account = {
  id: "acc-1",
  provider: "google",
  email: "kai@example.com",
  status: "active",
  quotaUsedBytes: 10,
  quotaTotalBytes: 100,
  lastSyncAt: null,
  lastGoodSyncAt: null,
  dataState: "Lengkap",
}

describe("AccountRow", () => {
  it("shows a failed-load badge and retry action without routine refresh", async () => {
    const user = userEvent.setup()
    const onRetryLoad = vi.fn().mockResolvedValue(undefined)
    const onRefresh = vi.fn().mockResolvedValue(undefined)

    render(
      <table>
        <tbody>
          <AccountRow
            account={{ ...baseAccount, status: "load_failed", dataState: "Parsial" }}
            onRefresh={onRefresh}
            onRetryLoad={onRetryLoad}
            onReauthorize={vi.fn().mockResolvedValue(undefined)}
            onDisconnect={vi.fn()}
          />
        </tbody>
      </table>,
    )

    expect(screen.getByText("Gagal memuat")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /coba lagi/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^refresh$/i })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /coba lagi/i }))

    expect(onRetryLoad).toHaveBeenCalledWith("acc-1")
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it("shows queued active accounts as loading without routine refresh", () => {
    render(
      <table>
        <tbody>
          <AccountRow
            account={baseAccount}
            isLoading
            onRefresh={vi.fn().mockResolvedValue(undefined)}
            onRetryLoad={vi.fn().mockResolvedValue(undefined)}
            onReauthorize={vi.fn().mockResolvedValue(undefined)}
            onDisconnect={vi.fn()}
          />
        </tbody>
      </table>,
    )

    expect(screen.getByText("Memuat data")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^refresh$/i })).not.toBeInTheDocument()
  })
})
