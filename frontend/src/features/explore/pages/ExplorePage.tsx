import { useMemo } from "react"
import { ArrowsClockwise, Plugs, WarningCircle } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"

import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import { ActivityList } from "@/features/explore/components/ActivityList"
import { BreakdownGrid } from "@/features/explore/components/BreakdownGrid"
import { QuotaHeroCard } from "@/features/explore/components/QuotaHeroCard"
import { SearchTriggerButton } from "@/features/explore/components/SearchTriggerButton"
import { useActivity } from "@/features/explore/hooks/useActivity"
import { useQuotaSummary } from "@/features/explore/hooks/useQuotaSummary"
import { EmptyState } from "@/shared/components/EmptyState"
import { Skeleton } from "@/shared/components/LoadingState"
import { useToast } from "@/shared/hooks/useToast"
import { formatDateID } from "@/shared/utils/formatDate"

export function ExplorePage() {
  const accountsApi = useAccounts()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const activity = useActivity({ limit: 10 })
  const quota = useQuotaSummary()

  const problemAccounts = useMemo(
    () =>
      accountsApi.accounts.filter(
        (a) => a.status === "token_invalid" || a.status === "revoked",
      ),
    [accountsApi.accounts],
  )

  const pendingAccounts = useMemo(
    () => accountsApi.accounts.filter((a) => a.status === "never_synced"),
    [accountsApi.accounts],
  )

  async function handleRefreshPending() {
    if (pendingAccounts.length === 0) return
    try {
      await Promise.all(
        pendingAccounts.map((a) => accountsApi.refreshAccount(a.id)),
      )
      activity.refetch()
      quota.refetch()
      pushToast("Metadata akun berhasil dimuat.", "success")
    } catch {
      pushToast("Sebagian akun gagal dimuat. Periksa halaman Akun Terhubung.", "error")
    }
  }

  const isInitialAccountsLoading = accountsApi.isLoading
  const snapshotAt =
    activity.snapshotAt ?? quota.snapshotAt ?? accountsApi.snapshotAt

  if (isInitialAccountsLoading) {
    return (
      <>
        <ExploreHeader snapshotAt={null} />
        <div className="mt-6 space-y-4">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </>
    )
  }

  if (!accountsApi.error && accountsApi.accounts.length === 0) {
    return (
      <>
        <ExploreHeader snapshotAt={snapshotAt} />
        <div className="mt-8">
          <EmptyState
            icon={<Plugs size={28} weight="duotone" />}
            title="Hubungkan akun cloud pertama"
            description="Belum ada akun terhubung. Hubungkan akun untuk mulai mengagregasi metadata dari Google Drive dan Dropbox."
            action={
              <button
                type="button"
                onClick={() => navigate("/pengaturan/akun")}
                className="inline-flex items-center gap-2 rounded-[--radius-sm] bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-strong"
              >
                <Plugs size={16} weight="bold" />
                <span>Hubungkan akun pertama</span>
              </button>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <ExploreHeader snapshotAt={snapshotAt} />

      <div className="mt-6">
        <SearchTriggerButton />
      </div>

      {accountsApi.error && (
        <div className="mt-4 rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
          <p className="font-medium">Gagal memuat daftar akun.</p>
          <p className="mt-1 text-xs">{accountsApi.error}</p>
        </div>
      )}

      {quota.error && (
        <div className="mt-4 rounded-[--radius] border border-warning-strong/20 bg-warning-soft px-5 py-4 text-sm text-warning-strong">
          <p className="font-medium">Ringkasan kuota belum bisa dimuat.</p>
          <p className="mt-1 text-xs">{quota.error}</p>
        </div>
      )}

      {pendingAccounts.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[--radius-sm] border border-warning-strong/20 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <p>
            <strong className="font-semibold">{pendingAccounts.length}</strong> akun menunggu sinkronisasi. Data akun tersebut akan muncul di dashboard setelah refresh berhasil.
          </p>
          <button
            type="button"
            onClick={() => void handleRefreshPending()}
            className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-warning-strong/40 bg-warning-soft px-3 py-1.5 text-xs font-medium text-warning-strong transition hover:bg-warning/20"
          >
            <ArrowsClockwise size={14} weight="bold" />
            <span>Refresh akun</span>
          </button>
        </div>
      )}

      {problemAccounts.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-[--radius-sm] border border-danger-strong/20 bg-danger-soft px-4 py-3 text-sm text-danger-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Angka kuota mencerminkan sinkronisasi terakhir.
          </p>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(280px,360px)_1fr] lg:items-stretch">
        <QuotaHeroCard
          accounts={accountsApi.accounts}
          problemAccounts={problemAccounts}
          quotaSummary={quota.summary}
        />
        <BreakdownGrid
          accounts={accountsApi.accounts}
          quotaSummary={quota.summary}
        />
      </div>

      <section className="mt-8">
        <header className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold text-ink">Aktivitas Terkini</h2>
          <span className="text-xs text-muted">
            {activity.isLoading
              ? "memuat…"
              : activity.files.length > 0
                ? `${activity.files.length} entry`
                : "kosong"}
          </span>
        </header>
        <ActivityList
          files={activity.files}
          isLoading={activity.isLoading}
          error={activity.error}
          onRetry={activity.refetch}
        />
      </section>
    </>
  )
}

function ExploreHeader({ snapshotAt }: { snapshotAt: string | null }) {
  return (
    <header>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Eksplorasi</p>
      <h1 className="mt-2 text-2xl font-semibold text-ink">
        Ringkasan penyimpanan multi-cloud
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Semua berkas dari seluruh akun terhubung. Pantau kuota, breakdown per akun, dan aktivitas terbaru.
      </p>
      {snapshotAt && (
        <p className="mt-2 text-xs text-muted-2">
          Snapshot terakhir: {formatDateID(snapshotAt)}
        </p>
      )}
    </header>
  )
}
