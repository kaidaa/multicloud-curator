import { useMemo, useState } from "react"
import { Plugs, Plus, WarningCircle } from "@phosphor-icons/react"

import type { Account, Provider } from "@/features/accounts/api"
import { AccountRow } from "@/features/accounts/components/AccountRow"
import { ConnectProviderModal } from "@/features/accounts/components/ConnectProviderModal"
import { DisconnectConfirmModal } from "@/features/accounts/components/DisconnectConfirmModal"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import { EmptyState } from "@/shared/components/EmptyState"
import { Skeleton } from "@/shared/components/LoadingState"
import { getErrorMessage } from "@/shared/api/errors"
import { useToast } from "@/shared/hooks/useToast"

const TABLE_HEAD_CLASS =
  "px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted"

function AccountsTableHead() {
  return (
    <thead className="border-b border-line">
      <tr>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Provider</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Email</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Status koneksi</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Kuota terpakai/total</th>
        <th className={`${TABLE_HEAD_CLASS} text-left`}>Sinkronisasi terakhir</th>
        <th className={`${TABLE_HEAD_CLASS} text-right`}>Aksi</th>
      </tr>
    </thead>
  )
}

export function AccountsPage() {
  const accountsApi = useAccounts()
  const { pushToast } = useToast()
  const [connectOpen, setConnectOpen] = useState(false)
  const [disconnectTarget, setDisconnectTarget] = useState<Account | null>(null)

  const problemAccounts = useMemo(
    () =>
      accountsApi.accounts.filter(
        (a) => a.status === "token_invalid" || a.status === "revoked",
      ),
    [accountsApi.accounts],
  )

  async function handleConnect(provider: Provider) {
    try {
      const newAccount = await accountsApi.connectAccount(provider)
      setConnectOpen(false)
      pushToast(
        `Akun ${newAccount.email} terhubung. Picu refresh untuk memuat metadata.`,
        "success",
      )
    } catch (err) {
      pushToast(getErrorMessage(err), "error")
    }
  }

  async function handleRefresh(accountId: string) {
    try {
      await accountsApi.refreshAccount(accountId)
      pushToast("Metadata akun berhasil dimuat.", "success")
    } catch (err) {
      pushToast(getErrorMessage(err), "error")
    }
  }

  async function handleReauthorize(accountId: string) {
    try {
      await accountsApi.reauthorizeAccount(accountId)
      pushToast("Otorisasi akun berhasil diperbarui.", "success")
    } catch (err) {
      pushToast(getErrorMessage(err), "error")
    }
  }

  async function handleDisconnect(accountId: string) {
    const target = accountsApi.accounts.find((a) => a.id === accountId)
    try {
      await accountsApi.disconnectAccount(accountId)
      pushToast(
        target ? `Akun ${target.email} diputuskan.` : "Akun diputuskan.",
        "success",
      )
    } catch (err) {
      pushToast(getErrorMessage(err), "error")
    }
  }

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Pengaturan</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">Akun Terhubung</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Kelola akun cloud storage yang dipakai sistem untuk membaca metadata. File asli tetap berada di penyedia masing-masing.
        </p>
      </header>

      {problemAccounts.length > 0 && !accountsApi.isLoading && (
        <div className="mt-6 flex items-start gap-3 rounded-[--radius-sm] border border-warning-strong/20 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            {problemAccounts.length} akun perlu otorisasi ulang:{" "}
            {problemAccounts.map((a, idx) => (
              <span key={a.id}>
                <strong className="font-semibold">{a.email}</strong>
                {idx < problemAccounts.length - 1 ? ", " : ""}
              </span>
            ))}
            . Beberapa aksi mungkin tidak tersedia untuk file dari akun tersebut.
          </p>
        </div>
      )}

      <section className="mt-8">
        {accountsApi.isLoading && (
          <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <AccountsTableHead />
                <tbody>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3"><Skeleton className="h-7 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-44" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-7 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                      <td className="px-4 py-3"><Skeleton className="ml-auto h-7 w-40" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!accountsApi.isLoading && accountsApi.error && (
          <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
            <p className="font-medium">Gagal memuat daftar akun.</p>
            <p className="mt-1 text-xs">{accountsApi.error}</p>
            <button
              type="button"
              onClick={() => void accountsApi.refetch()}
              className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
            >
              Coba lagi
            </button>
          </div>
        )}

        {!accountsApi.isLoading &&
          !accountsApi.error &&
          accountsApi.accounts.length === 0 && (
            <EmptyState
              icon={<Plugs size={28} weight="duotone" />}
              title="Belum ada akun terhubung"
              description="Tambahkan akun untuk memulai agregasi metadata. File tetap berada di penyedia asli."
              action={
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong"
                >
                  <Plus size={16} weight="bold" />
                  <span>Hubungkan akun pertama</span>
                </button>
              }
            />
          )}

        {!accountsApi.isLoading && !accountsApi.error && accountsApi.accounts.length > 0 && (
          <>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setConnectOpen(true)}
                className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong"
              >
                <Plus size={16} weight="bold" />
                <span>Tambah akun</span>
              </button>
            </div>
            <div className="overflow-hidden rounded-[--radius] border border-line bg-panel">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <AccountsTableHead />
                  <tbody>
                    {accountsApi.accounts.map((account) => (
                      <AccountRow
                        key={account.id}
                        account={account}
                        onRefresh={handleRefresh}
                        onReauthorize={handleReauthorize}
                        onDisconnect={(accountId) => {
                          const target = accountsApi.accounts.find((a) => a.id === accountId)
                          if (target) setDisconnectTarget(target)
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      <ConnectProviderModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnect={handleConnect}
      />

      <DisconnectConfirmModal
        account={disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        onConfirm={handleDisconnect}
      />
    </>
  )
}
