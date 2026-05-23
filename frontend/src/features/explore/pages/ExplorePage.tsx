import { useMemo } from "react"
import { Plugs, WarningCircle } from "@phosphor-icons/react"
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
import { getAccountLifecycleSummary } from "@/shared/utils/accountLifecycle"
import { formatDateID } from "@/shared/utils/formatDate"

export function ExplorePage() {
  const accountsApi = useAccounts()
  const navigate = useNavigate()

  const activity = useActivity({ limit: 10 })
  const quota = useQuotaSummary()

  const { failedLoadAccounts, problemAccounts } = useMemo(
    () =>
      getAccountLifecycleSummary(accountsApi.accounts, {
        loadingAccountIds: accountsApi.loadingAccountIds,
      }),
    [accountsApi.accounts, accountsApi.loadingAccountIds],
  )
  const attentionAccounts = useMemo(
    () => [...problemAccounts, ...failedLoadAccounts],
    [failedLoadAccounts, problemAccounts],
  )

  const isInitialAccountsLoading = accountsApi.isLoading
  const snapshotAt =
    activity.snapshotAt ?? quota.snapshotAt ?? accountsApi.snapshotAt
  const overviewLayoutClass =
    accountsApi.accounts.length >= 3
      ? "lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-stretch"
      : "grid-cols-1"

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
            description="Belum ada akun terhubung. Hubungkan akun untuk mulai menggabungkan informasi file dari Google Drive dan Dropbox."
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
        <div className="mt-4 rounded-[--radius] border border-warning-strong/40 bg-warning-soft/80 px-5 py-4 text-sm text-warning-strong">
          <p className="font-medium">Ringkasan kuota belum bisa dimuat.</p>
          <p className="mt-1 text-xs">{quota.error}</p>
        </div>
      )}

      {problemAccounts.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-[--radius-sm] border border-danger-strong/20 bg-danger-soft px-4 py-3 text-sm text-danger-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Angka kuota memakai data terakhir yang berhasil dibaca.
          </p>
        </div>
      )}

      <div className={`mt-6 grid gap-4 ${overviewLayoutClass}`}>
        <QuotaHeroCard
          accounts={accountsApi.accounts}
          problemAccounts={attentionAccounts}
          quotaSummary={quota.summary}
        />
        <BreakdownGrid
          accounts={accountsApi.accounts}
          loadingAccountIds={accountsApi.loadingAccountIds}
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
          Data terakhir dibaca: {formatDateID(snapshotAt)}
        </p>
      )}
    </header>
  )
}
