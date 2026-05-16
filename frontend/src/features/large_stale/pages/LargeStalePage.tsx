import { useMemo, useState } from "react"
import { Broom, Funnel, Plugs, WarningCircle } from "@phosphor-icons/react"
import { useNavigate } from "react-router-dom"

import type { Account } from "@/features/accounts/api"
import { useAccounts } from "@/features/accounts/hooks/useAccounts"
import type { LargeStaleFile } from "@/features/large_stale/api"
import { BatchDeleteConfirmModal } from "@/features/large_stale/components/BatchDeleteConfirmModal"
import { LargeStaleTable, LargeStaleTableSkeleton } from "@/features/large_stale/components/LargeStaleTable"
import { LargeStaleToolbar } from "@/features/large_stale/components/LargeStaleToolbar"
import { ThresholdInfoBanner } from "@/features/large_stale/components/ThresholdInfoBanner"
import { useLargeStaleUiState } from "@/features/large_stale/contexts/LargeStaleUiStateContext"
import { useLargeStale } from "@/features/large_stale/hooks/useLargeStale"
import { EmptyState } from "@/shared/components/EmptyState"
import { useToast } from "@/shared/hooks/useToast"
import { formatBytes } from "@/shared/utils/formatSize"
import { formatDateID } from "@/shared/utils/formatDate"

export function LargeStalePage() {
  const {
    typeFilter,
    setTypeFilter,
    sortBy,
    setSortBy,
    selectedFileIds,
    toggleSelection,
    removeFromSelection,
  } = useLargeStaleUiState()

  const { files, total, thresholds, snapshotAt, isLoading, error, refetch, refresh, batchDelete } =
    useLargeStale({ typeFilter, sortBy })

  const { accounts } = useAccounts()
  const { pushToast } = useToast()
  const navigate = useNavigate()

  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const problemAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.status === "token_invalid" || a.status === "revoked",
      ),
    [accounts],
  )

  // Status akun bersifat dinamis (user bisa reauthorize kapan saja),
  // sedangkan field `deletable`/`deletableReason` di mock adalah snapshot
  // saat scan terakhir. Derive ulang supaya row actionability sinkron
  // dengan AccountsContext tanpa perlu re-scan. Healthy strict = "active"
  // saja (per FPS): syncing/never_synced/token_invalid/revoked semuanya
  // disable destructive action.
  const accountStatusMap = useMemo(() => {
    const map = new Map<string, Account["status"]>()
    for (const account of accounts) {
      map.set(account.id, account.status)
    }
    return map
  }, [accounts])

  const effectiveFiles = useMemo<LargeStaleFile[]>(
    () =>
      files.map((file) => {
        // Shared dari akun lain: alasan permanen non-deletable tidak
        // bergantung status akun. Pertahankan seed apa adanya.
        if (!file.isOwned) return file

        const status = accountStatusMap.get(file.accountId)
        if (status === "active") {
          return { ...file, deletable: true, deletableReason: null }
        }

        return {
          ...file,
          deletable: false,
          deletableReason: "Akun perlu otorisasi ulang sebelum file bisa dihapus",
        }
      }),
    [files, accountStatusMap],
  )

  // Total size dari seluruh kandidat (untuk meta header).
  const totalSize = useMemo(
    () => effectiveFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [effectiveFiles],
  )

  const fileIndex = useMemo(() => {
    const map = new Map<string, LargeStaleFile>()
    for (const file of effectiveFiles) {
      map.set(file.fileId, file)
    }
    return map
  }, [effectiveFiles])

  const selectedFiles = useMemo<LargeStaleFile[]>(() => {
    const result: LargeStaleFile[] = []
    for (const fileId of selectedFileIds) {
      const file = fileIndex.get(fileId)
      if (file) result.push(file)
    }
    return result
  }, [selectedFileIds, fileIndex])

  const selectedCount = selectedFiles.length
  const selectedTotalSize = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
    [selectedFiles],
  )

  async function handleScanRefresh() {
    if (isRefreshing) return
    setIsRefreshing(true)
    try {
      await refresh()
      pushToast(`Scan selesai. ${total} kandidat ditemukan.`, "info")
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Scan ulang gagal. Coba lagi.",
        "error",
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  async function handleConfirmDelete() {
    const fileIds = [...selectedFileIds]
    if (fileIds.length === 0) return
    try {
      const result = await batchDelete(fileIds)
      if (result.deleted.length > 0) {
        removeFromSelection(result.deleted.map((d) => d.fileId))
        pushToast(`${result.deleted.length} file berhasil dihapus.`, "success")
      }
      if (result.failed.length > 0) {
        const failedNames = result.failed
          .map((f) => f.message ?? f.errorCode ?? f.fileId)
          .join("; ")
        pushToast(
          `${result.failed.length} file gagal dihapus: ${failedNames}`,
          "error",
        )
      }
      setIsDeleteModalOpen(false)
    } catch (err) {
      pushToast(
        err instanceof Error ? err.message : "Penghapusan gagal. Coba lagi.",
        "error",
      )
    }
  }

  const hasAccounts = accounts.length > 0
  const hasData = effectiveFiles.length > 0
  const filterActive = typeFilter !== "all"

  return (
    <>
      <header>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-2">Kelola File</p>
        <h1 className="mt-2 text-2xl font-semibold text-ink">File Besar dan Usang</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Kandidat pembersihan berdasarkan ukuran besar atau usia lama. Hanya file milik Anda yang dapat dihapus.
        </p>
        {snapshotAt && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-2">
            <span>
              Scan terakhir: <strong className="font-semibold text-ink-soft">{formatDateID(snapshotAt)}</strong>
            </span>
            {hasData && (
              <>
                <span>·</span>
                <span>
                  <strong className="font-semibold text-ink-soft">{total}</strong> file
                </span>
                <span>·</span>
                <span>
                  <strong className="font-semibold text-ink-soft">{formatBytes(totalSize)}</strong>
                </span>
              </>
            )}
          </div>
        )}
      </header>

      {problemAccounts.length > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-[--radius-sm] border border-warning-strong/20 bg-warning-soft px-4 py-3 text-sm text-warning-strong">
          <WarningCircle size={18} weight="fill" className="mt-0.5 flex-shrink-0" />
          <p>
            <strong className="font-semibold">{problemAccounts.length}</strong> akun perlu otorisasi ulang. Beberapa file dari akun tersebut tidak bisa dihapus sampai otorisasi diperbarui.
          </p>
        </div>
      )}

      {!hasAccounts && !isLoading && !error ? (
        <div className="mt-8">
          <EmptyState
            icon={<Plugs size={28} weight="duotone" />}
            title="Belum ada akun terhubung"
            description="Hubungkan akun untuk mulai melihat kandidat file besar dan usang lintas Google Drive dan Dropbox."
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
      ) : (
        <>
          {thresholds && (
            <div className="mt-4">
              <ThresholdInfoBanner thresholds={thresholds} />
            </div>
          )}

          <div className="mt-4">
            <LargeStaleToolbar
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              isRefreshing={isRefreshing}
              onScanRefreshClick={() => void handleScanRefresh()}
              selectedCount={selectedCount}
              selectedTotalSize={selectedTotalSize}
              onDeleteClick={() => setIsDeleteModalOpen(true)}
            />
          </div>

          <section className="mt-6 min-h-[320px]">
            {isLoading ? (
              <LargeStaleTableSkeleton />
            ) : error ? (
              <div className="rounded-[--radius] border border-danger-strong/30 bg-danger-soft px-5 py-4 text-sm text-danger-strong">
                <p className="font-medium">Gagal memuat kandidat file besar dan usang.</p>
                <p className="mt-1 text-xs">{error}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="mt-3 inline-flex items-center gap-2 rounded-[--radius-sm] bg-danger px-3 py-2 text-xs font-medium text-white transition hover:bg-danger-strong"
                >
                  Coba lagi
                </button>
              </div>
            ) : effectiveFiles.length === 0 ? (
              filterActive ? (
                <EmptyState
                  icon={<Funnel size={28} weight="duotone" />}
                  title="Tidak ada hasil untuk filter ini"
                  description="Belum ada file kandidat dengan tipe yang dipilih. Reset filter untuk melihat hasil lain."
                  action={
                    <button
                      type="button"
                      onClick={() => setTypeFilter("all")}
                      className="inline-flex items-center gap-2 rounded-[--radius-sm] border border-line bg-panel px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:bg-panel-soft"
                    >
                      Tampilkan semua tipe
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Broom size={28} weight="duotone" />}
                  title="Tidak ada file besar atau usang"
                  description="File milik Anda dalam kondisi rapi. Tidak ada kandidat pembersihan saat ini."
                />
              )
            ) : (
              <LargeStaleTable
                files={effectiveFiles}
                selectedFileIds={selectedFileIds}
                onToggleSelection={toggleSelection}
              />
            )}
          </section>
        </>
      )}

      <BatchDeleteConfirmModal
        open={isDeleteModalOpen}
        files={selectedFiles}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </>
  )
}
